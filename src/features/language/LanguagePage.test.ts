import { describe, it, expect } from 'vitest'
import { translateAndGenerateBilingual } from '../../lib/languageAI'

describe('Language AI & Generator', () => {
  it('handles empty input gracefully', async () => {
    await expect(translateAndGenerateBilingual('')).rejects.toThrow('Vui lòng nhập từ hoặc câu tiếng Việt cần tra cứu.')
  })

  it('translates Vietnamese phrase into English and Chinese with situational examples', async () => {
    const result = await translateAndGenerateBilingual('xin chào')
    expect(result).toBeDefined()
    expect(result.vietnamese).toBe('xin chào')
    expect(result.english.text).toBeDefined()
    expect(result.chinese.text).toBeDefined()
    expect(Array.isArray(result.examples)).toBe(true)
    expect(result.examples.length).toBeGreaterThan(0)
    expect(result.examples[0].context).toBeDefined()
    expect(result.examples[0].english).toBeDefined()
    expect(result.examples[0].chinese).toBeDefined()
  })
})
