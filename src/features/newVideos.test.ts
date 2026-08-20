import { describe, expect, it } from 'vitest'
import { groupByChannel, type VideoRow } from './newVideos'

const row = (creator: string, title: string): VideoRow => ({
  video_id: title,
  creator_name: creator,
  title,
  thumbnail: null,
  first_seen_at: '2026-08-20T01:00:00Z',
})

describe('groupByChannel', () => {
  it('gộp theo kênh và giữ tiêu đề mới nhất', () => {
    const out = groupByChannel([row('A', 'mới'), row('A', 'cũ'), row('B', 'khác')], 'reviews')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ creatorName: 'A', count: 2, latestTitle: 'mới', kind: 'reviews' })
    expect(out[1]).toMatchObject({ creatorName: 'B', count: 1 })
  })

  it('kênh thiếu tên vẫn có nhãn', () => {
    expect(groupByChannel([{ ...row('X', 't'), creator_name: null }], 'tvshow')[0].creatorName).toBe('Kênh không tên')
  })
})
