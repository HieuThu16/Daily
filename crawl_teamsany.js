import { execFile } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const BASE_URL = 'https://teamsany.com';
const OUTPUT_DATA_FILE = path.join(process.cwd(), 'public', 'data', 'teamsany_manga.json');
const OUTPUT_HOT_FILE = path.join(process.cwd(), 'public', 'data', 'teamsany_hot.json');

const CONFIG = {
  detailConcurrency: 8,
  imageConcurrency: 12,
  timeoutMs: 15000,
  maxRetries: 3,
};

async function curlGet(url, attempt = 1) {
  for (let i = attempt; i <= CONFIG.maxRetries; i++) {
    try {
      const { stdout } = await execFileAsync('curl.exe', [
        '-s', '-L',
        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '-H', 'Referer: https://teamsany.com/',
        url
      ], { maxBuffer: 15 * 1024 * 1024, timeout: CONFIG.timeoutMs });

      if (stdout && stdout.length > 300) {
        return stdout;
      }
    } catch (err) {
      if (i === CONFIG.maxRetries) {
        return null;
      }
    }
  }
  return null;
}

// Simple worker pool for concurrency
async function asyncPool(limit, items, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item, items));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

/**
 * Step 1: Discover all manga series from all listing pages
 */
async function scrapeAllListing() {
  console.log('🔍 [Phase 1/4] Scanning all manga catalog pages on Teamsany.com...');
  const mangaMap = new Map();
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 50) {
    const pageUrl = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    const html = await curlGet(pageUrl);
    if (!html) break;

    const $ = cheerio.load(html);
    let newItemsCount = 0;

    $('.animepost, .animposx').each((_, el) => {
      const a = $(el).is('a') ? $(el) : $(el).find('a').first();
      const href = a.attr('href');
      if (href && href.includes('/manga/')) {
        const slug = href.replace(/^https?:\/\/teamsany\.com\/manga\//, '').replace(/\/$/, '');
        let title = $(el).find('.tt, h4, h3, .title').text().trim() || a.attr('title') || slug;
        title = title.replace(/^Đăng Nhập\s+/i, '').trim();
        let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
        if (img && img.startsWith('//')) img = 'https:' + img;
        const status = $(el).find('.status, .bt .status').text().trim();
        const type = $(el).find('.type, .bt .type').text().trim() || 'Manhwa';

        if (slug && !mangaMap.has(slug)) {
          mangaMap.set(slug, {
            slug,
            title,
            url: href,
            cover: img || null,
            status: status || 'Đang tiến hành',
            type,
          });
          newItemsCount++;
        }
      }
    });

    console.log(`  Page ${page}: found ${newItemsCount} new items (Total accumulated: ${mangaMap.size})`);

    const hasNextPage = $(`a[href*="/page/${page + 1}/"]`).length > 0;
    if (newItemsCount === 0 || !hasNextPage) {
      console.log(`✅ Catalog scan complete at page ${page}. Total manga discovered: ${mangaMap.size}`);
      hasMore = false;
    } else {
      page++;
    }
  }

  return Array.from(mangaMap.values());
}

/**
 * Step 2: Scrape single manga detail & chapter links
 */
