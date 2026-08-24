import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';

const BASE = 'https://dualeotruyencw.com';

const CONFIG = {
  delayMs: 300,
  retry: 3,
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

async function get(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Referer': BASE,
      },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function scrapeHotCategory(pathUrl) {
  const url = `${BASE}${pathUrl}`;
  console.log(`[SCRAPE HOT] ${url}`);
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

    if (!result.some(x => x.slug === slug)) {
      result.push({
        rank: result.length + 1,
        slug,
        title: title.replace(/\s+/g, ' '),
        cover: cover ? absoluteUrl(cover) : null,
        url: fullUrl,
      });
    }
  });

  return result;
}

export async function updateHotData() {
  console.log('🔥 Bắt đầu cào dữ liệu truyện HOT và TOP bảng xếp hạng từ dualeotruyen...');
  
  const [hotList, topDay, topWeek, topMonth] = await Promise.all([
    scrapeHotCategory('/truyen-tranh-hot'),
    scrapeHotCategory('/top-ngay'),
    scrapeHotCategory('/top-tuan'),
    scrapeHotCategory('/top-thang'),
  ]);

  const hotData = {
    updatedAt: new Date().toISOString(),
    hot: hotList,
    top_day: topDay,
    top_week: topWeek,
    top_month: topMonth,
  };

  await fs.mkdir('public/data', { recursive: true });
  await fs.writeFile('public/data/bl_hot_manga.json', JSON.stringify(hotData, null, 2), 'utf8');


  console.log(`✅ Đã lưu dữ liệu HOT:`);
  console.log(`   - Truyện Hot: ${hotList.length} truyện`);
  console.log(`   - Top Ngày: ${topDay.length} truyện`);
  console.log(`   - Top Tuần: ${topWeek.length} truyện`);
  console.log(`   - Top Tháng: ${topMonth.length} truyện`);

  // Merge hot rank into existing bl_manga.json
  try {
    const raw = await fs.readFile('public/data/bl_manga.json', 'utf8');
    const allManga = JSON.parse(raw);
    const hotSlugSet = new Set(hotList.map(h => h.slug));
    const topDayMap = new Map(topDay.map(t => [t.slug, t.rank]));
    const topWeekMap = new Map(topWeek.map(t => [t.slug, t.rank]));
    const topMonthMap = new Map(topMonth.map(t => [t.slug, t.rank]));
    const hotMap = new Map(hotList.map(t => [t.slug, t.rank]));

    const updatedManga = allManga.map(m => {
      return {
        ...m,
        isHot: hotSlugSet.has(m.slug),
        hotRank: hotMap.get(m.slug) ?? null,
        topDayRank: topDayMap.get(m.slug) ?? null,
        topWeekRank: topWeekMap.get(m.slug) ?? null,
        topMonthRank: topMonthMap.get(m.slug) ?? null,
      };
    });

    await fs.writeFile('public/data/bl_manga.json', JSON.stringify(updatedManga, null, 2), 'utf8');
    console.log(`⚡ Đã đồng bộ thông tin rank HOT vào toàn bộ ${updatedManga.length} bộ truyện!`);
  } catch (err) {
    console.error('Error syncing hot info to bl_manga.json:', err);
  }
}

if (process.argv[1]?.endsWith('scrape_hot_manga.js')) {
  updateHotData().catch(console.error);
}
