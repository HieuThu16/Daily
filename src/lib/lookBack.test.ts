import { describe, expect, it } from 'vitest'
import { buildLookBack, sameDayLastMonth, sameDayLastWeek, summarizeDay, summaryLine } from './lookBack'

describe('sameDayLastWeek', () => {
  it('lui dung 7 ngay', () => {
    expect(sameDayLastWeek('2026-08-25')).toBe('2026-08-18')
  })
  it('lui qua thang', () => {
    expect(sameDayLastWeek('2026-08-03')).toBe('2026-07-27')
  })
  it('lui qua nam', () => {
    expect(sameDayLastWeek('2026-01-03')).toBe('2025-12-27')
  })
})

describe('sameDayLastMonth', () => {
  it('thang truoc cung ngay', () => {
    expect(sameDayLastMonth('2026-08-25')).toBe('2026-07-25')
  })

  it('ngay 31 ma thang truoc chi co 30 -> kep ve ngay cuoi thang', () => {
    // Khong kep thi setMonth tu nhay sang thang sau: 31/03 -> 03/03
    expect(sameDayLastMonth('2026-03-31')).toBe('2026-02-28')
    expect(sameDayLastMonth('2026-07-31')).toBe('2026-06-30')
  })

  it('nam nhuan van dung', () => {
    expect(sameDayLastMonth('2024-03-31')).toBe('2024-02-29')
  })

  it('lui qua nam', () => {
    expect(sameDayLastMonth('2026-01-15')).toBe('2025-12-15')
  })
})

const DAY = '2026-08-18'

describe('summarizeDay', () => {
  it('dem dung tung loai trong DUNG ngay do', () => {
    const s = summarizeDay(DAY, 'WEEK', {
      entries: [
        { entry_date: DAY, content: 'Hom nay di bien' },
        { entry_date: DAY, content: 'An kem' },
        { entry_date: '2026-08-17', content: 'Ngay khac' },
      ],
      todos: [
        { completed: true, completed_at: DAY + 'T09:00:00Z' },
        { completed: true, completed_at: '2026-08-01T09:00:00Z' },
        { completed: false, completed_at: null },
      ],
      habitLogs: [
        { date: DAY, completed: true },
        { date: DAY, completed: false },
      ],
      mangaLogs: [{ readAt: DAY + 'T10:00:00Z' }],
      bookLogs: [{ log_date: DAY, durationMinutes: 45 }, { log_date: '2026-01-01', durationMinutes: 999 }],
      videoLogs: [{ log_date: DAY }, { log_date: DAY }],
    })
    expect(s.entries).toBe(2)
    expect(s.tasksDone).toBe(1)
    expect(s.habitsDone).toBe(1)
    expect(s.mangaChapters).toBe(1)
    expect(s.bookMinutes).toBe(45)
    expect(s.videos).toBe(2)
    expect(s.preview).toEqual(['Hom nay di bien', 'An kem'])
    expect(s.hasAnything).toBe(true)
  })

  it('ngay trong thi hasAnything = false', () => {
    expect(summarizeDay(DAY, 'WEEK', {}).hasAnything).toBe(false)
  })

  it('chi co phut doc sach cung tinh la co', () => {
    const s = summarizeDay(DAY, 'WEEK', { bookLogs: [{ log_date: DAY, durationMinutes: 20 }] })
    expect(s.hasAnything).toBe(true)
  })

  it('preview chi lay 3 dong dau', () => {
    const s = summarizeDay(DAY, 'WEEK', {
      entries: Array.from({ length: 9 }, (_, i) => ({ entry_date: DAY, content: 'dong ' + i })),
    })
    expect(s.preview).toHaveLength(3)
    expect(s.entries).toBe(9)
  })
})

describe('summaryLine', () => {
  it('chi liet ke thu CO', () => {
    const s = summarizeDay(DAY, 'WEEK', { entries: [{ entry_date: DAY, content: 'x' }] })
    expect(summaryLine(s)).toBe('1 nhật ký')
  })
  it('khong co gi thi noi thang', () => {
    expect(summaryLine(summarizeDay(DAY, 'WEEK', {}))).toBe('Hôm đó không ghi gì')
  })
})

describe('buildLookBack', () => {
  it('bo moc rong, chi giu moc co du lieu', () => {
    const out = buildLookBack('2026-08-25', {
      entries: [{ entry_date: '2026-08-18', content: 'tuan truoc' }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('WEEK')
    expect(out[0].date).toBe('2026-08-18')
  })

  it('ca hai moc co du lieu thi tra ca hai, tuan truoc dung dau', () => {
    const out = buildLookBack('2026-08-25', {
      entries: [
        { entry_date: '2026-08-18', content: 'a' },
        { entry_date: '2026-07-25', content: 'b' },
      ],
    })
    expect(out.map((x) => x.kind)).toEqual(['WEEK', 'MONTH'])
  })

  it('khong co gi thi tra rong, khong lam phien', () => {
    expect(buildLookBack('2026-08-25', {})).toEqual([])
  })
})
