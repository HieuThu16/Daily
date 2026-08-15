import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://dualeotruyencw.com';

const CONFIG = {
  delayMs: 800,
  retry: 3,
  retryDelayMs: 1500,
  timeoutMs: 15000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function absoluteUrl(url, base = BASE) {
  if (!url) return null;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function get(url, attempt = 1) {
  let lastError;
  for (let i = attempt; i <= CONFIG.retry; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Referer': BASE,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (i < CONFIG.retry) {
        await sleep(CONFIG.retryDelayMs * i);
      }
    }
  }
  throw new Error(`Request failed: ${url} -> ${lastError?.message}`);
}

export async function scrapeList(pathUrl, page = 1) {
  const url = pathUrl.includes('?') ? `${BASE}${pathUrl}&page=${page}` : `${BASE}${pathUrl}?page=${page}`;
  console.log(`[LIST] page=${page} ${url}`);
  const html = await get(url);
  const $ = cheerio.load(html);
  const result = [];

  $('a[href*="/truyen-tranh/"]').each((_, a) => {
    const href = $(a).attr('href');
    if (!href || /\/chapter-/i.test(href)) return;

    const fullUrl = absoluteUrl(href);
    if (!fullUrl) return;

    const match = fullUrl.match(/\/truyen-tranh\/([^/?#]+)/);
    if (!match) return;
    const slug = match[1].replace(/\/$/, '');

    const img = $(a).find('img').first();
    const cover =
      img.attr('data-src') ||
      img.attr('data-original') ||
      img.attr('data-lazy-src') ||
      img.attr('src') ||
      null;

    const title =
      $(a).attr('title')?.trim() ||
      img.attr('alt')?.trim() ||
      $(a).find('.title, h3, h2').text().trim() ||
      $(a).text().trim();

    if (!slug || !title || title.length < 2) return;

    result.push({
      slug,
      title,
      cover: cover ? absoluteUrl(cover, fullUrl) : null,
      url: fullUrl,
    });
  });

  return uniqueBy(result, x => x.slug);
}

export async function scrapeDetail(slug) {
  const url = `${BASE}/truyen-tranh/${slug}`;
  console.log(`[DETAIL] ${slug}`);
  const html = await get(url);
  const $ = cheerio.load(html);

  const genres = $('a[href*="/the-loai/"]')
    .map((_, a) => $(a).text().trim())
    .get()
    .filter(Boolean);

  const chapters = [];
  $(`a[href*="/truyen-tranh/${slug}/chapter-"]`).each((_, a) => {
    const href = $(a).attr('href');
    if (!href) return;
    const chapterUrl = absoluteUrl(href, url);
    if (!chapterUrl) return;
    const match = chapterUrl.match(/\/chapter-(\d+(?:\.\d+)?)\/?$/);
    const number = match ? Number(match[1]) : null;

    chapters.push({
      number,
      name: $(a).text().trim() || (number ? `Chapter ${number}` : 'Chapter'),
      url: chapterUrl,
    });
  });

  const uniqueChapters = uniqueBy(chapters, x => x.url)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const img = $('img.thumbnail, .story-info-left img, .book-info img, img[src*="biatruyen"], img[src*="/story/"]').first();
  const cover = img.attr('data-src') || img.attr('data-original') || img.attr('src');

  return {
    slug,
    title: $('h1').first().text().trim() || $('title').first().text().trim(),
    cover: cover ? absoluteUrl(cover, url) : null,
    description:
      $('meta[name="description"]').attr('content')?.trim() ||
      $('.story-detail-info, .detail-content, .summary, .story-info').text().trim() ||
      '',
    genres: [...new Set(genres)],
    url,
    chapters: uniqueChapters,
    totalChapters: uniqueChapters.length,
    updatedAt: new Date().toISOString(),
  };
}

export async function scrapeChapter(slug, chapterNumber) {
  const url = `${BASE}/truyen-tranh/${slug}/chapter-${chapterNumber}`;
  console.log(`  -> [CHAPTER] #${chapterNumber}`);
  const html = await get(url);
  const $ = cheerio.load(html);
  const images = [];

  const selector = $('.content_view_img img, .view-content img, .reading-detail img, .chapter-content img, #content_read img, .box-image img').length
    ? '.content_view_img img, .view-content img, .reading-detail img, .chapter-content img, #content_read img, .box-image img'
    : 'img';

  $(selector).each((index, img) => {
    const src =
      $(img).attr('data-src') ||
      $(img).attr('data-original') ||
      $(img).attr('data-lazy-src') ||
      $(img).attr('src');

    if (!src) return;
    const imageUrl = absoluteUrl(src, url);
    if (!imageUrl) return;

    if (
      imageUrl.startsWith('data:') ||
      /prod_loading\.gif/i.test(imageUrl) ||
      /load\.gif/i.test(imageUrl) ||
      /loading/i.test(imageUrl) ||
      /dualeotruyen\.png/i.test(imageUrl) ||
      /\/avatar\//i.test(imageUrl) ||
      /\/avata\//i.test(imageUrl) ||
      /\/skin\/css\//i.test(imageUrl) ||
      /logo/i.test(imageUrl)
    ) {
      return;
    }

    images.push({
      url: imageUrl,
      alt: $(img).attr('alt')?.trim() || '',
    });
  });

  const uniqueImages = uniqueBy(images, x => x.url).map((image, index) => ({
    ...image,
    index: index + 1,
  }));

  return {
    slug,
    chapter: chapterNumber,
    url,
    images: uniqueImages,
    imageCount: uniqueImages.length,
  };
}

export async function crawlBatch10() {
  console.log('🚀 Bắt đầu cào hàng loạt 10 truyện BL...');
  const list = await scrapeList('/the-loai/boylove', 1);
  const selected = list.slice(0, 10);
  console.log(`Đã chọn 10 truyện từ danh sách (${selected.map(s => s.title).join(', ')})`);

  const fullBooks = [];

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    console.log(`\n========================================`);
    console.log(`[${i + 1}/10] Đang cào: ${item.title} (${item.slug})`);
    try {
      const detail = await scrapeDetail(item.slug);
      if (!detail.cover && item.cover) detail.cover = item.cover;

      // Cào ảnh của 3 chapter đầu tiên để load siêu nhanh và có sẵn ảnh đọc offline/cache
      const chaptersWithImages = [];
      for (let c = 0; c < detail.chapters.length; c++) {
        const ch = detail.chapters[c];
        if (c < 3 && ch.number != null) {
          try {
            const chData = await scrapeChapter(item.slug, ch.number);
            chaptersWithImages.push({
              ...ch,
              images: chData.images,
              imageCount: chData.imageCount,
            });
          } catch (e) {
            console.error(`  Lỗi chapter #${ch.number}:`, e.message);
            chaptersWithImages.push({ ...ch, images: [], imageCount: 0 });
          }
          await sleep(CONFIG.delayMs);
        } else {
          chaptersWithImages.push({ ...ch, images: [], imageCount: 0 });
        }
      }

      detail.chapters = chaptersWithImages;
      fullBooks.push(detail);
    } catch (err) {
      console.error(`❌ Lỗi cào truyện ${item.slug}:`, err.message);
    }
    await sleep(CONFIG.delayMs);
  }

  // Đảm bảo thư mục lưu dữ liệu tồn tại
  await fs.mkdir('public/data', { recursive: true });
  await fs.mkdir('src/data', { recursive: true });

  const dataPath1 = path.join('public', 'data', 'bl_manga.json');
  const dataPath2 = path.join('src', 'data', 'bl_manga.json');

  await fs.writeFile(dataPath1, JSON.stringify(fullBooks, null, 2), 'utf8');
  await fs.writeFile(dataPath2, JSON.stringify(fullBooks, null, 2), 'utf8');

  console.log(`\n🎉 Đã hoàn tất cào 10 truyện và lưu vào:`);
  console.log(`- ${dataPath1}`);
  console.log(`- ${dataPath2}`);
}

if (process.argv[1]?.endsWith('crawl_10.js')) {
  crawlBatch10().catch(console.error);
}
