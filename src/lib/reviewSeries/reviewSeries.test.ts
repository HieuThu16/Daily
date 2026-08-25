import { describe, expect, it } from 'vitest'
import { detectPart, movieKey } from './partDetector'
import { resolveSeries } from './seriesResolver'
import { evaluateCompletion } from './completion'
import type { NormalizedVideo } from './types.js'

const video = (over: Partial<NormalizedVideo>): NormalizedVideo => ({
  platform: 'youtube',
  creatorId: 'UC1',
  creatorName: 'Channel A',
  videoId: 'v1',
  canonicalUrl: 'https://www.youtube.com/watch?v=v1',
  embedUrl: 'https://www.youtube.com/embed/v1',
  title: '',
  description: '',
  publishedAt: '2026-08-01T00:00:00Z',
  duration: 600,
  thumbnail: null,
  playlistId: null,
  playlistName: null,
  position: null,
  rawMetadata: {},
  ...over,
})

describe('detectPart', () => {
  it.each([
    ['Harry Potter Part 1', 1],
    ['Harry Potter P01', 1],
    ['Harry Potter phần 3', 3],
    ['Harry Potter phan 3', 3],
    ['Harry Potter - tập 4', 4],
    ['Interstellar ep 2', 2],
    ['Review phim #5', 5],
  ])('%s → phần %i', (title, part) => {
    expect(detectPart(title as string).partNumber).toBe(part)
  })

  it('đọc được tổng số phần', () => {
    expect(detectPart('Harry Potter - P3/5')).toMatchObject({ partNumber: 3, totalParts: 5 })
    expect(detectPart('Harry Potter 1 of 5')).toMatchObject({ partNumber: 1, totalParts: 5 })
  })

  it('bỏ tổng vô lý nhỏ hơn phần hiện tại', () => {
    expect(detectPart('Review ngay 12/5').totalParts).toBeNull()
  })

  it('nhận từ khoá phần cuối', () => {
    expect(detectPart('Harry Potter phần cuối').isFinal).toBe(true)
    expect(detectPart('Interstellar - final part').isFinal).toBe(true)
  })

  it('không đoán bừa thành phần 1', () => {
    expect(detectPart('Review phim Interstellar').partNumber).toBeNull()
  })
})

describe('movieKey', () => {
  it('các cách viết khác nhau về cùng một khoá', () => {
    const keys = ['Harry Potter P1', 'Harry Potter phần 1', 'Harry Potter part 1', 'Harry Potter - tập 1'].map(movieKey)
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toBe('harry potter')
  })
})

describe('resolveSeries', () => {
  it('gom theo playlist khi có', () => {
    const series = resolveSeries([
      video({ videoId: 'a', title: 'HP tập 1', playlistId: 'PL1', playlistName: 'Harry Potter Review', position: 0 }),
      video({ videoId: 'b', title: 'HP tập 2', playlistId: 'PL1', playlistName: 'Harry Potter Review', position: 1 }),
    ])
    expect(series).toHaveLength(1)
    expect(series[0].playlistId).toBe('PL1')
    expect(series[0].movie.evidence).toContain('playlist')
  })

  it('gom theo tên phim khi không có playlist', () => {
    const series = resolveSeries([
      video({ videoId: 'a', title: 'Harry Potter phần 1' }),
      video({ videoId: 'b', title: 'Harry Potter phần 2' }),
      video({ videoId: 'c', title: 'Interstellar phần 1' }),
    ])
    expect(series).toHaveLength(2)
    expect(series.find((s) => s.movie.movieId === 'harry potter')?.videos).toHaveLength(2)
  })

  it('playlist tổng gộp nhiều phim thì tách ra, không dính thành một series', () => {
    // Kênh thật hay dồn mọi phim vào một playlist "Review Phim Bộ".
    const series = resolveSeries(
      ['Harry Potter review', 'Interstellar review', 'Titanic review', 'Joker review'].map((title, i) =>
        video({ videoId: `v${i}`, title, playlistId: 'PLALL', playlistName: 'Review Phim Bộ', position: i }),
      ),
    )
    expect(series).toHaveLength(4)
    // Tên playlist tổng không được leo lên làm tên phim.
    expect(series.every((s) => s.playlistId === null)).toBe(true)
    expect(series.every((s) => s.movie.movieTitle !== 'Review Phim Bộ')).toBe(true)
  })

  it('playlist của đúng một phim thì vẫn giữ nguyên', () => {
    const series = resolveSeries(
      ['Harry Potter phần 1', 'Harry Potter phần 2', 'Harry Potter phần 3'].map((title, i) =>
        video({ videoId: `v${i}`, title, playlistId: 'PLHP', playlistName: 'Harry Potter Review', position: i }),
      ),
    )
    expect(series).toHaveLength(1)
    expect(series[0].playlistId).toBe('PLHP')
  })

  it('sắp video theo số phần', () => {
    const series = resolveSeries([
      video({ videoId: 'b', title: 'Harry Potter phần 2' }),
      video({ videoId: 'a', title: 'Harry Potter phần 1' }),
    ])
    expect(series[0].videos.map((v) => v.videoId)).toEqual(['a', 'b'])
  })
})

