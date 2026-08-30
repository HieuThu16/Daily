import { describe, expect, it } from 'vitest'
import { classifyYoutubeInput, classifyYoutubeLink } from './AddYoutubeModal'

describe('phân biệt link kênh và link video', () => {
  it('đoán đúng từng loại link', () => {
    expect(classifyYoutubeLink('https://www.youtube.com/@web5ngay')).toBe('channel')
    expect(classifyYoutubeLink('https://www.youtube.com/channel/UC123')).toBe('channel')
    expect(classifyYoutubeLink('https://youtu.be/abcdefghijk')).toBe('video')
    expect(classifyYoutubeLink('https://www.youtube.com/watch?v=abcdefghijk')).toBe('video')
    expect(classifyYoutubeLink('https://www.youtube.com/shorts/abcdefghijk')).toBe('video')
    expect(classifyYoutubeLink('vớ vẩn')).toBe('invalid')
  })

  it('tách ô dán lẫn lộn thành 3 nhóm, bỏ link video trùng', () => {
    const result = classifyYoutubeInput(
      [
        'https://www.youtube.com/@web5ngay',
        'https://youtu.be/abcdefghijk',
        'https://www.youtube.com/watch?v=abcdefghijk',
        'không-phải-link',
      ].join('\n'),
    )
    expect(result.channels).toEqual(['https://www.youtube.com/@web5ngay'])
    expect(result.videos.map((v) => v.videoId)).toEqual(['abcdefghijk'])
    expect(result.invalid).toEqual(['không-phải-link'])
  })
})

describe('isShortVideo logic', () => {
  it('nhận diện chính xác Shorts theo hashtag, url hoặc video ngắn', async () => {
    const { isShortVideo } = await import('./YoutubeView')
    expect(isShortVideo({ title: 'Hướng dẫn code #shorts' })).toBe(true)
    expect(isShortVideo({ canonical_url: 'https://www.youtube.com/shorts/abc123' })).toBe(true)
    expect(isShortVideo({ title: 'Video hay #reels' })).toBe(true)
    expect(isShortVideo({ title: 'Video clip #tiktok' })).toBe(true)
    expect(isShortVideo({ title: 'Clip ngắn [short]', duration: 45 })).toBe(true)
    expect(isShortVideo({ title: 'Bài giảng Lập trình Web', duration: 180 })).toBe(false)
    expect(isShortVideo({ title: 'Phim Hài Tết Full', duration: 3600 })).toBe(false)
  })
})
