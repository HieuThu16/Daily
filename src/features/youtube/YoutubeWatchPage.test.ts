import { describe, expect, it } from 'vitest'
import { buildFallbackVideo } from './YoutubeWatchPage'

describe('buildFallbackVideo', () => {
  it('uu tien thong tin gui kem luc dieu huong', () => {
    const v = buildFallbackVideo(
      'abc123',
      { title: 'Truyen Audio', channelName: 'AnAn Audio', thumbnail: 'https://x/t.jpg' },
      { title: 'Tu oEmbed', author: 'Kenh khac' },
    )
    expect(v.title).toBe('Truyen Audio')
    expect(v.creator_name).toBe('AnAn Audio')
    expect(v.thumbnail).toBe('https://x/t.jpg')
  })

  it('vao thang bang URL thi lay tu oEmbed', () => {
    const v = buildFallbackVideo('abc123', null, { title: 'Tu oEmbed', author: 'AnAn Audio' })
    expect(v.title).toBe('Tu oEmbed')
    expect(v.creator_name).toBe('AnAn Audio')
    // Khong co anh thi lay anh mac dinh cua YouTube chu khong de trong
    expect(v.thumbnail).toContain('abc123')
  })

  it('khong co gi thi VAN phat duoc, khong bao khong tim thay', () => {
    const v = buildFallbackVideo('abc123')
    expect(v.video_id).toBe('abc123')
    expect(v.title).toBe('Video YouTube')
    expect(v.canonical_url).toBe('https://www.youtube.com/watch?v=abc123')
    expect(v.notInApp).toBe(true)
  })

  it('danh dau notInApp de UI biet ma hien ghi chu', () => {
    expect(buildFallbackVideo('x', { title: 'A' }).notInApp).toBe(true)
  })
})
