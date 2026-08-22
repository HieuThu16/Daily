import { beforeEach, describe, expect, it } from 'vitest'
import {
  getBookReadingSessionLogs,
  groupBookReadingLogs,
  recordBookReadingSession,
  summarizeBookSessions,
  type BookReadingSessionLog,
} from './bookReadingLog'

const mockLog = (over: Partial<BookReadingSessionLog>): BookReadingSessionLog => ({
  id: 'test_id',
  mediaItemId: 'book_1',
  bookTitle: 'Đắc Nhân Tâm',
  bookAuthor: 'Dale Carnegie',
  startPage: 1,
  endPage: 10,
  pagesRead: 10,
  startTime: '2026-08-20T10:00:00.000Z',
  endTime: '2026-08-20T10:30:00.000Z',
  log_date: '2026-08-20',
  log_time: '10:00',
  durationMinutes: 30,
  ...over,
})

describe('bookReadingLog', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lưu và đọc lại phiên đọc sách', () => {
    recordBookReadingSession({
      mediaItemId: 'book_1',
      bookTitle: 'Nhà Giả Kim',
      startPage: 15,
      endPage: 30,
      durationMinutes: 25,
    })

    const logs = getBookReadingSessionLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].bookTitle).toBe('Nhà Giả Kim')
    expect(logs[0].startPage).toBe(15)
    expect(logs[0].endPage).toBe(30)
    expect(logs[0].pagesRead).toBe(16)
  })

  it('gộp các phiên đọc cùng sách gần nhau', () => {
    const startIso = new Date('2026-08-22T10:00:00Z').toISOString()
    const midIso = new Date('2026-08-22T10:15:00Z').toISOString()

    recordBookReadingSession({
      mediaItemId: 'book_1',
      bookTitle: 'Nhà Giả Kim',
      startPage: 1,
      endPage: 10,
      durationMinutes: 15,
      startTime: startIso,
      endTime: startIso,
    })

    recordBookReadingSession({
      mediaItemId: 'book_1',
      bookTitle: 'Nhà Giả Kim',
      startPage: 10,
      endPage: 25,
      durationMinutes: 15,
      startTime: midIso,
      endTime: midIso,
    })

    const logs = getBookReadingSessionLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].startPage).toBe(1)
    expect(logs[0].endPage).toBe(25)
    expect(logs[0].pagesRead).toBe(25)
    expect(logs[0].durationMinutes).toBe(30)
  })

  it('tính chuỗi ngày đọc sách (streak) chuẩn xác', () => {
    const logs = [
      mockLog({ log_date: '2026-08-22', pagesRead: 20 }),
      mockLog({ log_date: '2026-08-21', pagesRead: 15 }),
      mockLog({ log_date: '2026-08-20', pagesRead: 30 }),
    ]

    const stats = summarizeBookSessions(logs, '2026-08-22')
    expect(stats.streak).toBe(3)
    expect(stats.totalPages).toBe(65)
  })

  it('gom nhóm phiên đọc sách cho dòng thời gian', () => {
    const logs = [
      mockLog({
        bookTitle: 'Tuổi Trẻ Đáng Giá Bao Nhiêu',
        startPage: 10,
        endPage: 25,
        pagesRead: 16,
        log_time: '09:00',
        startTime: '2026-08-22T09:00:00Z',
        endTime: '2026-08-22T09:30:00Z',
        durationMinutes: 30,
      }),
    ]

    const events = groupBookReadingLogs(logs)
    expect(events).toHaveLength(1)
    expect(events[0].label).toBe('Đọc sách')
    expect(events[0].detail).toContain('Tuổi Trẻ Đáng Giá Bao Nhiêu')
    expect(events[0].detail).toContain('16 trang')
    expect(events[0].detail).toContain('Trang 10 → 25')
  })
})
