import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const SCHOOL_LIFE_FILE = path.resolve('public/data/school_life_manga.json');
const NGONTINH_FILE = path.resolve('public/data/ngontinh_manga.json');
const CONCURRENCY = 10;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeWriteJson(filePath, data) {
  const jsonStr = JSON.stringify(data);
  for (let i = 0; i < 5; i++) {
    try {
      writeFileSync(filePath, jsonStr, 'utf-8');
      return;
    } catch (e) {
      if (i === 4) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i < retries - 1) await sleep(400 * (i + 1));
    }
  }
  return null;
}

export async function crawlSchoolLifeMissing(limit = 100) {
  console.log('=== TIẾP TỤC CÀO TRUYỆN THANH XUÂN VƯỜN TRƯỜNG / HỌC ĐƯỜNG ===');
  
  let list = [];
  try {
    const raw = await fs.readFile(SCHOOL_LIFE_FILE, 'utf-8');
    list = JSON.parse(raw);
  } catch (err) {
    console.error('Không thể đọc file school_life_manga.json:', err.message);
    return;
  }

  console.log(`Tổng số truyện School Life / Học Đường: ${list.length}`);

  let updatedComicsCount = 0;
  let totalNewChapters = 0;

  for (let idx = 0; idx < list.length; idx++) {
    const manga = list[idx];
    const chapters = manga.chapters || [];
    
    // Check if manga has chapters with missing images
    const missingChapters = chapters.filter(c => !c.images || c.images.length === 0);
    if (missingChapters.length === 0) continue;

    console.log(`\n[${idx + 1}/${list.length}] Đang cào: "${manga.title}" (${missingChapters.length}/${chapters.length} chap còn thiếu ảnh)`);

    // Fetch OTruyen API for this manga
    const otruyenData = await fetchJson(`https://otruyenapi.com/v1/api/truyen-tranh/${manga.slug}`);
    const serverData = otruyenData?.data?.item?.chapters?.[0]?.server_data || [];
    
    if (serverData.length === 0) {
      console.log(`  -> Chưa có dữ liệu trên OTruyen API, bỏ qua.`);
      continue;
    }

    const serverDataMap = new Map();
    for (const item of serverData) {
      const num = parseFloat(item.chapter_name);
      if (!isNaN(num)) {
        serverDataMap.set(num, item.chapter_api_data);
      }
    }

    let fetchedForManga = 0;

    // Fetch chapters in batches
    const toFetch = chapters.filter(c => (!c.images || c.images.length === 0) && serverDataMap.has(c.number));
    
    for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
      const batch = toFetch.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (ch) => {
        const apiUrl = serverDataMap.get(ch.number);
        if (!apiUrl) return;
        const chData = await fetchJson(apiUrl);
        if (chData && chData.data?.item) {
          const domain = chData.data.domain_cdn || '';
          const chPath = chData.data.item.chapter_path || '';
          const imgList = chData.data.item.chapter_image || [];
          if (imgList.length > 0) {
            ch.images = imgList.map((img, pageIdx) => ({
              url: `${domain}/${chPath}/${img.image_file}`,
              alt: `Trang ${pageIdx + 1}`,
              index: pageIdx + 1,
            }));
            ch.imageCount = imgList.length;
            fetchedForManga++;
            totalNewChapters++;
          }
        }
      }));
      await sleep(60);
    }

    if (fetchedForManga > 0) {
      updatedComicsCount++;
      console.log(`  -> Đã nạp thành công ${fetchedForManga} chapters cho "${manga.title}"!`);
      
      // Save every 10 updated comics
      if (updatedComicsCount % 10 === 0) {
        await safeWriteJson(SCHOOL_LIFE_FILE, list);
        console.log(`  [ĐÃ LƯU TIẾN ĐỘ] Đã cập nhật xong ${updatedComicsCount} bộ truyện.`);
      }
    }

    if (limit && updatedComicsCount >= limit) {
      console.log(`Đã đạt giới hạn ${limit} bộ truyện trong đợt cào này.`);
      break;
    }
  }

  // Final save for school_life_manga.json
  await safeWriteJson(SCHOOL_LIFE_FILE, list);

  // Sync to ngontinh_manga.json if they exist there
  try {
    const rawNgontinh = await fs.readFile(NGONTINH_FILE, 'utf-8');
    const ngontinhList = JSON.parse(rawNgontinh);
    const schoolLifeMap = new Map(list.map(m => [m.slug, m]));
    let ngontinhUpdated = 0;

    for (const nt of ngontinhList) {
      const sl = schoolLifeMap.get(nt.slug);
      if (sl && sl.chapters) {
        const slChapMap = new Map(sl.chapters.filter(c => c.images && c.images.length > 0).map(c => [c.number, c.images]));
        let chapsSynced = 0;
        for (const c of nt.chapters || []) {
          if ((!c.images || c.images.length === 0) && slChapMap.has(c.number)) {
            c.images = slChapMap.get(c.number);
            c.imageCount = c.images.length;
            chapsSynced++;
          }
        }
        if (chapsSynced > 0) ngontinhUpdated++;
      }
    }

    if (ngontinhUpdated > 0) {
      await safeWriteJson(NGONTINH_FILE, ngontinhList);
      console.log(`- Đã đồng bộ thêm cho ${ngontinhUpdated} bộ truyện trong ngontinh_manga.json.`);
    }
  } catch (err) {
    console.warn('Lỗi khi đồng bộ sang ngontinh_manga.json:', err.message);
  }

  console.log(`\n=== HOÀN TẤT ĐỢT CÀO THANH XUÂN VƯỜN TRƯỜNG ===`);
  console.log(`- Đã cập nhật ảnh cho ${updatedComicsCount} bộ truyện.`);
  console.log(`- Tổng số chương mới nạp ảnh: ${totalNewChapters} chương.`);
}

crawlSchoolLifeMissing(100).catch(console.error);