const seriesOf = (titles: string[], over: Partial<NormalizedVideo> = {}) =>
  resolveSeries(titles.map((title, i) => video({ videoId: `v${i}`, title, ...over })))[0]

describe('evaluateCompletion', () => {
  const now = new Date('2026-08-10T00:00:00Z')

  it('playlist đủ số item → COMPLETE', () => {
    const series = seriesOf(['HP phần 1', 'HP phần 2', 'HP phần 3'], { playlistId: 'PL1', playlistName: 'HP Review' })
    expect(evaluateCompletion({ series, playlistItemCount: 3, now })).toMatchObject({
      status: 'COMPLETE',
      expected: 3,
      found: 3,
    })
  })

  it('playlist thiếu item → INCOMPLETE và chỉ ra phần thiếu', () => {
    const series = seriesOf(['HP phần 1', 'HP phần 2', 'HP phần 3', 'HP phần 5'], {
      playlistId: 'PL1',
      playlistName: 'HP Review',
    })
    expect(evaluateCompletion({ series, playlistItemCount: 5, now })).toMatchObject({
      status: 'INCOMPLETE',
      missingParts: [4],
    })
  })

  it('có phần cuối và dãy liền mạch → COMPLETE', () => {
    const series = seriesOf(['HP phần 1', 'HP phần 2', 'HP phần 3 - phần cuối'])
    expect(evaluateCompletion({ series, now }).status).toBe('COMPLETE')
  })

  it('khai 5 phần nhưng mới có 3 → INCOMPLETE', () => {
    const series = seriesOf(['HP P1/5', 'HP P2/5', 'HP P3/5'])
    expect(evaluateCompletion({ series, now })).toMatchObject({
      status: 'INCOMPLETE',
      expected: 5,
      missingParts: [4, 5],
    })
  })

  it('thiếu phần giữa → INCOMPLETE, không im lặng bỏ qua', () => {
    const series = seriesOf(['HP phần 1', 'HP phần 2', 'HP phần 3', 'HP phần 5'])
    expect(evaluateCompletion({ series, now })).toMatchObject({ status: 'INCOMPLETE', missingParts: [4] })
  })

  it('lâu không đăng chỉ là STALLED, không phải COMPLETE', () => {
    const series = seriesOf(['HP phần 1', 'HP phần 2'])
    expect(evaluateCompletion({ series, now: new Date('2026-12-01T00:00:00Z') }).status).toBe('STALLED')
  })

  it('không đủ bằng chứng → UNKNOWN', () => {
    const series = seriesOf(['HP phần 1', 'HP phần 2'])
    expect(evaluateCompletion({ series, now }).status).toBe('UNKNOWN')
  })

  it('playlist tăng số item làm series COMPLETE quay lại INCOMPLETE', () => {
    const series = seriesOf(['HP phần 1', 'HP phần 2', 'HP phần 3'], { playlistId: 'PL1', playlistName: 'HP Review' })
    expect(evaluateCompletion({ series, playlistItemCount: 3, now }).status).toBe('COMPLETE')
    expect(evaluateCompletion({ series, playlistItemCount: 4, now })).toMatchObject({
      status: 'INCOMPLETE',
      missingParts: [4],
    })
  })
})
