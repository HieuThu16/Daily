import { describe, expect, it } from 'vitest'
import { isShortVideo } from './YoutubeView'

describe('YoutubeShortsPage & isShortVideo', () => {
  it('nhận diện video short theo URL hoặc hashtag', () => {
    expect(isShortVideo({ canonical_url: 'https://www.youtube.com/shorts/abcdef123' })).toBe(true)
    expect(isShortVideo({ title: 'Mẹo lập trình cực hay #shorts #code' })).toBe(true)
    expect(isShortVideo({ title: 'Tổng hợp khoảnh khắc hài hước #short' })).toBe(true)
  })

  it('nhận diện video short theo thời lượng ngắn dưới 90s', () => {
    expect(isShortVideo({ duration: 45 })).toBe(true)
    expect(isShortVideo({ duration: 89 })).toBe(true)
    expect(isShortVideo({ duration: 3600 })).toBe(false)
  })

  it('loại trừ video dài thông thường', () => {
    expect(isShortVideo({ title: 'Full tập phim review dài', duration: 1800, canonical_url: 'https://youtube.com/watch?v=123' })).toBe(false)
  })
})
