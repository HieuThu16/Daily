import { describe, expect, it } from 'vitest'
import { extractPartInfo, extractSeriesName, groupVideosIntoSeries } from './tiktokSeries'

describe('TikTok Series Parser & Grouper', () => {
  describe('extractPartInfo', () => {
    it('nhận diện các biến thể P1, P02, Phần 3, Tập 4, Part 5', () => {
      expect(extractPartInfo('Review Phim Squid Game P1').partNumber).toBe(1)
      expect(extractPartInfo('Tóm tắt phim Ký Sinh Trùng Phần 2').partNumber).toBe(2)
      expect(extractPartInfo('Review Phim Hàn Quốc Tap 03').partNumber).toBe(3)
      expect(extractPartInfo('Review Phim Conan Part 4/10').partNumber).toBe(4)
      expect(extractPartInfo('Review Phim Conan Part 4/10').totalParts).toBe(10)
      expect(extractPartInfo('Review Phim #05').partNumber).toBe(5)
    })

    it('nhận diện tập cuối / kết thúc', () => {
      const res = extractPartInfo('Review Phim Cuộc Chiến Sinh Tồn Phần Cuối #xuhuong')
      expect(res.isFinal).toBe(true)
    })
  })

  describe('extractSeriesName', () => {
    it('rút sạch tên phim từ caption chứa hashtag và từ khóa rác', () => {
      const name = extractSeriesName('Review Phim Ký Sinh Trùng P1 Thuyết Minh Full HD #fyp #reviewphim')
      expect(name.toLowerCase()).toContain('ký sinh trùng')
      expect(name).not.toContain('#fyp')
      expect(name).not.toContain('P1')
    })
  })

  describe('groupVideosIntoSeries', () => {
    it('gom đúng các video cùng tên phim thành 1 series và sắp thứ tự', () => {
      const rawEntries = [
        {
          id: 'v2',
          title: 'Review Phim Avatar P2',
          url: 'https://tiktok.com/@test/v2',
        },
        {
          id: 'v1',
          title: 'Review Phim Avatar P1',
          url: 'https://tiktok.com/@test/v1',
        },
        {
          id: 'v3',
          title: 'Review Phim Avatar Phần Cuối',
          url: 'https://tiktok.com/@test/v3',
        },
      ]

      const grouped = groupVideosIntoSeries(rawEntries, {
        creator_id: 'test_creator',
        creator_name: 'test_creator',
        creator_url: 'https://tiktok.com/@test',
      })

      expect(grouped.length).toBe(1)
      expect(grouped[0].videos.length).toBe(3)
      expect(grouped[0].videos[0].video_id).toBe('v1')
      expect(grouped[0].videos[1].video_id).toBe('v2')
      expect(grouped[0].videos[2].video_id).toBe('v3')
      expect(grouped[0].status).toBe('COMPLETE')
    })
  })
})
