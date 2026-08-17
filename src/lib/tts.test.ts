import { describe, expect, it } from 'vitest'
import { pickEnglishVoice } from './tts'

describe('pickEnglishVoice', () => {
  it('bỏ qua giọng không phải tiếng Anh', () => {
    expect(pickEnglishVoice([{ name: 'An', lang: 'vi-VN' }])).toBeNull()
  })

  it('ưu tiên giọng neural / online hơn giọng local mặc định', () => {
    const picked = pickEnglishVoice([
      { name: 'English (America)', lang: 'en-US', localService: true },
      { name: 'Google US English', lang: 'en-US', localService: false },
    ])
    expect(picked?.name).toBe('Google US English')
  })
})
