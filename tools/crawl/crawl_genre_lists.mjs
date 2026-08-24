// Quét danh sách truyện theo thể loại từ otruyenapi (metadata, không tải ảnh chương).
// Chạy: node crawl_genre_lists.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://otruyenapi.com/v1/api';
const CDN = 'https://img.otruyenapi.com/uploads/comics';

const JOBS = [
  { out: 'school_life_list.json', genres: ['school-life'] },
  { out: 'bl_list.json', genres: ['dam-my', 'shounen-ai', 'soft-yaoi', 'yaoi'] },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      if (i < retries - 1) await sleep(500 * (i + 1));
    }
  }
  return null;
}

function toEntry(it) {
  return {
    slug: it.slug,
    title: it.name,
    cover: `${CDN}/${it.thumb_url}`,
    genres: (it.category || []).map(c => c.name),
    status: it.status,
    updatedAt: it.updatedAt,
    url: `https://otruyenapi.com/truyen-tranh/${it.slug}`,
  };
}

async function crawlGenre(slug) {
  const out = [];
  for (let page = 1; ; page++) {
    const json = await fetchJson(`${API}/the-loai/${slug}?page=${page}`);
    const items = json?.data?.items ?? [];
    if (!items.length) break;
    out.push(...items.map(toEntry));
    const total = json?.data?.params?.pagination?.totalItems ?? 0;
    console.log(`  ${slug} p${page}: +${items.length} (${out.length}/${total})`);
    if (out.length >= total) break;
    await sleep(200);
  }
  return out;
}

for (const job of JOBS) {
  console.log(`=== ${job.out} ===`);
  const seen = new Map();
  for (const g of job.genres) {
    for (const e of await crawlGenre(g)) if (!seen.has(e.slug)) seen.set(e.slug, e);
  }
  const list = [...seen.values()];
  const file = path.resolve('public/data', job.out);
  await fs.writeFile(file, JSON.stringify(list), 'utf-8');
  console.log(`-> ${list.length} truyện ghi vào ${file}\n`);
}
