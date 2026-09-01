import { describe, it, expect, beforeEach } from 'vitest'
import {
  addCrawlHistoryItem,
  getCrawlHistory,
  getCrawlStats,
  deleteCrawlHistoryItem,
  clearCrawlHistory,
  formatRelativeTime,
} from './dilibCrawlerHistory'

describe('dilibCrawlerHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('thêm mục lịch sử cào sách và tính thống kê theo khoảng thời gian', () => {
    const now = Date.now()

    // 1 mục trong vòng 10 phút trước
    addCrawlHistoryItem({
      title: 'Đắc Nhân Tâm',
      author: 'Dale Carnegie',
      source: 'Dilib',
      hasAudio: true,
      hasPdf: true,
      audioCount: 15,
      readbookUrl: 'https://dilib.vn/read',
      addedAudio: true,
      addedPdf: false,
      action: 'ADDED_AUDIO_TO_EXISTING_PDF',
      actionLabel: '⚡ Đã có PDF -> Bổ sung Sách nói',
      crawledAt: new Date(now - 10 * 60 * 1000).toISOString(),
    })

    // 1 mục 3 giờ trước (trong 24h)
    addCrawlHistoryItem({
      title: 'Nghĩ Giàu Làm Giàu',
      author: 'Napoleon Hill',
      source: 'DTV eBook',
      hasAudio: false,
      hasPdf: true,
      audioCount: 0,
      readbookUrl: 'https://dtv-ebook.com/read',
      addedAudio: false,
      addedPdf: true,
      action: 'NEW_PDF',
      actionLabel: '✨ Thêm mới Sách đọc PDF',
      crawledAt: new Date(now - 3 * 3600 * 1000).toISOString(),
    })

    // 1 mục 2 ngày trước (chỉ thuộc ALL)
    addCrawlHistoryItem({
      title: 'Nhà Giả Kim',
      author: 'Paulo Coelho',
      source: 'Dilib',
      hasAudio: true,
      hasPdf: true,
      audioCount: 10,
      readbookUrl: 'https://dilib.vn/read2',
      addedAudio: true,
      addedPdf: true,
      action: 'NEW_BOTH',
      actionLabel: '✨ Thêm mới Sách nói & PDF',
      crawledAt: new Date(now - 48 * 3600 * 1000).toISOString(),
    })

    const history = getCrawlHistory()
    expect(history.length).toBe(3)

    // Kiểm tra thống kê 1H
    const stats1H = getCrawlStats('1H')
    expect(stats1H.totalScanned).toBe(1)
    expect(stats1H.totalAdded).toBe(1)
    expect(stats1H.audioAdded).toBe(1)
    expect(stats1H.pdfAdded).toBe(0)
    expect(stats1H.smartIncrementalCount).toBe(1)
    expect(stats1H.totalAudioTracks).toBe(15)

    // Kiểm tra thống kê 24H
    const stats24H = getCrawlStats('24H')
    expect(stats24H.totalScanned).toBe(2)
    expect(stats24H.totalAdded).toBe(2)
    expect(stats24H.audioAdded).toBe(1)
    expect(stats24H.pdfAdded).toBe(1)
    expect(stats24H.smartIncrementalCount).toBe(1)

    // Kiểm tra thống kê ALL
    const statsAll = getCrawlStats('ALL')
    expect(statsAll.totalScanned).toBe(3)
    expect(statsAll.totalAdded).toBe(3)
    expect(statsAll.audioAdded).toBe(2)
    expect(statsAll.pdfAdded).toBe(2)
    expect(statsAll.smartIncrementalCount).toBe(1)
  })

  it('xóa từng mục và xóa toàn bộ lịch sử cào sách', () => {
    addCrawlHistoryItem({
      title: 'Tâm Lý Học Tội Phạm',
      author: 'Diệp Lạc',
      source: 'Dilib',
      hasAudio: true,
      hasPdf: false,
      audioCount: 8,
      readbookUrl: '',
      addedAudio: true,
      addedPdf: false,
      action: 'NEW_AUDIO',
      actionLabel: '✨ Thêm mới Sách nói',
    })

    let history = getCrawlHistory()
    expect(history.length).toBe(1)

    deleteCrawlHistoryItem(history[0].id)
    expect(getCrawlHistory().length).toBe(0)

    addCrawlHistoryItem({
      title: 'Sách A',
      author: 'Tác giả A',
      source: 'Dilib',
      hasAudio: true,
      hasPdf: true,
      audioCount: 5,
      readbookUrl: '',
      addedAudio: true,
      addedPdf: true,
      action: 'NEW_BOTH',
      actionLabel: '✨ Thêm mới',
    })
    clearCrawlHistory()
    expect(getCrawlHistory().length).toBe(0)
  })

  it('định dạng thời gian tương đối chính xác', () => {
    const now = Date.now()
    expect(formatRelativeTime(new Date(now - 30 * 1000).toISOString())).toBe('Vừa xong')
    expect(formatRelativeTime(new Date(now - 5 * 60 * 1000).toISOString())).toBe('5 phút trước')
    expect(formatRelativeTime(new Date(now - 2 * 3600 * 1000).toISOString())).toBe('2 giờ trước')
  })
})
