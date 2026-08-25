import { describe, expect, it } from 'vitest'
import { matchesKeyword, rankVietnameseFirst, vietnameseScore } from './vietnameseRank'

const v = (title: string, channelTitle = '') => ({ title, channelTitle })

describe('vietnameseScore', () => {
  it('tieu de co dau tieng Viet duoc diem cao nhat', () => {
    expect(vietnameseScore('Doraemon Tập 1')).toBeGreaterThan(vietnameseScore('Doraemon Episode 1'))
  })

  it('kenh co dau cung duoc cong diem du tieu de tieng Anh', () => {
    expect(vietnameseScore('Doraemon Movie', 'Phim Hoạt Hình')).toBeGreaterThan(
      vietnameseScore('Doraemon Movie', 'Anime Channel'),
    )
  })

  it('go KHONG DAU nhung co tu khoa Viet van duoc cong', () => {
    expect(vietnameseScore('Doraemon Tap 1 Thuyet Minh')).toBeGreaterThan(vietnameseScore('Doraemon Part 1'))
  })

  it('hoan toan tieng Anh thi 0 diem', () => {
    expect(vietnameseScore('Doraemon Full Movie', 'Anime TV')).toBe(0)
  })
})

describe('rankVietnameseFirst', () => {
  it('day ket qua Viet len dau', () => {
    const out = rankVietnameseFirst([
      v('Doraemon Episode 1', 'Anime TV'),
      v('ドラえもん', 'TV Asahi'),
      v('Doraemon Tập 1 Thuyết Minh', 'Phim Việt'),
    ])
    expect(out[0].title).toContain('Tập 1')
  })

  it('cung diem thi GIU NGUYEN thu tu YouTube tra ve', () => {
    const out = rankVietnameseFirst([v('A eng', 'X'), v('B eng', 'Y'), v('C eng', 'Z')])
    expect(out.map((o) => o.title)).toEqual(['A eng', 'B eng', 'C eng'])
  })

  it('khong lam mat mut nao', () => {
    const input = [v('a'), v('b ế'), v('c')]
    expect(rankVietnameseFirst(input)).toHaveLength(3)
  })

  it('thieu title/channel cung khong vo', () => {
    expect(rankVietnameseFirst([{}, { title: 'có dấu' }])).toHaveLength(2)
  })
})

describe('matchesKeyword', () => {
  it('tu khoa rong = khong loc gi', () => {
    expect(matchesKeyword('Bất kỳ video nào', '')).toBe(true)
    expect(matchesKeyword('X', '   ')).toBe(true)
  })

  it('khop khong phan biet hoa thuong', () => {
    expect(matchesKeyword('DORAEMON Tập 1', 'doraemon')).toBe(true)
  })

  it('go KHONG DAU van bat duoc tieu de CO DAU', () => {
    expect(matchesKeyword('Phim Hoạt Hình Vui', 'hoat hinh')).toBe(true)
  })

  it('go CO DAU van bat duoc tieu de khong dau', () => {
    expect(matchesKeyword('Phim Hoat Hinh Vui', 'hoạt hình')).toBe(true)
  })

  it('chu d gach ngang coi nhu d', () => {
    expect(matchesKeyword('Đồ Rêm', 'do rem')).toBe(true)
  })

  it('nhieu tu thi phai co DU, khong phai co mot tu la dau', () => {
    expect(matchesKeyword('Doraemon Tập 1', 'doraemon tap')).toBe(true)
    expect(matchesKeyword('Conan Tập 1', 'doraemon tap')).toBe(false)
  })

  it('khong khop thi loai', () => {
    expect(matchesKeyword('Conan Tập 5', 'doraemon')).toBe(false)
  })

  it('tim duoc ca trong ten kenh', () => {
    expect(matchesKeyword('Tập 1', 'doraemon', 'Doraemon Việt Nam')).toBe(true)
  })
})
