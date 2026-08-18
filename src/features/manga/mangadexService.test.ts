import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMangadexChapters, fetchMangadexChapterImages } from './mangadexService'

const chapter = (id: string, lang: string, num: string) => ({
  id,
  attributes: { chapter: num, title: null, translatedLanguage: lang, pages: 20 },
})

afterEach(() => vi.unstubAllGlobals())

describe('fetchMangadexChapters', () => {
  it('ưu tiên bản tiếng Việt và bỏ chương trùng số', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          chapter('en-1', 'en', '1'),
          chapter('vi-1', 'vi', '1'),
          chapter('vi-1-dup', 'vi', '1'),
          chapter('vi-2', 'vi', '2'),
        ],
      }),
    })))

    const chapters = await fetchMangadexChapters('manga-vi')
    expect(chapters.map((c) => c.chapterId)).toEqual(['vi-1', 'vi-2'])
    expect(chapters[0].number).toBe(1)
  })

  it('bỏ chương ngoài site và chương không đọc được, rơi về tiếng Anh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'vi-ext', attributes: { chapter: '1', translatedLanguage: 'vi', externalUrl: 'https://x' } },
          { id: 'vi-na', attributes: { chapter: '2', translatedLanguage: 'vi', isUnavailable: true } },
          chapter('en-1', 'en', '1'),
        ],
      }),
    })))

    const chapters = await fetchMangadexChapters('manga-en')
    expect(chapters.map((c) => c.chapterId)).toEqual(['en-1'])
  })
})

describe('fetchMangadexChapterImages', () => {
  it('ghép URL ảnh từ at-home server', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        baseUrl: 'https://cdn.test',
        chapter: { hash: 'abc', data: ['1.png', '2.png'] },
      }),
    })))

    const images = await fetchMangadexChapterImages('ch-1')
    expect(images.map((i) => i.url)).toEqual([
      'https://cdn.test/data/abc/1.png',
      'https://cdn.test/data/abc/2.png',
    ])
  })
})
