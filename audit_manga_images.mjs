/**
 * Kiểm kê ảnh truyện BL + Ngôn tình đang có trên app.
 *
 *   node audit_manga_images.mjs            → bản tóm tắt
 *   node audit_manga_images.mjs --list     → in luôn slug thiếu ảnh
 *   node audit_manga_images.mjs --json out.json  → ghi danh sách cần cào lại
 *
 * Quy ước "đủ ảnh":
 *  - Nguồn dualeo / teamsany / ngôn tình gốc: ảnh nằm sẵn trong file dữ liệu
 *    (hoặc file mảnh public/data/bl/img-*.json) → chương nào không có ảnh là thiếu.
 *  - Nguồn otruyen / mangadex: ảnh tải trực tiếp khi mở chương → chỉ cần có mục lục
 *    chương là đủ; không có chương nào mới là thiếu.
 */

import fs from 'node:fs'
import path from 'node:path'

const DATA = path.join('public', 'data')
const BL_SHARD_COUNT = 128

function blShardOf(slug) {
  let h = 5381
  for (let i = 0; i < slug.length; i++) h = ((h * 33) ^ slug.charCodeAt(i)) >>> 0
  return h % BL_SHARD_COUNT
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const shardCache = new Map()
function shardFor(slug) {
  const shard = blShardOf(slug)
  if (!shardCache.has(shard)) {
    shardCache.set(shard, readJson(path.join(DATA, 'bl', `img-${shard}.json`), {}) ?? {})
  }
  return shardCache.get(shard)
}

/** Ảnh của một chương: trong chính dữ liệu, hoặc trong file mảnh BL. */
function chapterImageCount(chapter, slug, useShard) {
  if (Array.isArray(chapter.images) && chapter.images.length > 0) return chapter.images.length
  if (useShard) {
    const map = shardFor(slug)
    const imgs = map?.[slug]?.[String(chapter.number)]
    if (Array.isArray(imgs) && imgs.length > 0) return imgs.length
  }
  return 0
}

function auditFile(spec) {
  const list = readJson(path.join(DATA, spec.file), [])
  if (!Array.isArray(list)) return null

  const noChapter = []
  const missingImages = []
  let chaptersChecked = 0
  let chaptersMissing = 0

  for (const manga of list) {
    const chapters = Array.isArray(manga.chapters) ? manga.chapters : []
    if (chapters.length === 0) {
      // MangaDex nạp mục lục chương khi mở truyện (hydrateMangadexManga) nên không tính là thiếu.
      if (manga.source !== 'mangadex') noChapter.push(manga.slug)
      continue
    }
    if (spec.live) continue // ảnh tải khi mở chương, có mục lục là đủ

    let missing = 0
    for (const ch of chapters) {
      chaptersChecked++
      if (chapterImageCount(ch, manga.slug, spec.useShard) === 0) {
        missing++
        chaptersMissing++
      }
    }
    if (missing > 0) {
      missingImages.push({
        slug: manga.slug,
        title: manga.title,
        source: manga.source ?? spec.kind,
        missing,
        total: chapters.length,
      })
    }
  }

  return {
    file: spec.file,
    kind: spec.kind,
    live: spec.live,
    total: list.length,
    chaptersChecked,
    chaptersMissing,
    noChapter,
    missingImages,
  }
}

const SPECS = [
  { file: path.join('bl', 'list.json'), kind: 'BL · Dưa Leo', live: false, useShard: true },
  { file: 'teamsany_manga.json', kind: 'BL · Sany Team', live: false },
  { file: 'bl_list.json', kind: 'BL · OTruyen', live: true },
  // Ngôn tình: reader luôn gọi otruyenapi theo slug khi chương chưa có ảnh sẵn,
  // nên ảnh nhúng chỉ là bộ đệm — có mục lục chương là đọc được.
  { file: 'ngontinh_manga_1.json', kind: 'Ngôn tình 1', live: true },
  { file: 'ngontinh_manga_2.json', kind: 'Ngôn tình 2', live: true },
  { file: 'ngontinh_manga_3.json', kind: 'Ngôn tình 3', live: true },
  { file: 'ngontinh_manga_4.json', kind: 'Ngôn tình 4', live: true },
  { file: 'extra_manga.json', kind: 'Ngôn tình · gộp thêm', live: true },
  { file: 'school_life_list.json', kind: 'Ngôn tình · OTruyen', live: true },
]

const reports = SPECS.map(auditFile).filter(Boolean)

console.log('\n=== Kiem ke anh truyen BL & Ngon tinh ===\n')
let totalBroken = 0
for (const r of reports) {
  totalBroken += r.missingImages.length + r.noChapter.length
  console.log(
    `${r.kind.padEnd(24)} ${String(r.total).padStart(6)} bo  |  ` +
      (r.live
        ? `anh tai truc tiep · ${r.noChapter.length} bo khong co chuong`
        : `${r.missingImages.length} bo thieu anh (${r.chaptersMissing}/${r.chaptersChecked} chuong) · ${r.noChapter.length} bo khong co chuong`),
  )
}
console.log(`\nTong cong ${totalBroken} bo can xu ly.\n`)

if (process.argv.includes('--list')) {
  for (const r of reports) {
    if (r.missingImages.length === 0 && r.noChapter.length === 0) continue
    console.log(`--- ${r.kind} (${r.file}) ---`)
    for (const m of r.missingImages.slice(0, 40)) {
      console.log(`  thieu anh  ${m.slug}  ${m.missing}/${m.total} chuong`)
    }
    if (r.missingImages.length > 40) console.log(`  … va ${r.missingImages.length - 40} bo nua`)
    for (const slug of r.noChapter.slice(0, 20)) console.log(`  khong chuong  ${slug}`)
    if (r.noChapter.length > 20) console.log(`  … va ${r.noChapter.length - 20} bo nua`)
    console.log('')
  }
}

const jsonIdx = process.argv.indexOf('--json')
if (jsonIdx >= 0) {
  const out = process.argv[jsonIdx + 1] || 'manga_image_gaps.json'
  fs.writeFileSync(
    out,
    JSON.stringify(
      reports.map((r) => ({
        file: r.file,
        kind: r.kind,
        live: r.live,
        missingImages: r.missingImages,
        noChapter: r.noChapter,
      })),
      null,
      2,
    ),
  )
  console.log(`Da ghi danh sach can cao lai → ${out}`)
}
