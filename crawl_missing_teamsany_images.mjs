/**
 * Vá ảnh còn thiếu cho truyện BL nguồn Sany Team.
 *
 *   node crawl_missing_teamsany_images.mjs
 *
 * Khác crawl_teamsany.js: KHÔNG dựng lại catalog (bản đó ghi đè ảnh đã có),
 * chỉ đi tìm những chương đang rỗng ảnh rồi bổ sung. Chạy lại được nhiều lần.
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import * as cheerio from 'cheerio'

const FILE = 'public/data/teamsany_manga.json'
const CONCURRENCY = 4
const SAVE_EVERY = 50
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://teamsany.com/' },
        signal: AbortSignal.timeout(25000),
      })
      if (res.ok) return await res.text()
    } catch {
      /* thử lại */
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)))
  }
  return ''
}

/** Bóc ảnh trang truyện: ưu tiên biến ch_image, không có thì quét thẻ img trong khung đọc. */
export function extractChapterImages(html) {
  const $ = cheerio.load(html)
  const images = []

  $('script').each((_, s) => {
    const text = $(s).html() || ''
    const match = text.match(/ch_image\s*=\s*\$\.reader\(\s*(\{[\s\S]*?\})\s*\)/)
    if (!match) return
    try {
      const parsed = JSON.parse(match[1])
      for (const it of Object.values(parsed?.array ?? {})) {
        if (!it?.image) continue
        let url = String(it.image).replace(/\\\//g, '/')
        if (url.startsWith('//')) url = 'https:' + url
        images.push({ url, index: images.length + 1, alt: `Trang ${images.length + 1}` })
      }
    } catch {
      /* script không phải JSON hợp lệ */
    }
  })

  if (images.length === 0) {
    $('.reader-area img, #readerarea img, .reading-content img').each((_, img) => {
      let src =
        $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src') || $(img).attr('data-cfsrc')
      if (!src) return
      if (/banner|ads|logo|avatar/i.test(src)) return
      if (src.startsWith('//')) src = 'https:' + src
      images.push({ url: src.trim(), index: images.length + 1, alt: `Trang ${images.length + 1}` })
    })
  }

  return images
}

function save(list) {
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8')
  copyFileSync(tmp, FILE)
  try {
    unlinkSync(tmp)
  } catch {
    /* Windows đôi khi giữ file, kệ */
  }
}

async function main() {
  const list = JSON.parse(readFileSync(FILE, 'utf8'))
  const tasks = []
  for (const manga of list) {
    for (const ch of manga.chapters ?? []) {
      if (ch.url && (!ch.images || ch.images.length === 0)) tasks.push({ manga, ch })
    }
  }
  console.log(`${tasks.length} chuong thieu anh / ${list.length} bo truyen Sany Team`)

  let done = 0
  let filled = 0
  let empty = 0
  let cursor = 0

  const worker = async () => {
    while (cursor < tasks.length) {
      const { manga, ch } = tasks[cursor++]
      const html = await get(ch.url)
      const images = html ? extractChapterImages(html) : []
      ch.images = images
      ch.imageCount = images.length
      done++
      if (images.length > 0) filled++
      else empty++
      if (done % 10 === 0) {
        console.log(`  ${done}/${tasks.length} — co anh ${filled}, khong co ${empty} (${manga.slug})`)
      }
      if (done % SAVE_EVERY === 0) save(list)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  save(list)
  console.log(`\nXong: ${filled} chuong da co anh, ${empty} chuong nguon that su khong co anh.`)
}

if (process.argv[1]?.endsWith('crawl_missing_teamsany_images.mjs')) {
  main().catch((err) => {
    console.error('Loi:', err)
    process.exit(1)
  })
}
