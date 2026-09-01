import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateAndGenerateBilingual } from '../../lib/languageAI'

describe('Language AI & Generator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('handles empty input gracefully', async () => {
    await expect(translateAndGenerateBilingual('')).rejects.toThrow('Vui lòng nhập từ hoặc câu tiếng Việt cần tra cứu.')
  })

  it('translates Vietnamese phrase into English and Chinese with situational examples', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes('tl=en')) {
        return {
          ok: true,
          json: async () => [[['Hello', 'xin chào']]],
        } as any
      }
      if (urlStr.includes('tl=zh-CN')) {
        return {
          ok: true,
          json: async () => [[['你好', 'xin chào', null, 'nǐ hǎo']]],
        } as any
      }
      return { ok: true, json: async () => [[['Hello', 'xin chào']]] } as any
    })

    const result = await translateAndGenerateBilingual('xin chào')
    expect(result).toBeDefined()
    expect(result.vietnamese).toBe('xin chào')
    expect(result.english.text).toBe('Hello')
    expect(result.chinese.text).toBe('你好')
    expect(Array.isArray(result.examples)).toBe(true)
    expect(result.examples.length).toBeGreaterThan(0)
    expect(result.examples[0].context).toBeDefined()
    expect(result.examples[0].english).toBeDefined()
    expect(result.examples[0].chinese).toBeDefined()

    globalThis.fetch = originalFetch
  })
})

