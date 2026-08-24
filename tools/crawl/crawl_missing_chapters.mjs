/**
 * Vá mục lục chương cho những bộ đang trắng chương (mở ra không có gì để đọc).
 *
 *   node crawl_missing_chapters.mjs
 *
 * Lấy mục lục từ otruyenapi theo slug. Bộ nào otruyen cũng không có thì chịu —
 * nguồn gốc mất, ghi lại vào missing_at_source.json để khỏi dò lại lần sau.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const FILES = [
  'public/data/ngontinh_manga_1.json',
  'public/data/ngontinh_manga_2.json',
  'public/data/ngontinh_manga_3.json',
  'public/data/ngontinh_manga_4.json',
  'public/data/romance_manga.json',
  'public/data/shoujo_manga.json',
  'public/data/sliceoflife_manga.json',
  'public/data/shounenai_manga.json',
  'public/data/dammy_manga.json',
  'public/data/bl_list.json',
  'public/data/school_life_list.json',
  // File app đọc trực tiếp; vài bộ tới từ nguồn đã mất nên phải vá thẳng vào đây.
  'public/data/extra_manga.json',
]

const CONCURRENCY = 5
const GONE_FILE = 'missing_at_source.json'

async function chaptersOf(slug) {
  try {
    const res = await fetch(`https://otruyenapi.com/v1/api/truyen-tranh/${slug}`, {
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const serverData = data?.data?.item?.chapters?.[0]?.server_data ?? []
    return serverData
      .map((c) => {
        const number = parseFloat(c.chapter_name)
        if (Number.isNaN(number)) return null
        return {
          number,
          name: c.chapter_title ? `Chapter ${c.chapter_name}: ${c.chapter_title}` : `Chapter ${c.chapter_name}`,
          url: c.chapter_api_data ?? '',
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.number - b.number)
  } catch {
    return []
  }
}

async function main() {
  const gone = existsSync(GONE_FILE) ? new Set(JSON.parse(readFileSync(GONE_FILE, 'utf8'))) : new Set()

  for (const file of FILES) {
    if (!existsSync(file)) {
      console.log(`Bo qua ${file} (khong co).`)
      continue
    }
    const list = JSON.parse(readFileSync(file, 'utf8'))
    const targets = list.filter(
      (m) =>
        m?.slug &&
        m.source !== 'mangadex' &&
        (!Array.isArray(m.chapters) || m.chapters.length === 0) &&
        !gone.has(m.slug),
    )
    if (targets.length === 0) {
      console.log(`${file}: khong bo nao trang chuong.`)
      continue
    }

    let cursor = 0
    let fixed = 0
    let missing = 0
    const worker = async () => {
      while (cursor < targets.length) {
        const manga = targets[cursor++]
        const chapters = await chaptersOf(manga.slug)
        if (chapters.length > 0) {
          manga.chapters = chapters
          manga.totalChapters = chapters.length
          fixed++
        } else {
          gone.add(manga.slug)
          missing++
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    writeFileSync(file, JSON.stringify(list), 'utf8')
    console.log(`${file}: va duoc ${fixed}/${targets.length} bo, ${missing} bo nguon that su khong con.`)
  }

  writeFileSync(GONE_FILE, JSON.stringify([...gone], null, 2), 'utf8')
  console.log(`\nDanh sach nguon da mat: ${gone.size} bo → ${GONE_FILE}`)
}

main().catch((err) => {
  console.error('Loi:', err)
  process.exit(1)
})
