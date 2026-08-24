/**
 * crawl_mangadex.cjs
 * Lấy danh sách truyện từ API chính thức của MangaDex theo tag.
 *
 * Khác các crawler HTML trong repo: đây là API có tài liệu, trả JSON nên không gãy
 * khi site đổi giao diện, và rate limit rõ ràng (~5 req/s) nên chỉ cần delay cố định.
 *
 * Chạy:
 *   node crawl_mangadex.cjs                          # School Life + Boys' Love
 *   TAGS=school,romance OUT=md_romance node crawl_mangadex.cjs
 *
 * Chỉ lấy metadata (tên, mô tả, bìa, thể loại). Không tải nội dung chapter.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API = 'https://api.mangadex.org';
const UPLOADS = 'https://uploads.mangadex.org';
const PAGE_SIZE = 100; // trần của API
// ~4 req/s, dưới rate limit công bố. Tăng qua DELAY nếu bị WAF chặn giữa chừng.
const DELAY_MS = Number(process.env.DELAY) || 250;

/** Tag ID lấy từ GET /manga/tag — hard-code vì chúng là UUID cố định. */
const TAGS = {
  school: 'caaa44eb-cd40-4177-b930-79d3ef2afe87', // School Life
  bl: '5920b825-4181-4a17-beeb-9918b0ff7a30', // Boys' Love
  gl: 'a3c67850-4684-404e-9b7f-c69850ee5da6', // Girls' Love
  romance: '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
  sliceoflife: 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url, retry = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Daily-App/1.0' }, timeout: 20000 }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          // 429 = chạm rate limit; lùi lại rồi thử tiếp thay vì bỏ trang.
          if (res.statusCode === 429 && retry < 5) {
            return sleep(2000 * (retry + 1)).then(() => resolve(getJson(url, retry + 1)));
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            // WAF trả trang HTML thay vì JSON khi request dồn dập -> chờ lâu hơn rồi thử lại.
            if (retry < 5) {
              return sleep(3000 * (retry + 1)).then(() => resolve(getJson(url, retry + 1)));
            }
            reject(new Error(`JSON hỏng (HTTP ${res.statusCode}): ${err.message}`));
          }
        });
      })
      .on('error', (err) => {
        if (retry < 3) return sleep(1000 * (retry + 1)).then(() => resolve(getJson(url, retry + 1)));
        reject(err);
      })
      .on('timeout', function () {
        this.destroy();
        if (retry < 3) sleep(1000).then(() => resolve(getJson(url, retry + 1)));
        else reject(new Error(`Timeout: ${url}`));
      });
  });
}

/** Ưu tiên tiếng Việt, rồi tiếng Anh, cuối cùng lấy giá trị đầu tiên có sẵn. */
function pickText(map) {
  if (!map) return '';
  return map.vi || map.en || Object.values(map)[0] || '';
}

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toRecord(item) {
  const at = item.attributes;
  const coverFile = item.relationships?.find((r) => r.type === 'cover_art')?.attributes?.fileName;
  const title = pickText(at.title) || pickText(at.altTitles?.[0]);

  return {
    id: item.id,
    slug: slugify(title),
    title,
    cover: coverFile ? `${UPLOADS}/covers/${item.id}/${coverFile}.256.jpg` : null,
    description: pickText(at.description).slice(0, 1000),
    genres: (at.tags || []).map((t) => t.attributes.name.en).filter(Boolean),
    year: at.year ?? null,
    status: at.status,
    source: 'mangadex',
    url: `https://mangadex.org/title/${item.id}`,
  };
}

async function main() {
  const wanted = (process.env.TAGS || 'school,bl').split(',').map((s) => s.trim());
  const unknown = wanted.filter((t) => !TAGS[t]);
  if (unknown.length) {
    console.error(`Tag không biết: ${unknown.join(', ')}. Có: ${Object.keys(TAGS).join(', ')}`);
    process.exit(1);
  }

  const outName = process.env.OUT || `mangadex_${wanted.join('_')}`;
  // includedTagsMode=AND: phải có ĐỦ các tag -> "school + bl" ra đúng BL vườn trường.
  const tagQuery = wanted.map((t) => `includedTags[]=${TAGS[t]}`).join('&');

  console.log(`Cào MangaDex tag: ${wanted.join(' + ')} -> ${outName}.json`);

  const all = [];
  const seen = new Set();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url =
      `${API}/manga?limit=${PAGE_SIZE}&offset=${offset}&${tagQuery}` +
      `&includedTagsMode=AND&includes[]=cover_art&order[followedCount]=desc` +
      `&contentRating[]=safe&contentRating[]=suggestive`;

    const res = await getJson(url);
    if (res.result === 'error') throw new Error(JSON.stringify(res.errors?.[0] ?? res));

    for (const item of res.data || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      all.push(toRecord(item));
    }

    console.log(`  ${all.length}/${res.total} bộ`);
    // API chặn offset > 10000; dừng khi hết dữ liệu hoặc chạm trần đó.
    if (offset + PAGE_SIZE >= Math.min(res.total, 10000)) break;
    await sleep(DELAY_MS);
  }

  const json = JSON.stringify(all, null, 2);
  for (const dir of ['public/data']) {
    fs.mkdirSync(path.resolve(dir), { recursive: true });
    fs.writeFileSync(path.resolve(dir, `${outName}.json`), json, 'utf8');
  }
  console.log(`Xong: ${all.length} bộ -> public/data/${outName}.json `);
}

main().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
