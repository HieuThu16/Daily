import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = existsSync('public/data/ngontinh_manga.json')
  ? 'public/data/ngontinh_manga.json'
  : existsSync('src/data/ngontinh_manga.json')
  ? 'src/data/ngontinh_manga.json'
  : null;

const PART1 = 'public/data/ngontinh_manga_1.json';
const PART2 = 'public/data/ngontinh_manga_2.json';
const PART3 = 'public/data/ngontinh_manga_3.json';

if (!SRC) {
  if (existsSync(PART1) && existsSync(PART2)) {
    console.log('Không thấy ngontinh_manga.json — giữ nguyên file mảnh đã có sẵn.');
  }
  process.exit(0);
}

try {
  const data = JSON.parse(readFileSync(SRC, 'utf8'));
  const chunks = [[], [], [], []];
  const chunkSizes = [0, 0, 0, 0];

  for (const item of data) {
    // Find chunk with smallest size
    let minIdx = 0;
    for (let i = 1; i < chunkSizes.length; i++) {
      if (chunkSizes[i] < chunkSizes[minIdx]) minIdx = i;
    }
    const itemStr = JSON.stringify(item);
    chunks[minIdx].push(item);
    chunkSizes[minIdx] += itemStr.length;
  }

  const mb = (bytes) => (bytes / 1048576).toFixed(1);
  const partFiles = [
    'public/data/ngontinh_manga_1.json',
    'public/data/ngontinh_manga_2.json',
    'public/data/ngontinh_manga_3.json',
    'public/data/ngontinh_manga_4.json',
  ];

  partFiles.forEach((file, idx) => {
    const json = JSON.stringify(chunks[idx]);
    writeFileSync(file, json);
    console.log(`Part ${idx + 1}: ${chunks[idx].length} bộ (${mb(Buffer.byteLength(json))}MB)`);
  });
} catch (err) {
  console.error('Lỗi khi chia nhỏ dữ liệu ngôn tình:', err);
}
