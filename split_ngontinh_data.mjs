import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = 'public/data/ngontinh_manga.json';
const PART1 = 'public/data/ngontinh_manga_1.json';
const PART2 = 'public/data/ngontinh_manga_2.json';

if (!existsSync(SRC)) {
  if (existsSync(PART1) && existsSync(PART2)) {
    console.log('Không thấy ngontinh_manga.json — giữ nguyên 2 file mảnh đã có sẵn.');
  }
  process.exit(0);
}

try {
  const data = JSON.parse(readFileSync(SRC, 'utf8'));
  const half = Math.ceil(data.length / 2);
  const part1 = data.slice(0, half);
  const part2 = data.slice(half);

  const json1 = JSON.stringify(part1);
  const json2 = JSON.stringify(part2);

  writeFileSync(PART1, json1);
  writeFileSync(PART2, json2);

  const mb = (bytes) => (bytes / 1048576).toFixed(1);
  console.log(`Đã chia ${data.length} bộ ngôn tình thành 2 file: part 1 (${mb(Buffer.byteLength(json1))}MB), part 2 (${mb(Buffer.byteLength(json2))}MB)`);
} catch (err) {
  console.error('Lỗi khi chia nhỏ dữ liệu ngôn tình:', err);
}
