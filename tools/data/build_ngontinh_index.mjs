/*
 * Tách dữ liệu ngôn tình thành:
 *   public/data/ngontinh_index.json   chỉ trường lưới bìa cần  (~7MB thay vì 169MB)
 *   public/data/ngontinh/ch-<n>.json  mục lục chương theo mảnh, ĐÃ BỎ url ảnh
 *
 * Vì sao bỏ url ảnh: reader vốn đã có đường dự phòng gọi otruyenapi khi chương
 * không kèm ảnh (xem fetchNgontinhChapterImages), nên chỗ này chỉ là dữ liệu
 * thừa — mà nó chiếm 98% dung lượng.
 *
 * Chạy: npm run build:ngontinh
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { NGONTINH_SHARD_COUNT, ngontinhShardOf } from '../../src/features/manga/ngontinhShards.ts'

const SOURCES = [
  'public/data/ngontinh_manga_1.json',
  'public/data/ngontinh_manga_2.json',
  'public/data/ngontinh_manga_3.json',
  'public/data/ngontinh_manga_4.json',
  'public/data/extra_manga.json',
  'public/data/school_life_list.json',
]

/** Trường lưới bìa dùng tới; thêm gì vào lưới thì thêm vào đây. */
const GRID_FIELDS = ['slug', 'title', 'cover', 'genres', 'status', 'author', 'updatedAt', 'views', 'url']

const OUT_INDEX = 'public/data/ngontinh_index.json'
const OUT_DIR = 'public/data/ngontinh'

const mb = (n) => (n / 1048576).toFixed(1) + 'MB'

const index = []
const shards = Array.from({ length: NGONTINH_SHARD_COUNT }, () => ({}))
const seen = new Set()
let sourceBytes = 0
let skipped = 0

for (const src of SOURCES) {
  if (!existsSync(src)) {
    console.log(`  bỏ qua ${src} — không có file`)
    continue
  }
  const raw = readFileSync(src, 'utf8')
  sourceBytes += Buffer.byteLength(raw)
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) continue

  for (const item of data) {
    if (!item?.slug) continue
    // Gộp nhiều nguồn nên phải lọc trùng, giữ bản gặp trước.
    if (seen.has(item.slug)) {
      skipped++
      continue
    }
    seen.add(item.slug)

    const chapters = Array.isArray(item.chapters) ? item.chapters : []

    const entry = {}
    for (const f of GRID_FIELDS) if (item[f] !== undefined) entry[f] = item[f]
    entry.totalChapters = item.totalChapters ?? chapters.length
    // Mangadex nhận diện bằng chapterId nên phải giữ dấu vết ở chỉ mục.
    if (item.source) entry.source = item.source
    index.push(entry)

    if (chapters.length > 0) {
      shards[ngontinhShardOf(item.slug)][item.slug] = chapters.map((c) => {
        const { images, ...rest } = c
        return rest
      })
    }
  }
  console.log(`  đọc ${src} — ${mb(Buffer.byteLength(raw))}`)
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_INDEX, JSON.stringify(index))

let shardBytes = 0
shards.forEach((map, i) => {
  const text = JSON.stringify(map)
  shardBytes += Buffer.byteLength(text)
  writeFileSync(`${OUT_DIR}/ch-${i}.json`, text)
})

const indexBytes = Buffer.byteLength(JSON.stringify(index))
console.log('')
console.log(`Nguồn      : ${mb(sourceBytes)}`)
console.log(`Chỉ mục    : ${mb(indexBytes)}  (${index.length} truyện, bỏ ${skipped} bản trùng)`)
console.log(`Mảnh chương: ${mb(shardBytes)} chia ${NGONTINH_SHARD_COUNT} file — mở 1 truyện chỉ tải ~${mb(shardBytes / NGONTINH_SHARD_COUNT)}`)
console.log(`Lưới bìa   : ${mb(sourceBytes)} -> ${mb(indexBytes)}  (nhẹ hơn ${(sourceBytes / indexBytes).toFixed(0)} lần)`)
