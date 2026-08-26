import { describe, expect, it } from 'vitest'
import { parseTikTokUsername, preferRecent } from './TikTokPage'

describe('parseTikTokUsername', () => {
  it('lay ten kenh tu link day du', () => {
    expect(parseTikTokUsername('https://www.tiktok.com/@anan.audio')).toBe('anan.audio')
    expect(parseTikTokUsername('https://tiktok.com/@abc/video/123')).toBe('abc')
  })

  it('go thang @ten cung duoc', () => {
    expect(parseTikTokUsername('@anan_audio')).toBe('anan_audio')
    expect(parseTikTokUsername('anan_audio')).toBe('anan_audio')
  })

  it('bo ky tu la, khong de lot vao url', () => {
    expect(parseTikTokUsername('  @abc?x=1  ')).toBe('abcx1')
  })

  it('rong thi tra rong', () => {
    expect(parseTikTokUsername('   ')).toBe('')
  })
})

const NOW = Date.parse('2026-08-25T00:00:00Z')
const v = (id: string, iso: string | null) =>
  ({ video_id: id, published_at: iso }) as never

describe('preferRecent', () => {
  /*
   * Dùng NHIỀU phần tử chứ không phải 2: shuffle là ngẫu nhiên, nên với 2 phần
   * tử một hàm sai vẫn đúng ~50% số lần chạy — test kiểu đó không chứng minh gì.
   * Với 10+10 thì trộn lẫn gần như chắc chắn lộ ra.
   */
  const many = (n: number, iso: string | null, prefix: string) =>
    Array.from({ length: n }, (_, i) => v(prefix + i, iso))

  it('MOI dang len truoc het, roi moi toi cu', () => {
    const list = [...many(10, '2019-01-01T00:00:00Z', 'cu'), ...many(10, '2026-08-01T00:00:00Z', 'moi')]
    const out = preferRecent(list, NOW) as Array<{ video_id: string }>
    expect(out.slice(0, 10).every((x) => x.video_id.startsWith('moi'))).toBe(true)
    expect(out.slice(10).every((x) => x.video_id.startsWith('cu'))).toBe(true)
  })

  it('khong co ngay thi xep vao nhom cu, khong bi mat', () => {
    const list = [...many(10, null, 'khongngay'), ...many(10, '2026-08-01T00:00:00Z', 'moi')]
    const out = preferRecent(list, NOW) as Array<{ video_id: string }>
    expect(out).toHaveLength(20)
    expect(out.slice(0, 10).every((x) => x.video_id.startsWith('moi'))).toBe(true)
  })

  it('ngay hong khong lam vo, van giu video', () => {
    expect(preferRecent([v('hong', 'khong-phai-ngay')], NOW)).toHaveLength(1)
  })

  it('giu du so luong', () => {
    const list = many(15, '2026-08-01T00:00:00Z', 'a').concat(many(15, '2019-01-01T00:00:00Z', 'b'))
    expect(preferRecent(list, NOW)).toHaveLength(30)
  })
})
