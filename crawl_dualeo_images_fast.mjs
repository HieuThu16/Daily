/**
 * Cào bù ảnh truyện BL nguồn Dưa Leo — bản chạy song song.
 *
 *   node crawl_dualeo_images_fast.mjs
 *
 * crawl_bl_images.cjs làm cùng việc nhưng tuần tự và ghi lại nguyên file 467MB
 * dạng xuống dòng đẹp sau mỗi 5 truyện, nên mất gần 9 tiếng. Bản này chạy 5 luồng,
 * ghi gọn, lưu mỗi 400 chương. Chạy lại được nhiều lần, chương đã có ảnh thì bỏ qua.
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'

const FILE = 'public/data/bl_manga.json'
const BASE = 'https://dualeotruyencw.com'
const CONCURRENCY = 5
const SAVE_EVERY = 400
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: `${BASE}/` },
        signal: AbortSignal.timeout(25000),
      })
      if (res.ok) return await res.text()
    } catch {
      /* thử lại */
    }
    await new Promise((r) => setTimeout(r, 700 * (i + 1)))
  }
  return ''
}

const JUNK = /data:|dualeotruyen\.png|\/skin\/css\/|load\.gif|logo|\/avatar|favicon/i

/** Bóc ảnh trang đọc: Dưa Leo lazy-load nên ưu tiên data-img rồi mới tới src. */
export function extractImages(html) {
  const images = []
  const seen = new Set()

  for (const [tag] of html.matchAll(/<img[^>]+>/gi)) {
    const raw =
      tag.match(/data-img=["']([^"']+)["']/i)?.[1] ??
      tag.match(/data-src=["']([^"']+)["']/i)?.[1] ??
      tag.match(/data-original=["']([^"']+)["']/i)?.[1] ??
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1]
    if (!raw) continue

    const src = raw.trim()
    if (JUNK.test(src) || seen.has(src)) continue

    const isContent =
      src.includes('imgdualeo') ||
      src.includes('cdn') ||
      src.includes('/uploads/') ||
      src.includes('/upbia/') ||
      src.includes('part') ||
      (/\.(webp|jpg|jpeg|png)/i.test(src) && !src.includes('/skin/'))
    if (!isContent) continue

    seen.add(src)
    images.push({ page: images.length + 1, src, fallbackSrc: src })
  }

  return images
}

function save(list) {
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(list), 'utf8')
  copyFileSync(tmp, FILE)
  try {
    unlinkSync(tmp)
  } catch {
    /* Windows đôi khi giữ file, kệ */
  }
}

async function main() {
  console.log('Doc bl_manga.json…')
  const list = JSON.parse(readFileSync(FILE, 'utf8'))

  const tasks = []
  for (const manga of list) {
    for (const ch of manga.chapters ?? []) {
      if (ch.url && (!ch.images || ch.images.length === 0)) tasks.push({ manga, ch })
    }
  }
  console.log(`${tasks.length} chuong thieu anh / ${list.length} bo truyen Dua Leo`)

  let cursor = 0
  let done = 0
  let filled = 0
  let empty = 0
  const startedAt = Date.now()

  const worker = async () => {
    while (cursor < tasks.length) {
      const { ch } = tasks[cursor++]
      const html = await get(ch.url)
      const images = html ? extractImages(html) : []
      ch.images = images
      ch.imageCount = images.length
      done++
      if (images.length > 0) filled++
      else empty++

      if (done % 50 === 0) {
        const perMin = done / ((Date.now() - startedAt) / 60000)
        const left = Math.round((tasks.length - done) / Math.max(perMin, 1))
        console.log(`  ${done}/${tasks.length} — co anh ${filled}, khong ${empty} — ~${left} phut nua`)
      }
      if (done % SAVE_EVERY === 0) {
        save(list)
        console.log(`  … da luu (${done} chuong)`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  save(list)
  console.log(`\nXong: ${filled} chuong co anh, ${empty} chuong nguon that su khong co anh.`)
  console.log('Nho chay: npm run split:bl  roi deploy bang Vercel CLI (shard anh khong nam trong git).')
}

main().catch((err) => {
  console.error('Loi:', err)
  process.exit(1)
})
