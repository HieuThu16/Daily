import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';

const BASE = 'https://dualeotruyencw.com';

const CONFIG = {
  delayMs: 250,
  retry: 3,
  retryDelayMs: 1000,
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
  console.log(`[PAGE ${page}] ${url}`);
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
      title: title.replace(/\s+/g, ' '),
      cover: cover ? absoluteUrl(cover) : null,
      url: fullUrl,
    });
  });

  return uniqueBy(result, item => item.slug);
}

export async function scrapeDetail(slug) {
  const url = `${BASE}/truyen-tranh/${slug}`;
  const html = await get(url);
  const $ = cheerio.load(html);

  const title =
    $('h1.title, h1').first().text().trim() ||
    $('.story-info h1').text().trim() ||
    slug;

  const rawCover =
    $('.book-info img, .story-info img, .avatar img, .col-image img, .detail-info img').first().attr('data-src') ||
    $('.book-info img, .story-info img, .avatar img, .col-image img, .detail-info img').first().attr('src') ||
    null;

  const cover = rawCover ? absoluteUrl(rawCover) : null;

  const description =
    $('.story-detail-info, .detail-content, .story-intro, #story-intro, .description, .summary').first().text().trim() ||
    '';

  const genres = [];
  $('a[href*="/the-loai/"]').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt && !genres.includes(txt)) genres.push(txt);
  });

  const chapters = [];
  $('a[href*="/truyen-tranh/"][href*="/chapter-"]').each((_, a) => {
    const href = $(a).attr('href');
    if (!href) return;

    const fullUrl = absoluteUrl(href);
    const text = $(a).text().trim();
    const match = href.match(/\/chapter-(\d+(?:\.\d+)?)/i);
    const num = match ? parseFloat(match[1]) : null;

    chapters.push({
      title: text || (num != null ? `Chapter ${num}` : 'Chapter'),
      number: num,
      url: fullUrl,
      images: [],
      imageCount: 0,
    });
  });

  const uniqueChapters = uniqueBy(chapters, ch => ch.url).sort((a, b) => {
    if (a.number == null && b.number == null) return 0;
    if (a.number == null) return 1;
    if (b.number == null) return -1;
    return a.number - b.number;
  });

  return {
    slug,
    title: title.replace(/\s+/g, ' '),
    cover,
    description: description.replace(/\s+/g, ' '),
    genres: genres.length > 0 ? genres : ['BoyLove'],
    url,
    chapters: uniqueChapters,
    totalChapters: uniqueChapters.length,
  };
}

export async function scrapeChapter(slug, chapterNum) {
  const url = `${BASE}/truyen-tranh/${slug}/chapter-${chapterNum}`;
  const html = await get(url);
  const $ = cheerio.load(html);

  const images = [];
  $(
    '.content_view_img img, .view-content img, .reading-detail img, .chapter-content img, #content_read img, .box-image img',
  ).each((_, img) => {
    const raw =
      $(img).attr('data-src') ||
      $(img).attr('data-original') ||
      $(img).attr('data-lazy-src') ||
      $(img).attr('src');

    if (!raw) return;
    const cleanUrl = absoluteUrl(raw.trim());
    if (!cleanUrl) return;

    if (
      cleanUrl.includes('load.gif') ||
      cleanUrl.includes('prod_loading.gif') ||
      cleanUrl.includes('/skin/css/') ||
      cleanUrl.includes('/avatar/') ||
      cleanUrl.includes('/avata/') ||
      cleanUrl.includes('logo') ||
      cleanUrl.startsWith('data:')
    ) {
      return;
    }

    images.push({
      page: images.length + 1,
      src: cleanUrl,
      fallbackSrc: cleanUrl,
    });
  });

  return {
    slug,
    chapterNum,
    url,
    imageCount: images.length,
    images: uniqueBy(images, img => img.src),
  };
}

async function saveData(data) {
  const jsonStr = JSON.stringify(data, null, 2);
  await fs.mkdir('public/data', { recursive: true });
  await fs.writeFile('public/data/bl_manga.json', jsonStr, 'utf8');

}

