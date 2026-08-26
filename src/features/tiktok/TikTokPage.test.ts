import { describe, expect, it } from 'vitest'
import { parseTikTokUsername, preferRecent, sortFeed } from './TikTokPage'

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
/** Trong cửa sổ RECENT_DAYS (10 ngày) tính từ NOW. */
const MOI = '2026-08-23T00:00:00Z'
/** Ngoài cửa sổ — cũ hơn 10 ngày. */
const CU = '2026-07-01T00:00:00Z'
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
    const list = [...many(10, CU, 'cu'), ...many(10, MOI, 'moi')]
    const out = preferRecent(list, NOW) as Array<{ video_id: string }>
    expect(out.slice(0, 10).every((x) => x.video_id.startsWith('moi'))).toBe(true)
    expect(out.slice(10).every((x) => x.video_id.startsWith('cu'))).toBe(true)
  })

  it('khong co ngay thi xep vao nhom cu, khong bi mat', () => {
    const list = [...many(10, null, 'khongngay'), ...many(10, MOI, 'moi')]
    const out = preferRecent(list, NOW) as Array<{ video_id: string }>
    expect(out).toHaveLength(20)
    expect(out.slice(0, 10).every((x) => x.video_id.startsWith('moi'))).toBe(true)
  })

  it('ngay hong khong lam vo, van giu video', () => {
    expect(preferRecent([v('hong', 'khong-phai-ngay')], NOW)).toHaveLength(1)
  })

  it('giu du so luong', () => {
    const list = many(15, MOI, 'a').concat(many(15, CU, 'b'))
    expect(preferRecent(list, NOW)).toHaveLength(30)
  })
})

const vid = (id: string, play: number | null, iso: string | null) =>
  ({ video_id: id, play_count: play, published_at: iso }) as never
const ids = (list: unknown[]) => (list as Array<{ video_id: string }>).map((x) => x.video_id)

describe('sortFeed', () => {
  it('mac dinh thi giu nguyen thu tu, khong dong vao', () => {
    const list = [vid('a', 1, null), vid('b', 999, null)]
    expect(sortFeed(list, 'default')).toBe(list)
  })

  it('theo view: nhieu nhat truoc', () => {
    const out = sortFeed([vid('it', 10, null), vid('nhieu', 9000, null), vid('vua', 500, null)], 'views')
    expect(ids(out)).toEqual(['nhieu', 'vua', 'it'])
  })

  it('theo ngay: moi nhat truoc', () => {
    const out = sortFeed(
      [vid('cu', null, '2020-01-01T00:00:00Z'), vid('moi', null, '2026-08-01T00:00:00Z')],
      'date',
    )
    expect(ids(out)).toEqual(['moi', 'cu'])
  })

  it('THIEU so lieu thi xuong cuoi, KHONG coi nhu 0 luot xem', () => {
    /*
     * Video trong kho khong co play_count. Coi la 0 thi chung lan vao nhom it view.
     *
     * Dung NHIEU phan tu xen ke: co hai nhanh xu ly gia tri thieu (a null va b
     * null), ma voi 2 phan tu thi V8 chi goi trung mot nhanh - dot bien o nhanh
     * kia se bi che, test pass gia.
     */
    const list = [
      vid('trong0', null, null), vid('co1', 10, null),
      vid('trong1', null, null), vid('co2', 5000, null),
      vid('trong2', null, null), vid('co3', 700, null),
      vid('trong3', null, null), vid('co4', 90, null),
    ]
    const out = ids(sortFeed(list, 'views'))
    // Bon video co so lieu phai dung TRUOC, xep giam dan
    expect(out.slice(0, 4)).toEqual(['co2', 'co3', 'co4', 'co1'])
    expect(out.slice(4).every((x) => x.startsWith('trong'))).toBe(true)
  })

  it('cac video cung thieu so lieu thi giu nguyen thu tu cu', () => {
    const out = sortFeed([vid('a', null, null), vid('b', null, null), vid('c', null, null)], 'views')
    expect(ids(out)).toEqual(['a', 'b', 'c'])
  })

  it('ngay hong coi nhu thieu, khong lam vo', () => {
    const out = sortFeed([vid('hong', null, 'khong-phai-ngay'), vid('that', null, '2026-01-01T00:00:00Z')], 'date')
    expect(ids(out)).toEqual(['that', 'hong'])
  })

  it('khong lam mat video nao', () => {
    const list = Array.from({ length: 20 }, (_, i) => vid('v' + i, i % 3 ? i * 100 : null, null))
    expect(sortFeed(list, 'views')).toHaveLength(20)
  })
})