async function scrapeMangaDetail(item) {
  const html = await curlGet(item.url);
  if (!html) {
    return {
      ...item,
      description: '',
      genres: ['Boylove', 'Đam Mỹ', 'Manhwa'],
      chapters: [],
      totalChapters: 0,
      source: 'teamsany',
      sourceName: 'Sany Team',
    };
  }

  const $ = cheerio.load(html);

  let title = $('h1.entry-title').text().trim() || $('.post-title').text().trim() || item.title;
  title = title.replace(/^Đăng Nhập\s+/i, '').trim();

  let cover = $('.thumb img').attr('src') || $('.thumb img').attr('data-src') || $('.summary_image img').attr('src') || item.cover;
  if (cover && cover.startsWith('//')) cover = 'https:' + cover;

  const description = $('.entry-content, .description-summary, .summary__content').text().trim();

  const genres = [];
  $('.genres-content a, .mgen a, .seriestugenre a, .genre a').each((_, a) => {
    const g = $(a).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });
  if (!genres.includes('Boylove') && !genres.includes('Đam Mỹ')) {
    genres.unshift('Boylove', 'Đam Mỹ');
  }

  let status = item.status || 'Đang tiến hành';
  let author = '';
  let artist = '';
  let type = item.type || 'Manhwa';

  $('.tsinfo .imptdt, .spe span, .infox .spe span, .infox .spe').each((_, el) => {
    const text = $(el).text().trim();
    if (/Tình Trạng|Status/i.test(text)) {
      status = text.replace(/Tình Trạng|Status|:/gi, '').trim();
    }
    if (/Tác Giả|Author/i.test(text)) {
      author = text.replace(/Tác Giả|Author|:/gi, '').trim();
    }
    if (/Họa Sĩ|Artist/i.test(text)) {
      artist = text.replace(/Họa Sĩ|Artist|:/gi, '').trim();
    }
    if (/Type|Thể Loại/i.test(text)) {
      type = text.replace(/Type|Thể Loại|:/gi, '').trim();
    }
  });

  const chapters = [];
  const seenUrls = new Set();

  $('.lchx a, .epsleft a, .bxcl li a, #chapterlist li a, .eplister li a, .cl li a').each((_, a) => {
    const chapUrl = $(a).attr('href');
    const chapName = $(a).text().trim();
    if (chapUrl && !seenUrls.has(chapUrl) && (chapUrl.includes('chap') || chapUrl.includes('chuong') || chapUrl.includes(item.slug) || /\d+/.test(chapName))) {
      seenUrls.add(chapUrl);

      let num = null;
      const match = chapName.match(/chap(?:ter)?[\s\-_]*(\d+(?:\.\d+)?)/i) || 
                    chapUrl.match(/chap(?:ter)?[\s\-_]*(\d+(?:\.\d+)?)/i) ||
                    chapName.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        num = parseFloat(match[1]);
      }

      chapters.push({
        number: num,
        name: chapName || `Chapter ${num ?? (chapters.length + 1)}`,
        url: chapUrl,
        images: [],
        imageCount: 0
      });
    }
  });

  return {
    slug: item.slug,
    title,
    cover,
    description,
    genres: genres.length > 0 ? genres : ['Boylove', 'Đam Mỹ', 'Manhwa'],
    url: item.url,
    status: status || 'Đang tiến hành',
    author: author || undefined,
    artist: artist || undefined,
    type: type || 'Manhwa',
    source: 'teamsany',
    sourceName: 'Sany Team',
    chapters,
    totalChapters: chapters.length,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Step 3: Scrape chapter images
 */
async function scrapeChapterImages(chapUrl) {
  const html = await curlGet(chapUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const images = [];

  $('script').each((_, s) => {
    const text = $(s).html() || '';
    const match = text.match(/ch_image\s*=\s*\$\.reader\(\s*(\{[\s\S]*?\})\s*\)/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed && parsed.array) {
          Object.values(parsed.array).forEach((it, idx) => {
            if (it && it.image) {
              let imgUrl = it.image.replace(/\\\//g, '/');
              if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
              images.push({
                url: imgUrl,
                index: idx + 1,
                alt: `Trang ${idx + 1}`
              });
            }
          });
        }
      } catch {}
    }
  });

  if (images.length === 0) {
    $('.reader-area img, #readerarea img, .reading-content img').each((idx, img) => {
      let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src') || $(img).attr('data-cfsrc');
      if (src && !src.includes('banner') && !src.includes('ads') && !src.includes('logo') && !src.includes('avatar')) {
        if (src.startsWith('//')) src = 'https:' + src;
        images.push({
          url: src.trim(),
          index: idx + 1,
          alt: `Trang ${idx + 1}`
        });
      }
    });
  }

  return images;
}

/**
 * Main Crawler Function
 */
async function run() {
  const startTime = Date.now();
  console.log('====================================================');
  console.log('🚀 SANY TEAM (teamsany.com) COMPREHENSIVE CRAWLER');
  console.log('====================================================\n');

  await fs.mkdir(path.join(process.cwd(), 'public', 'data'), { recursive: true });

  // 1. Discover all series
  const listingItems = await scrapeAllListing();
  console.log(`\n📋 Found ${listingItems.length} manga series to process.`);

  // 2. Fetch all details concurrently
  console.log(`\n📖 [Phase 2/4] Crawling details & chapter lists (Concurrency: ${CONFIG.detailConcurrency})...`);
  let detailCount = 0;
  const mangaList = await asyncPool(CONFIG.detailConcurrency, listingItems, async (item) => {
    const detail = await scrapeMangaDetail(item);
    detailCount++;
    if (detailCount % 20 === 0 || detailCount === listingItems.length) {
      console.log(`  Progress: ${detailCount}/${listingItems.length} series fetched (${Math.round(detailCount / listingItems.length * 100)}%)`);
    }
    return detail;
  });

  // Save base manga dataset
  await fs.writeFile(OUTPUT_DATA_FILE, JSON.stringify(mangaList, null, 2), 'utf-8');
  console.log(`💾 Saved base catalog to ${OUTPUT_DATA_FILE}`);

  // 3. Crawl Chapter Images concurrently
  // Collect all chapters across all series
  const allChapterTasks = [];
  mangaList.forEach((manga) => {
    manga.chapters.forEach((chap) => {
      allChapterTasks.push({ manga, chap });
    });
  });

  console.log(`\n🖼️ [Phase 3/4] Fetching images for ${allChapterTasks.length} total chapters (Concurrency: ${CONFIG.imageConcurrency})...`);
  let finishedChaps = 0;
  let lastSave = Date.now();

  await asyncPool(CONFIG.imageConcurrency, allChapterTasks, async ({ chap }) => {
    if (!chap.images || chap.images.length === 0) {
      const imgs = await scrapeChapterImages(chap.url);
      chap.images = imgs;
      chap.imageCount = imgs.length;
    }
    finishedChaps++;

    if (finishedChaps % 100 === 0 || finishedChaps === allChapterTasks.length) {
      const pct = Math.round((finishedChaps / allChapterTasks.length) * 100);
      console.log(`  Images progress: ${finishedChaps}/${allChapterTasks.length} chapters (${pct}%)`);
    }

    // Auto-save every 20 seconds or on finish
    if (Date.now() - lastSave > 20000 || finishedChaps === allChapterTasks.length) {
      lastSave = Date.now();
      await fs.writeFile(OUTPUT_DATA_FILE, JSON.stringify(mangaList, null, 2), 'utf-8');
    }
  });

  // Final save of manga dataset
  await fs.writeFile(OUTPUT_DATA_FILE, JSON.stringify(mangaList, null, 2), 'utf-8');
  console.log(`💾 Final manga dataset saved to ${OUTPUT_DATA_FILE}`);

  // 4. Generate Hot & Ranking Data
  console.log('\n🔥 [Phase 4/4] Building Hot & Trending Ranking data...');
  const sortedManga = [...mangaList].sort((a, b) => (b.totalChapters || 0) - (a.totalChapters || 0));
  const hotItems = sortedManga.slice(0, 30).map((m, idx) => ({
    rank: idx + 1,
    slug: m.slug,
    title: m.title,
    cover: m.cover,
    url: m.url,
    latestChapter: m.chapters[0]?.name || `${m.totalChapters} Chương`
  }));

  const hotData = {
    updatedAt: new Date().toISOString(),
    hot: hotItems,
    top_day: hotItems.slice(0, 10),
    top_week: hotItems.slice(0, 15),
    top_month: hotItems.slice(0, 20)
  };

  await fs.writeFile(OUTPUT_HOT_FILE, JSON.stringify(hotData, null, 2), 'utf-8');
  console.log(`💾 Hot manga rankings saved to ${OUTPUT_HOT_FILE}`);

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('\n====================================================');
  console.log(`🎉 CRAWL COMPLETED in ${totalTime}s!`);
  console.log(`📊 Total Series: ${mangaList.length}`);
  console.log(`📑 Total Chapters Processed: ${allChapterTasks.length}`);
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('Crawler failed with error:', err);
  process.exit(1);
});
