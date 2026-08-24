import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve('public/data/ngontinh_manga.json');
const SRC_DATA_FILE = path.resolve('data/ngontinh_manga.json');
const CONCURRENCY = 8;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      if (i < retries - 1) await sleep(500 * (i + 1));
    }
  }
  return null;
}

export async function crawlNgontinhMissing(limit = 100) {
  console.log('=== ĐANG NẠP DỮ LIỆU NGÔN TÌNH ===');
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const list = JSON.parse(raw);
  console.log(`Tổng số truyện trong hệ thống: ${list.length}`);

  let updatedComicsCount = 0;
  let totalNewChapters = 0;

  for (let idx = 0; idx < list.length; idx++) {
    const manga = list[idx];
    const chapters = manga.chapters || [];
    
    // Check if manga has chapters with missing images
    const missingChapters = chapters.filter(c => !c.images || c.images.length === 0);
    if (missingChapters.length === 0) continue;

    console.log(`\n[${idx + 1}/${list.length}] Đang xử lý: ${manga.title} (${missingChapters.length}/${chapters.length} chap còn thiếu ảnh)`);

    // Fetch OTruyen API
    const otruyenData = await fetchJson(`https://otruyenapi.com/v1/api/truyen-tranh/${manga.slug}`);
    const serverData = otruyenData?.data?.item?.chapters?.[0]?.server_data || [];
    
    if (serverData.length === 0) {
      console.log(`  -> Không tìm thấy trên OTruyen API, tiếp tục bộ tiếp theo.`);
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
      await sleep(100);
    }

    if (fetchedForManga > 0) {
      updatedComicsCount++;
      console.log(`  -> Đã nạp thành công ${fetchedForManga} chapters cho "${manga.title}"!`);
      
      // Save every 5 updated comics
      if (updatedComicsCount % 5 === 0) {
        const jsonStr = JSON.stringify(list, null, 2);
        await fs.writeFile(DATA_FILE, jsonStr, 'utf-8');
        try {
          await fs.writeFile(SRC_DATA_FILE, jsonStr, 'utf-8');
        } catch {}
        console.log(`  [ĐÃ LƯU TIẾN ĐỘ] Đã cập nhật ${updatedComicsCount} bộ truyện.`);
      }
    }

    if (limit && updatedComicsCount >= limit) {
      console.log(`Đã đạt giới hạn ${limit} bộ truyện trong phiên này.`);
      break;
    }
  }

  // Final save
  const jsonStr = JSON.stringify(list, null, 2);
  await fs.writeFile(DATA_FILE, jsonStr, 'utf-8');
  try {
    await fs.writeFile(SRC_DATA_FILE, jsonStr, 'utf-8');
  } catch {}

  console.log(`\n=== HOÀN TẤT ĐỒNG BỘ ===`);
  console.log(`- Đã cập nhật ảnh cho ${updatedComicsCount} bộ truyện.`);
  console.log(`- Tổng số chương mới nạp ảnh: ${totalNewChapters} chương.`);
}

crawlNgontinhMissing(50).catch(console.error);
