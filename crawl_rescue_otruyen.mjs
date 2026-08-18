// Các truyện chỉ có mục lục, không có ảnh trong dữ liệu (phải sang web gốc mới đọc được).
// Dò slug trên otruyenapi — bộ nào có thì app đọc được ngay bằng cơ chế tải ảnh động.
import fs from 'node:fs/promises';

const API = 'https://otruyenapi.com/v1/api/truyen-tranh';
const SOURCES = ['bl/list.json', 'extra_manga.json'];
const CONCURRENCY = 8;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hasImages = e => (e.chapters ?? []).some(c => (c.images?.length ?? 0) > 0 || c.imageCount > 0);

async function probe(entry) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${API}/${entry.slug}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(String(res.status));
      const item = (await res.json())?.data?.item;
      const chapters = (item?.chapters ?? []).flatMap(sv =>
        (sv.server_data ?? []).map(c => ({
          number: parseFloat(c.chapter_name),
          name: c.chapter_title || `Chapter ${c.chapter_name}`,
          url: `https://otruyen.cc/truyen-tranh/${entry.slug}`,
        }))
      );
      if (!chapters.length) return null;
      return { ...entry, source: 'otruyen', sourceName: 'OTruyen', chapters, totalChapters: chapters.length };
    } catch {
      await sleep(400 * (i + 1));
    }
  }
  return null;
}

const broken = [];
for (const file of SOURCES) {
  const list = JSON.parse(await fs.readFile(`public/data/${file}`, 'utf-8'));
  broken.push(...list.filter(e => !hasImages(e) && e.source !== 'mangadex' && (e.chapters?.length ?? 0) > 0));
}
console.log(`Truyện thiếu ảnh: ${broken.length}`);

const rescued = [];
for (let i = 0; i < broken.length; i += CONCURRENCY) {
  const batch = await Promise.all(broken.slice(i, i + CONCURRENCY).map(probe));
  rescued.push(...batch.filter(Boolean));
  if (i % (CONCURRENCY * 25) === 0) console.log(`  ${i}/${broken.length} — cứu được ${rescued.length}`);
  await sleep(120);
}

await fs.writeFile('public/data/otruyen_rescue.json', JSON.stringify(rescued), 'utf-8');
const stuck = broken.filter(b => !rescued.some(r => r.slug === b.slug));
await fs.writeFile('public/data/needs_source_site.json', JSON.stringify(stuck.map(e => e.slug)), 'utf-8');
console.log(`-> cứu ${rescued.length}, còn ${stuck.length} bộ không có trên otruyen`);
