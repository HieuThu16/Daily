import { describe, expect, it } from 'vitest'
import { filterVietnamese, isVietnameseText, matchesKeyword, rankVietnameseFirst, vietnameseScore } from './vietnameseRank'

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

describe('isVietnameseText', () => {
  it('co dau la chac chan tieng Viet', () => {
    expect(isVietnameseText('Món ngon mỗi ngày')).toBe(true)
  })

  it('caption TikTok chi co hashtag khong dau van nhan ra', () => {
    expect(isVietnameseText('#xuhuong #reviewphim')).toBe(true)
    expect(isVietnameseText('#monngon #nauan')).toBe(true)
  })

  it('tieng Anh / tieng Trung thi khong', () => {
    expect(isVietnameseText('Funny cat compilation #fyp')).toBe(false)
    expect(isVietnameseText('搞笑视频')).toBe(false)
  })

  it('chuoi rong thi khong', () => {
    expect(isVietnameseText('')).toBe(false)
  })
})

describe('filterVietnamese', () => {
  it('LOC HAN clip khong phai tieng Viet, khong chi xep lai', () => {
    const feed = [
      { title: 'Funny cat #fyp' },
      { title: 'Review phim hay cực đỉnh' },
      { title: '搞笑视频' },
      { title: '#xuhuong' },
    ]
    const out = filterVietnamese(feed, (v) => v.title)
    expect(out).toHaveLength(2)
    expect(out.every((v) => !v.title.includes('cat'))).toBe(true)
  })

  it('khong con gi thi tra mang rong chu khong vo', () => {
    expect(filterVietnamese([{ title: 'hello' }], (v) => v.title)).toEqual([])
  })
})
