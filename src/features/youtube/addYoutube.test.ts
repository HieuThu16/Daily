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
  it('nhận diện chính xác video dưới 5 phút (< 300s)', async () => {
    const { isShortVideo } = await import('./YoutubeView')
    expect(isShortVideo({ duration: 59 })).toBe(true)
    expect(isShortVideo({ duration: 299 })).toBe(true)
    expect(isShortVideo({ duration: 300 })).toBe(false)
    expect(isShortVideo({ duration: 600 })).toBe(false)
    expect(isShortVideo({ duration: null })).toBe(false)
    expect(isShortVideo({ duration: undefined })).toBe(false)
    expect(isShortVideo({ duration: 0 })).toBe(false)
    // Test theo progressMap
    expect(isShortVideo({ video_id: 'vid1', duration: null }, { vid1: { durationSeconds: 120 } })).toBe(true)
    expect(isShortVideo({ video_id: 'vid2', duration: null }, { vid2: { durationSeconds: 400 } })).toBe(false)
    // Test theo hashtag / url
    expect(isShortVideo({ title: 'Hướng dẫn code #shorts' })).toBe(true)
    expect(isShortVideo({ canonical_url: 'https://www.youtube.com/shorts/abc123' })).toBe(true)
  })
})
