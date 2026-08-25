// Gộp các file crawl còn để không (romance, shoujo, slice of life, shounen ai, đam mỹ)
// thành public/data/extra_manga.json — bỏ URL ảnh, chỉ giữ imageCount.
// Ảnh vẫn xem được: reader tự gọi otruyenapi theo slug (fetchNgontinhChapterImages).
// Chạy: npm run split:extra
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const SOURCES = [
  'src/data/romance_manga.json',
  'public/data/romance_manga.json',
  'src/data/shoujo_manga.json',
  'public/data/shoujo_manga.json',
  'src/data/sliceoflife_manga.json',
  'public/data/sliceoflife_manga.json',
  'src/data/shounenai_manga.json',
  'public/data/shounenai_manga.json',
  'src/data/dammy_manga.json',
  'public/data/dammy_manga.json',
  'src/data/school_life_manga.json',
  'public/data/school_life_manga.json',
  'dist/data/school_life_manga.json',
]
// MangaDex chỉ có metadata + link ngoài, không có chương để đọc trong app.
const MANGADEX = [
  'public/data/mangadex_school_romance.json',
  'public/data/mangadex_school_bl.json',
  'public/data/mangadex_school_gl.json',
]
const NGONTINH = [1, 2, 3, 4].map((i) => `public/data/ngontinh_manga_${i}.json`)
const OUT = 'public/data/extra_manga.json'

const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [])

const seen = new Set(NGONTINH.flatMap(read).map((m) => m.slug))
const out = []
for (const file of SOURCES) {
  const list = read(file)
  if (list.length === 0) {
    console.log(`Bỏ qua ${file} (không có).`)
    continue
  }
  let added = 0
  for (const manga of list) {
    if (!manga?.slug || seen.has(manga.slug)) continue
    seen.add(manga.slug)
    out.push({
      ...manga,
      chapters: (manga.chapters ?? []).map(({ images, ...ch }) => ({
        ...ch,
        imageCount: ch.imageCount ?? images?.length ?? 0,
      })),
    })
    added++
  }
  console.log(`${file}: +${added} bộ`)
}

for (const file of MANGADEX) {
  let added = 0
  for (const manga of read(file)) {
    if (!manga?.slug || seen.has(manga.slug)) continue
    seen.add(manga.slug)
    // Giữ id: reader gọi API MangaDex theo id để lấy chương và ảnh khi đọc.
    out.push({ ...manga, chapters: [], totalChapters: 0 })
    added++
  }
  console.log(`${file}: +${added} bộ`)
}

// Trên máy build của Vercel vài file nguồn bị loại (quá nặng), gộp lại sẽ ra ít hơn —
// lúc đó giữ nguyên file đã commit.
const existing = read(OUT)
if (out.length <= existing.length) {
  console.log(`Chỉ gộp được ${out.length} bộ (đã có ${existing.length}) — giữ nguyên ${OUT}.`)
  process.exit(0)
}
const json = JSON.stringify(out)
writeFileSync(OUT, json)
console.log(`${OUT}: ${out.length} bộ (${(Buffer.byteLength(json) / 1048576).toFixed(1)}MB)`)
