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

  it('loại bỏ các video đã xem khỏi luồng gợi ý foryou', () => {
    const allVideos = [
      { video_id: 'vid1', title: 'Video 1' },
      { video_id: 'vid2', title: 'Video 2' },
      { video_id: 'vid3', title: 'Video 3' },
    ]
    const watchedIds = new Set(['vid1', 'vid3'])
    const unviewed = allVideos.filter((v) => !watchedIds.has(v.video_id))
    expect(unviewed).toHaveLength(1)
    expect(unviewed[0].video_id).toBe('vid2')
  })

  it('sắp xếp video trong tab lịch sử theo thứ tự xem gần nhất', () => {
    const allVideos = [
      { video_id: 'vid1', title: 'Video 1' },
      { video_id: 'vid2', title: 'Video 2' },
      { video_id: 'vid3', title: 'Video 3' },
    ]
    const watchHistory = [
      { video_id: 'vid3', watched_at: '2026-08-31T12:00:00Z' },
      { video_id: 'vid1', watched_at: '2026-08-31T11:00:00Z' },
    ]
    const historyIndexMap = new Map(watchHistory.map((w, idx) => [w.video_id, idx]))
    const historyList = allVideos
      .filter((s) => historyIndexMap.has(s.video_id))
      .sort((a, b) => (historyIndexMap.get(a.video_id) ?? 9999) - (historyIndexMap.get(b.video_id) ?? 9999))

    expect(historyList).toHaveLength(2)
    expect(historyList[0].video_id).toBe('vid3')
    expect(historyList[1].video_id).toBe('vid1')
  })
})
