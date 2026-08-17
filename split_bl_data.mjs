// Tách public/data/bl_manga.json (~127MB) thành:
//   - public/data/bl/list.json      danh sách truyện + chương, KHÔNG kèm URL ảnh
//   - public/data/bl/img-<n>.json   URL ảnh, chia theo mảnh để mỗi file đủ nhỏ
// Lý do: Vercel chặn cứng 100MB/file nên file gốc không deploy được.
// Chạy: npm run split:bl
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BL_SHARD_COUNT, blShardOf } from './src/features/manga/blShards.ts'

const SRC = 'public/data/bl_manga.json'
const OUT_DIR = 'public/data/bl'

// Chạy tự động trước mỗi lần build. Trên máy build của Vercel không có file gốc
// (đã loại trong .vercelignore vì quá 100MB) — lúc đó dùng luôn mảnh đã sinh sẵn.
if (!existsSync(SRC)) {
  console.log(`Không thấy ${SRC} — giữ nguyên ${OUT_DIR} đã có sẵn.`)
  process.exit(0)
}

const mangas = JSON.parse(readFileSync(SRC, 'utf8'))
mkdirSync(OUT_DIR, { recursive: true })

const shards = Array.from({ length: BL_SHARD_COUNT }, () => ({}))

const list = mangas.map((manga) => {
  const chapters = manga.chapters ?? []
  const byChapter = {}
  const lightChapters = chapters.map((ch) => {
    const { images, ...rest } = ch
    const urls = images ?? []
    if (urls.length > 0) byChapter[ch.number ?? rest.title] = urls
    return { ...rest, imageCount: ch.imageCount ?? urls.length }
  })
  if (Object.keys(byChapter).length > 0) shards[blShardOf(manga.slug)][manga.slug] = byChapter
  return { ...manga, chapters: lightChapters }
})

const listJson = JSON.stringify(list)
writeFileSync(`${OUT_DIR}/list.json`, listJson)

let biggest = 0
shards.forEach((shard, i) => {
  const json = JSON.stringify(shard)
  biggest = Math.max(biggest, Buffer.byteLength(json))
  writeFileSync(`${OUT_DIR}/img-${i}.json`, json)
})

const mb = (bytes) => (bytes / 1048576).toFixed(1)
console.log(`${mangas.length} truyện → list.json ${mb(Buffer.byteLength(listJson))}MB`)
console.log(`${BL_SHARD_COUNT} mảnh ảnh, mảnh lớn nhất ${mb(biggest)}MB`)
if (biggest > 100 * 1048576) {
  console.error('Mảnh vượt 100MB — tăng BL_SHARD_COUNT trong src/features/manga/blShards.ts')
  process.exit(1)
}