export async function crawlAllMaster() {
  console.log('🚀 Bắt đầu cào TOÀN BỘ truyện BL/Đam mỹ/Yaoi từ dualeotruyen...');

  // Load existing data
  let existingBooks = [];
  try {
    const raw = await fs.readFile('public/data/bl_manga.json', 'utf8');
    existingBooks = JSON.parse(raw);
    console.log(`📦 Đã có sẵn ${existingBooks.length} truyện đã cào.`);
  } catch {}

  const existingMap = new Map(existingBooks.map(b => [b.slug, b]));
  let allList = [...existingBooks];

  // Load hot ranking maps
  let hotSlugSet = new Set();
  let hotMap = new Map();
  let topDayMap = new Map();
  let topWeekMap = new Map();
  let topMonthMap = new Map();
  try {
    const hotRaw = await fs.readFile('public/data/bl_hot_manga.json', 'utf8');
    const hotData = JSON.parse(hotRaw);
    hotSlugSet = new Set(hotData.hot.map(h => h.slug));
    hotMap = new Map(hotData.hot.map(t => [t.slug, t.rank]));
    topDayMap = new Map(hotData.top_day.map(t => [t.slug, t.rank]));
    topWeekMap = new Map(hotData.top_week.map(t => [t.slug, t.rank]));
    topMonthMap = new Map(hotData.top_month.map(t => [t.slug, t.rank]));
  } catch {}

  const categories = [
    '/the-loai/boylove',
    '/the-loai/dam-my',
    '/the-loai/yaoi',
    '/the-loai/shounen-ai',
    '/the-loai/manhwa',
    '/the-loai/webtoon',
    '/the-loai/romance',
    '/the-loai/18',
    '/the-loai/drama',
    '/the-loai/comedy',
    '/the-loai/school-life',
    '/the-loai/supernatural',
  ];

  for (const cat of categories) {
    console.log(`\n📚 Đang quét danh mục ${cat}...`);
    for (let page = 1; page <= 35; page++) {
      try {
        const pageItems = await scrapeList(cat, page);
        if (pageItems.length === 0) break;
        allList.push(...pageItems);
        allList = uniqueBy(allList, x => x.slug);
        console.log(`-> Tổng tích luỹ: ${allList.length} truyện`);
        await sleep(CONFIG.delayMs);
      } catch (err) {
        console.error(`Lỗi trang ${page}:`, err.message);
        break;
      }
    }
  }

  console.log(`\n🎯 Chuẩn bị bóc tách chi tiết toàn bộ ${allList.length} bộ truyện...`);

  const fullBooks = [];

  for (let i = 0; i < allList.length; i++) {
    const item = allList[i];

    // Check if already completely crawled with chapters
    if (existingMap.has(item.slug) && existingMap.get(item.slug).chapters?.length > 0) {
      const existing = existingMap.get(item.slug);
      existing.isHot = hotSlugSet.has(item.slug);
      existing.hotRank = hotMap.get(item.slug) ?? null;
      existing.topDayRank = topDayMap.get(item.slug) ?? null;
      existing.topWeekRank = topWeekMap.get(item.slug) ?? null;
      existing.topMonthRank = topMonthMap.get(item.slug) ?? null;
      fullBooks.push(existing);
      continue;
    }

    console.log(`[${i + 1}/${allList.length}] Bóc tách: ${item.title} (${item.slug})`);

    try {
      const detail = await scrapeDetail(item.slug);
      if (!detail.cover && item.cover) detail.cover = item.cover;

      detail.isHot = hotSlugSet.has(item.slug);
      detail.hotRank = hotMap.get(item.slug) ?? null;
      detail.topDayRank = topDayMap.get(item.slug) ?? null;
      detail.topWeekRank = topWeekMap.get(item.slug) ?? null;
      detail.topMonthRank = topMonthMap.get(item.slug) ?? null;

      // Cào ảnh chapter 1 & 2
      const chaptersWithImages = [];
      for (let c = 0; c < detail.chapters.length; c++) {
        const ch = detail.chapters[c];
        if (c < 2 && ch.number != null) {
          try {
            const chData = await scrapeChapter(item.slug, ch.number);
            chaptersWithImages.push({
              ...ch,
              images: chData.images,
              imageCount: chData.imageCount,
            });
          } catch (e) {
            chaptersWithImages.push({ ...ch, images: [], imageCount: 0 });
          }
          await sleep(150);
        } else {
          chaptersWithImages.push({ ...ch, images: [], imageCount: 0 });
        }
      }

      detail.chapters = chaptersWithImages;
      fullBooks.push(detail);

      // Lưu liên tục mỗi 5 truyện
      if ((i + 1) % 5 === 0 || i === allList.length - 1) {
        await saveData(fullBooks);
        console.log(`  💾 Đã lưu ${fullBooks.length} truyện...`);
      }
    } catch (err) {
      console.error(`  ❌ Lỗi cào truyện ${item.slug}:`, err.message);
      fullBooks.push({
        slug: item.slug,
        title: item.title,
        cover: item.cover,
        description: '',
        genres: ['BoyLove'],
        url: item.url,
        chapters: [],
        totalChapters: 0,
      });
    }

    await sleep(CONFIG.delayMs);
  }

  await saveData(fullBooks);
  console.log(`\n🎉 ĐÃ HOÀN TẤT CÀO TOÀN BỘ ${fullBooks.length} TRUYỆN BL!`);
}

if (process.argv[1]?.endsWith('crawl_all_bl.js')) {
  crawlAllMaster().catch(console.error);
}
