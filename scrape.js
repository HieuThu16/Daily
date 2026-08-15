import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';

const BASE = 'https://dualeotruyencw.com';

const CONFIG = {
  delayMs: 1000,
  retry: 3,
  retryDelayMs: 2000,
  timeoutMs: 15000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/* =========================================================
 * Utils
 * ======================================================= */

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

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/* =========================================================
 * HTTP
 * ======================================================= */

async function get(url, attempt = 1) {
  let lastError;

  for (let i = attempt; i <= CONFIG.retry; i++) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, CONFIG.timeoutMs);

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (i < CONFIG.retry) {
        const delay = CONFIG.retryDelayMs * i;

        console.warn(
          `[retry ${i}/${CONFIG.retry}] ${url} -> ${error.message}`
        );

        await sleep(delay);
      }
    }
  }

  throw new Error(`Request failed: ${url}\n${lastError?.message}`);
}

/* =========================================================
 * LIST
 * ======================================================= */

/**
 * Crawl một trang danh sách.
 *
 * Ví dụ:
 * scrapeList('/truyen-moi-cap-nhat', 1)
 * scrapeList('/the-loai/boylove', 1)
 * scrapeList('/the-loai/bl', 1)
 */
export async function scrapeList(path, page = 1) {
  const url = path.includes('?') ? `${BASE}${path}&page=${page}` : `${BASE}${path}?page=${page}`;

  console.log(`[LIST] page=${page} ${url}`);

  const html = await get(url);
  const $ = cheerio.load(html);

  const result = [];

  $('a[href*="/truyen-tranh/"]').each((_, a) => {
    const href = $(a).attr('href');

    if (!href) return;

    // Bỏ link chapter
    if (/\/chapter-/i.test(href)) {
      return;
    }

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
      $(a).text().trim();

    if (!slug || !title) return;

    result.push({
      slug,
      title,
      cover: cover ? absoluteUrl(cover, fullUrl) : null,
      url: fullUrl,
    });
  });

  return uniqueBy(result, x => x.slug);
}

/* =========================================================
 * CRAWL LIST PAGES
 * ======================================================= */

export async function crawlList(path, pages = 1) {
  const all = [];

  for (let page = 1; page <= pages; page++) {
    try {
      const items = await scrapeList(path, page);

      console.log(
        `[LIST] page=${page}: ${items.length} truyện`
      );

      all.push(...items);
    } catch (error) {
      console.error(
        `[LIST ERROR] page=${page}: ${error.message}`
      );
    }

    if (page < pages) {
      await sleep(CONFIG.delayMs);
    }
  }

  return uniqueBy(all, x => x.slug);
}

/* =========================================================
 * DETAIL
 * ======================================================= */

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

  $(`a[href*="/truyen-tranh/${slug}/chapter-"]`)
    .each((_, a) => {
      const href = $(a).attr('href');

      if (!href) return;

      const chapterUrl = absoluteUrl(href, url);

      if (!chapterUrl) return;

      const match = chapterUrl.match(
        /\/chapter-(\d+(?:\.\d+)?)\/?$/
      );

      const number = match
        ? Number(match[1])
        : null;

      chapters.push({
        number,
        name: $(a).text().trim(),
        url: chapterUrl,
      });
    });

  const uniqueChapters = uniqueBy(
    chapters,
    x => x.url
  );

  return {
    slug,
    title:
      $('h1').first().text().trim() ||
      $('title').first().text().trim(),
    description:
      $('meta[name="description"]').attr('content')?.trim() ||
      $('.story-detail-info, .detail-content, .summary').text().trim() ||
      '',
    genres: [...new Set(genres)],
    url,
    chapters: uniqueChapters,
  };
}

/* =========================================================
 * CHAPTER
 * ======================================================= */

