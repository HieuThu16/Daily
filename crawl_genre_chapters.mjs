// Bổ sung danh sách chương cho school_life_list.json / bl_list.json.
// Lưu số chương + link chương (index), không kéo ảnh từng trang.
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://otruyenapi.com/v1/api/truyen-tranh';
const FILES = ['school_life_list.json', 'bl_list.json'];
const CONCURRENCY = 8;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      if (i < retries - 1) await sleep(400 * (i + 1));
    }
  }
  return null;
}

async function enrich(entry) {
  const item = (await fetchJson(`${API}/${entry.slug}`))?.data?.item;
  if (!item) return entry;
  const chapters = (item.chapters ?? []).flatMap(sv =>
    (sv.server_data ?? []).map(c => ({
      number: c.chapter_name,
      name: c.chapter_title || `Chapter ${c.chapter_name}`,
      api: c.chapter_api_data,
    }))
  );
  return {
    ...entry,
    description: item.content ?? '',
    author: (item.author ?? []).join(', '),
    chapters,
    totalChapters: chapters.length,
  };
}

for (const file of FILES) {
  const target = path.resolve('public/data', file);
  const list = JSON.parse(await fs.readFile(target, 'utf-8'));
  console.log(`=== ${file}: ${list.length} truyện ===`);
  const out = [];
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    out.push(...await Promise.all(list.slice(i, i + CONCURRENCY).map(enrich)));
    if (i % (CONCURRENCY * 25) === 0) console.log(`  ${out.length}/${list.length}`);
    await sleep(120);
  }
  await fs.writeFile(target, JSON.stringify(out), 'utf-8');
  const withCh = out.filter(e => e.totalChapters > 0).length;
  console.log(`-> ${file}: ${withCh}/${out.length} truyện có chương\n`);
}
