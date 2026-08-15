import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://nettruyenz.com';
const CATE_URL = `${BASE}/cate-ngon-tinh`;

const CONFIG = {
  concurrency: 5, // 5 concurrent detail workers for fast, respectful crawling
  delayMs: 150,
  retry: 3,
  retryDelayMs: 800,
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

/**
 * Detect total pages available on the category
 */
async function detectTotalPages() {
  try {
    const html = await get(CATE_URL);
    const $ = cheerio.load(html);
    let maxPage = 1;
    $('a[href*="page="]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const match = href.match(/page=(\d+)/);
      if (match) {
        const p = parseInt(match[1], 10);
        if (p > maxPage) maxPage = p;
      }
    });
    return maxPage;
  } catch {
    return 114;
  }
}

/**
 * Scrapes a single category page for comic items
 */
export async function scrapeCategoryPage(page = 1) {
  const url = page === 1 ? CATE_URL : `${CATE_URL}?page=${page}`;
  const html = await get(url);
  const $ = cheerio.load(html);
  const list = [];

  $('.item, .items .item').each((_, el) => {
    const linkEl = $(el).find('a').first();
    const href = linkEl.attr('href') || $(el).find('h3 a').attr('href');
    if (!href) return;

    const fullUrl = absoluteUrl(href);
    if (!fullUrl) return;

    const slugMatch = fullUrl.match(/\/comic-([^/?#]+)/);
    const slug = slugMatch ? slugMatch[1].replace(/\/$/, '') : fullUrl.split('/').pop()?.replace(/\/$/, '');
    if (!slug) return;

    const img = $(el).find('img').first();
    const cover = img.attr('data-original') || img.attr('data-src') || img.attr('src') || null;

    const title = $(el).find('h3, .title, a.jtip').first().text().trim() || img.attr('alt')?.trim() || slug;
    const latestChapter = $(el).find('.chapter a, .comic-item-meta a').first().text().trim();
    const views = $(el).find('.view, .pull-left i.fa-eye, .view-count').parent().text().trim();

    list.push({
      slug,
      title,
      cover: cover ? absoluteUrl(cover) : null,
      url: fullUrl,
      latestChapter: latestChapter || undefined,
      views: views || undefined,
    });
  });

  return uniqueBy(list, item => item.slug);
}

/**
 * Scrapes full detail of a comic including chapters list
 */
export async function scrapeComicDetail(comic) {
  try {
    const html = await get(comic.url);
    const $ = cheerio.load(html);

    const title = $('h1.comic-detail-title, h1.title, h1').first().text().trim() || comic.title;
    const coverImg = $('.comic-detail-row img').first();
    const cover = coverImg.attr('src') || coverImg.attr('data-src') || coverImg.attr('data-original') || comic.cover;
    const updatedAt = $('.comic-updated-time').text().replace(/\[Cập nhật lúc:\s*|\]/g, '').trim();

    let author = 'Đang cập nhật';
    let status = 'Đang tiến hành';
    let views = '';
    const genres = [];

    $('.meta-row').each((_, row) => {
      const text = $(row).text().trim();
      if (text.includes('Tác giả')) {
        author = $(row).find('dd').text().trim() || author;
      }
      if (text.includes('Tình trạng')) {
        status = $(row).find('dd').text().trim() || status;
      }
      if (text.includes('Lượt xem')) {
        views = $(row).find('dd').text().trim() || views;
      }
      if (text.includes('Thể loại')) {
        $(row).find('.chip-link, .chip, a').each((_, a) => {
          const g = $(a).text().trim();
          if (g && g !== '-') genres.push(g);
        });
      }
    });

    if (genres.length === 0) {
      genres.push('Ngôn Tình');
    }

    // Description
    let description = '';
    $('.comic-section-head').each((_, head) => {
      if ($(head).text().includes('NỘI DUNG')) {
        description = $(head).next('.fs-13, div, p').text().trim();
      }
    });
    description = description.replace(/<[^>]*>?/gm, '').replace(/&lt;[^&]*&gt;/gm, '').trim();

    // Chapters
    const chapters = [];
    $('table.chapter-table tbody tr').each((_, tr) => {
      const a = $(tr).find('td a').first();
      const href = a.attr('href');
      const name = a.text().trim();
      const time = $(tr).find('td.t').first().text().trim();
      const chViews = $(tr).find('td.text-center').text().trim();

      if (href) {
        const fullChapterUrl = absoluteUrl(href);
        const match = name.match(/chapter\s*([\d.]+)/i) || (href ? href.match(/chap-([\d.]+)/i) : null);
        const number = match ? parseFloat(match[1]) : (chapters.length + 1);

        chapters.push({
          number,
          name: name || `Chapter ${number}`,
          url: fullChapterUrl,
          updatedAt: time || undefined,
          views: chViews || undefined,
        });
      }
    });

    return {
      slug: comic.slug,
      title,
      cover: cover ? absoluteUrl(cover) : null,
      description: description || 'Đang cập nhật nội dung...',
      author,
      status,
      views: views || comic.views || '',
      genres: [...new Set(genres)],
      url: comic.url,
      updatedAt: updatedAt || undefined,
      chapters,
      totalChapters: chapters.length,
    };
  } catch (err) {
    console.warn(`[WARN] Lỗi tải chi tiết truyện ${comic.slug}: ${err.message}`);
    return {
      ...comic,
      description: '',
      genres: ['Ngôn Tình'],
      chapters: [],
      totalChapters: 0,
    };
  }
}

/**
 * Scrapes chapter images
 */
export async function scrapeChapterImages(chapterUrl) {
  try {
    const html = await get(chapterUrl);
    const $ = cheerio.load(html);
    const images = [];

    $('.reader-pages img, .page-chapter img, .reading-detail img, .chapter-content img').each((i, img) => {
      const src = $(img).attr('data-original') || $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-cdn');
      if (src && !src.includes('logo') && !src.includes('banner')) {
        images.push({
          url: src,
          alt: $(img).attr('alt') || `Trang ${i + 1}`,
          index: i + 1,
        });
      }
    });

    return images;
  } catch {
    return [];
  }
}

/**
 * Main Crawl Runner for All Pages
 */
export async function crawlAllNgontinh(options = {}) {
  const publicDataDir = path.resolve('public', 'data');
  const srcDataDir = path.resolve('src', 'data');

  await fs.mkdir(publicDataDir, { recursive: true });
  await fs.mkdir(srcDataDir, { recursive: true });

  const outputFile = path.join(publicDataDir, 'ngontinh_manga.json');
  const srcOutputFile = path.join(srcDataDir, 'ngontinh_manga.json');

  // Load existing comics to resume/update
  let existingMap = new Map();
  try {
    const raw = await fs.readFile(outputFile, 'utf-8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        existingMap.set(item.slug, item);
      }
    }
  } catch {}

  console.log(`[INIT] Đã nạp ${existingMap.size} truyện có sẵn từ bộ nhớ đệm.`);

  const maxTotalPages = await detectTotalPages();
  const pagesToCrawl = options.maxPages || maxTotalPages;

  console.log(`=== BẮT ĐẦU CÀO TOÀN BỘ TRUYỆN NGÔN TÌNH TỪ NETTRUYENZ.COM (${pagesToCrawl} TRANG) ===\n`);

  // Step 1: Collect Comic Links from all pages
  let allComicsList = [];
  for (let p = 1; p <= pagesToCrawl; p++) {
    try {
      const items = await scrapeCategoryPage(p);
      console.log(`[TRANG ${p}/${pagesToCrawl}] Tìm thấy ${items.length} truyện`);
      allComicsList.push(...items);
      await sleep(CONFIG.delayMs);
    } catch (e) {
      console.error(`Lỗi tải danh mục trang ${p}:`, e.message);
    }
  }

  allComicsList = uniqueBy(allComicsList, c => c.slug);
  console.log(`\n Tổng số truyện đã tổng hợp: ${allComicsList.length} bộ truyện.`);

  const comicsMap = new Map(existingMap);
  let processedCount = 0;
  let saveCounter = 0;

  const saveProgress = async () => {
    const list = Array.from(comicsMap.values());
    const jsonStr = JSON.stringify(list, null, 2);
    await fs.writeFile(outputFile, jsonStr, 'utf-8');
    await fs.writeFile(srcOutputFile, jsonStr, 'utf-8');

    // Update hot list
    const hotData = {
      updatedAt: new Date().toISOString(),
      hot: list.slice(0, 30).map((m, idx) => ({
        rank: idx + 1,
        slug: m.slug,
        title: m.title,
        cover: m.cover,
        url: m.url,
        latestChapter: m.chapters[0]?.name || '',
        views: m.views,
      })),
      top_day: list.slice(10, 35).map((m, idx) => ({
        rank: idx + 1,
        slug: m.slug,
        title: m.title,
        cover: m.cover,
        url: m.url,
        latestChapter: m.chapters[0]?.name || '',
        views: m.views,
      })),
      top_week: list.slice(5, 30).map((m, idx) => ({
        rank: idx + 1,
        slug: m.slug,
        title: m.title,
        cover: m.cover,
        url: m.url,
        latestChapter: m.chapters[0]?.name || '',
        views: m.views,
      })),
      top_month: list.slice(0, 25).map((m, idx) => ({
        rank: idx + 1,
        slug: m.slug,
        title: m.title,
        cover: m.cover,
        url: m.url,
        latestChapter: m.chapters[0]?.name || '',
        views: m.views,
      })),
    };
    await fs.writeFile(path.join(publicDataDir, 'ngontinh_hot.json'), JSON.stringify(hotData, null, 2), 'utf-8');
    await fs.writeFile(path.join(srcDataDir, 'ngontinh_hot.json'), JSON.stringify(hotData, null, 2), 'utf-8');
  };

  // Process worker pool for maximum speed & stability
  const queue = [...allComicsList];

  async function worker(workerId) {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      processedCount++;
      const currentIdx = processedCount;

      // If already has chapters, skip or refresh
      const existing = comicsMap.get(item.slug);
      if (existing && existing.chapters && existing.chapters.length > 0 && existing.chapters[0]?.images?.length) {
        // Already fully detailed
        continue;
      }

      console.log(`[Worker ${workerId}] [${currentIdx}/${allComicsList.length}] ${item.title} (${item.slug})`);

      const detail = await scrapeComicDetail(item);

      // Preload images for latest 2 chapters and chapter 1
      if (detail.chapters && detail.chapters.length > 0) {
        const chaptersToFetch = [];
        if (detail.chapters.length > 0) chaptersToFetch.push(detail.chapters[0]);
        if (detail.chapters.length > 1) chaptersToFetch.push(detail.chapters[1]);
        const firstChapter = detail.chapters[detail.chapters.length - 1];
        if (firstChapter && !chaptersToFetch.some(c => c.url === firstChapter.url)) {
          chaptersToFetch.push(firstChapter);
        }

        for (const ch of chaptersToFetch) {
          if (ch.url) {
            const imgs = await scrapeChapterImages(ch.url);
            ch.images = imgs;
            ch.imageCount = imgs.length;
            await sleep(100);
          }
        }
      }

      comicsMap.set(detail.slug, detail);
      saveCounter++;

      if (saveCounter % 8 === 0 || queue.length === 0) {
        await saveProgress();
        console.log(`--> [LƯU TIẾN ĐỘ] Đã lưu ${comicsMap.size} bộ truyện vào ngontinh_manga.json`);
      }

      await sleep(CONFIG.delayMs);
    }
  }

  // Launch parallel workers
  const workers = Array.from({ length: CONFIG.concurrency }, (_, idx) => worker(idx + 1));
  await Promise.all(workers);

  await saveProgress();
  console.log(`\n HOÀN TẤT CÀO TOÀN BỘ! Đã lưu thành công ${comicsMap.size} bộ truyện ngôn tình.`);
}

// If run directly
if (process.argv[1]?.endsWith('crawl_ngontinh.js')) {
  const maxPages = parseInt(process.argv[2], 10) || 114; // Default to all 114 pages (~2,700 stories)
  crawlAllNgontinh({ maxPages }).catch(console.error);
}