export async function scrapeChapter(slug, chapterNumber) {
  const url =
    `${BASE}/truyen-tranh/${slug}/chapter-${chapterNumber}`;

  console.log(
    `[CHAPTER] ${slug} #${chapterNumber}`
  );

  const html = await get(url);
  const $ = cheerio.load(html);

  const images = [];

  // Tìm trong các container chính của manga reader nếu có
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

    // Bỏ placeholder/loading/logo/avatar/base64
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

  const uniqueImages = uniqueBy(
    images,
    x => x.url
  ).map((image, index) => ({
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

/* =========================================================
 * FULL BOOK
 * ======================================================= */

export async function scrapeFull(
  slug,
  {
    crawlImages = true,
    maxChapters = null,
  } = {}
) {
  const detail = await scrapeDetail(slug);

  const chaptersToScrape = maxChapters 
    ? detail.chapters.slice(0, maxChapters) 
    : detail.chapters;

  const chapters = [];

  for (let i = 0; i < chaptersToScrape.length; i++) {
    const chapter = chaptersToScrape[i];

    if (chapter.number == null) {
      console.warn(
        `[SKIP] Không xác định được chapter number: ${chapter.url}`
      );
      continue;
    }

    let data = {
      ...chapter,
      images: [],
      imageCount: 0,
    };

    if (crawlImages) {
      try {
        const parsed = await scrapeChapter(
          slug,
          chapter.number
        );

        data = {
          ...data,
          ...parsed,
        };
      } catch (error) {
        console.error(
          `[CHAPTER ERROR] ${slug} #${chapter.number}: ${error.message}`
        );
      }
    }

    chapters.push(data);

    if (i < chaptersToScrape.length - 1) {
      await sleep(CONFIG.delayMs);
    }
  }

  return {
    ...detail,
    chapters,
  };
}

/* =========================================================
 * SAVE JSON
 * ======================================================= */

export async function saveJSON(
  filename,
  data
) {
  await fs.writeFile(
    filename,
    JSON.stringify(data, null, 2),
    'utf8'
  );

  console.log(
    `[SAVE] ${filename}`
  );
}

/* =========================================================
 * TEST RUNNER
 * ======================================================= */

async function main() {
  console.log('🚀 Bắt đầu test cào truyện...');
  
  // 1. Thử lấy danh sách trang chủ hoặc thể loại BL
  console.log('\n--- 1. Scrape danh sách truyện ---');
  // Thử các path phổ biến trên dualeotruyen: /the-loai/boylove hoặc /the-loai/yaoi hoặc /truyen-moi-cap-nhat
  let list = await scrapeList('/the-loai/boylove', 1);
  if (!list.length) {
    console.log('Không thấy truyện ở /the-loai/boylove, thử /the-loai/bl hoặc /truyen-moi-cap-nhat...');
    list = await scrapeList('/the-loai/bl', 1);
  }
  if (!list.length) {
    list = await scrapeList('/truyen-moi-cap-nhat', 1);
  }

  console.log(`Tìm thấy ${list.length} truyện trong list:`);
  console.log(list.slice(0, 5));

  if (list.length > 0) {
    const firstSlug = list[0].slug;
    console.log(`\n--- 2. Scrape chi tiết truyện đầu tiên: ${firstSlug} ---`);
    const detail = await scrapeDetail(firstSlug);
    console.log('Detail:', {
      title: detail.title,
      genres: detail.genres,
      totalChapters: detail.chapters.length,
      firstChapter: detail.chapters[0],
    });

    if (detail.chapters.length > 0 && detail.chapters[0].number != null) {
      console.log(`\n--- 3. Scrape ảnh chapter đầu tiên (#${detail.chapters[0].number}) ---`);
      const chapterData = await scrapeChapter(firstSlug, detail.chapters[0].number);
      console.log(`Tìm thấy ${chapterData.imageCount} ảnh:`);
      console.log(chapterData.images.slice(0, 3));

      console.log('\n--- 4. Test lưu file test_bl_manga.json ---');
      await saveJSON('test_bl_manga.json', {
        detail,
        firstChapterPreview: chapterData,
      });
      console.log('✅ Hoàn tất test cào dữ liệu!');
    }
  }
}

if (process.argv[1]?.endsWith('scrape.js')) {
  main().catch(err => {
    console.error('❌ Lỗi khi chạy scraper:', err);
  });
}
