/**
 * crawl_bl_images.cjs
 * Cào chi tiết ảnh cho từng chapter từ dualeotruyencw.com
 * Tự động bỏ qua các chapter / manga đã có ảnh
 * Lưu an toàn chống file lock trên Windows
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve('public/data/bl_manga.json');
const SRC_DATA_PATH = path.resolve('src/data/bl_manga.json');
const BASE = 'https://dualeotruyencw.com';
const SAVE_EVERY = 5; // lưu mỗi 5 manga đã xong
const DELAY_BETWEEN_CHAPTERS = 250; // ms
const DELAY_BETWEEN_MANGA = 500; // ms
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function get(url, retry = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': BASE + '/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location, retry));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    });

    req.on('error', async (err) => {
      if (retry < MAX_RETRIES) {
        await sleep(1000 * (retry + 1));
        return resolve(get(url, retry + 1));
      }
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      if (retry < MAX_RETRIES) {
        sleep(1000 * (retry + 1)).then(() => resolve(get(url, retry + 1)));
      } else {
        reject(new Error(`Timeout: ${url}`));
      }
    });
  });
}

function extractImages(html) {
  const imgTags = [...html.matchAll(/<img[^>]+>/gi)];
  const images = [];
  const seen = new Set();

  for (const tag of imgTags) {
    const tagStr = tag[0];

    // Ưu tiên data-img (Dưa Leo lazy-load), sau đó data-src, data-original, src
    const dataImgMatch = tagStr.match(/data-img=["']([^"']+)["']/i);
    const dataSrcMatch = tagStr.match(/data-src=["']([^"']+)["']/i);
    const dataOrigMatch = tagStr.match(/data-original=["']([^"']+)["']/i);
    const srcMatch = tagStr.match(/\bsrc=["']([^"']+)["']/i);

    const raw =
      (dataImgMatch && dataImgMatch[1]) ||
      (dataSrcMatch && dataSrcMatch[1]) ||
      (dataOrigMatch && dataOrigMatch[1]) ||
      (srcMatch && srcMatch[1]) ||
      null;

    if (!raw) continue;
    const clean = raw.trim();

    // Bỏ qua ảnh rác
    if (
      clean.startsWith('data:') ||
      clean.includes('dualeotruyen.png') ||
      clean.includes('/skin/css/') ||
      clean.includes('load.gif') ||
      clean.includes('logo') ||
      clean.includes('/avatar') ||
      clean.includes('favicon')
    ) continue;

    // Chỉ lấy ảnh từ CDN nội dung
    if (
      clean.includes('imgdualeo') ||
      clean.includes('cdn') ||
      clean.includes('/uploads/') ||
      clean.includes('/upbia/') ||
      clean.includes('part') ||
      (clean.match(/\.(webp|jpg|jpeg|png)/i) && !clean.includes('/skin/'))
    ) {
      if (!seen.has(clean)) {
        seen.add(clean);
        images.push({
          page: images.length + 1,
          src: clean,
          fallbackSrc: clean,
        });
      }
    }
  }

  return images;
}

async function scrapeChapterImages(chapterUrl) {
  try {
    const { status, html } = await get(chapterUrl);
    if (status !== 200) return [];
    return extractImages(html);
  } catch (e) {
    return [];
  }
}

function safeWrite(filePath, dataStr) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, dataStr, 'utf8');
      fs.copyFileSync(tempPath, filePath);
      try { fs.unlinkSync(tempPath); } catch (_) {}
      return;
    } catch (e) {
      if (attempt === 5) {
        console.error(`⚠️ Không thể ghi file ${filePath} sau 5 lần thử: ${e.message}`);
      } else {
        const wait = attempt * 300;
        const now = Date.now();
        while (Date.now() - now < wait) {} // sync busy wait
      }
    }
  }
}

function saveData(data) {
  const jsonStr = JSON.stringify(data, null, 2);
  safeWrite(DATA_PATH, jsonStr);
  safeWrite(SRC_DATA_PATH, jsonStr);
}

async function main() {
  console.log('📖 Đọc dữ liệu bl_manga.json...');
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const allManga = JSON.parse(raw);
  console.log(`📚 Tổng số bộ truyện: ${allManga.length}`);

  const mangaDone = allManga.filter(m =>
    m.chapters && m.chapters.length > 0 &&
    m.chapters.every(c => c.images && c.images.length > 0)
  ).length;

  const mangaNeedCrawl = allManga.filter(m =>
    m.chapters && m.chapters.length > 0 &&
    m.chapters.some(c => !c.images || c.images.length === 0)
  );

  console.log(`✅ Đã hoàn thành sẵn: ${mangaDone} bộ`);
  console.log(`🔍 Số bộ truyện còn cần cào: ${mangaNeedCrawl.length} bộ`);

  let totalMangaDone = 0;
  let totalChaptersDone = 0;
  let totalImagesFound = 0;

  for (let mi = 0; mi < allManga.length; mi++) {
    const manga = allManga[mi];
    if (!manga.chapters || manga.chapters.length === 0) continue;

    const chapsNeedFetch = manga.chapters.filter(c => !c.images || c.images.length === 0);
    if (chapsNeedFetch.length === 0) continue;

    console.log(`\n[${mi + 1}/${allManga.length}] 📕 ${manga.title} (${chapsNeedFetch.length}/${manga.chapters.length} chương cần cào)`);

    let mangaUpdated = false;
    for (const ch of chapsNeedFetch) {
      const chUrl = ch.url;
      if (!chUrl) continue;

      try {
        const images = await scrapeChapterImages(chUrl);

        const chIdx = manga.chapters.findIndex(c => c.url === chUrl);
        if (chIdx !== -1) {
          manga.chapters[chIdx].images = images;
          manga.chapters[chIdx].imageCount = images.length;
        }

        if (images.length > 0) {
          process.stdout.write(`  ✅ Chapter "${ch.name || ch.title || 'N/A'}": ${images.length} ảnh\n`);
          totalImagesFound += images.length;
        } else {
          process.stdout.write(`  ⚠️ Chapter "${ch.name || ch.title || 'N/A'}": Không có ảnh\n`);
        }

        totalChaptersDone++;
        mangaUpdated = true;
        await sleep(DELAY_BETWEEN_CHAPTERS);
      } catch (e) {
        console.error(`  ❌ Lỗi chapter ${ch.url}: ${e.message}`);
      }
    }

    if (mangaUpdated) {
      totalMangaDone++;
    }

    // Lưu định kỳ mỗi SAVE_EVERY manga
    if (totalMangaDone > 0 && totalMangaDone % SAVE_EVERY === 0) {
      saveData(allManga);
      console.log(`\n💾 Đã lưu an toàn (${totalMangaDone} manga mới, ${totalChaptersDone} chapter, ${totalImagesFound} ảnh)...`);
    }

    await sleep(DELAY_BETWEEN_MANGA);
  }

  saveData(allManga);
  console.log(`\n🎉 HOÀN TẤT TOÀN BỘ KHO TRUYỆN!`);
}

main().catch(e => {
  console.error('Fatal error:', e);
});
