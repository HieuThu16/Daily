import { describe, expect, it } from 'vitest'
import { addDays, buildQueue, deckStats, initialSrs, intervalLabel, isDue, retrievability, review, reviewStreak, withSrsDefaults } from './srs'
import type { SrsFields } from './srs'

const TODAY = '2026-08-18'

describe('srs', () => {
  it('thẻ mới đến hạn ngay hôm nay', () => {
    const card = initialSrs(TODAY)
    expect(isDue(card, TODAY)).toBe(true)
    expect(card.reps).toBe(0)
  })

  it('cộng ngày qua ranh giới tháng và năm', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('nhớ liên tiếp thì khoảng cách giãn dần', () => {
    // FSRS không cố định 1-3 ngày như SM-2; điều phải đúng là lần sau xa hơn lần trước.
    let card = review(initialSrs(TODAY), 'GOOD', TODAY)
    const first = card.interval_days
    card = review(card, 'GOOD', card.due_date)
    const second = card.interval_days
    card = review(card, 'GOOD', card.due_date)

    expect(first).toBeGreaterThanOrEqual(1)
    expect(second).toBeGreaterThan(first)
    expect(card.interval_days).toBeGreaterThan(second)
  })

  it('bấm Quên thì đặt lại tiến độ, đếm thêm một lần lỡ và hẹn lại hôm nay', () => {
    let card = review(initialSrs(TODAY), 'GOOD', TODAY)
    card = review(card, 'AGAIN', TODAY)
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(1)
    expect(card.due_date).toBe(TODAY)
  })

  it('hệ số dễ không tụt dưới 1.3 dù quên bao nhiêu lần', () => {
    let card = initialSrs(TODAY)
    for (let i = 0; i < 20; i++) card = review(card, 'AGAIN', TODAY)
    expect(card.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('Dễ giãn xa hơn Được, Được giãn xa hơn Khó', () => {
    // Ôn đúng ngày đến hạn ba lần cho thẻ đủ "chín", rồi mới so ba mức chấm.
    let card = review(initialSrs(TODAY), 'GOOD', TODAY)
    card = review(card, 'GOOD', card.due_date)
    card = review(card, 'GOOD', card.due_date)

    const day = card.due_date
    const hard = review(card, 'HARD', day).interval_days
    const good = review(card, 'GOOD', day).interval_days
    const easy = review(card, 'EASY', day).interval_days
    expect(hard).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })

  it('quên thì độ bền tụt xuống, không giữ nguyên', () => {
    let card = review(initialSrs(TODAY), 'GOOD', TODAY)
    card = review(card, 'GOOD', card.due_date)
    const before = card.stability ?? 0
    const after = review(card, 'AGAIN', card.due_date).stability ?? 0
    expect(after).toBeLessThan(before)
    expect(after).toBeGreaterThan(0)
  })

  it('xác suất nhớ giảm dần theo ngày và bằng ~0.9 tại mốc độ bền', () => {
    expect(retrievability(10, 0)).toBe(1)
    expect(retrievability(10, 10)).toBeGreaterThan(retrievability(10, 30))
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 1)
  })

  it('thẻ cũ từ thời SM-2 chưa có stability vẫn xếp lịch được', () => {
    const legacy = { ...initialSrs(TODAY), reps: 4, interval_days: 30, ease: 2.5, due_date: TODAY, stability: 0 }
    const next = review(legacy, 'GOOD', TODAY)
    expect(next.interval_days).toBeGreaterThan(30)
    expect(next.stability).toBeGreaterThan(0)
  })

  it('hàng đợi chỉ lấy thẻ đến hạn, ưu tiên thẻ hay quên, và tôn trọng mục tiêu ngày', () => {
    const cards = [
      { id: 'a', ...initialSrs(TODAY) },
      { id: 'b', ...initialSrs(TODAY), lapses: 5 },
      { id: 'c', ...initialSrs('2027-01-01') },
    ]
    expect(buildQueue(cards, TODAY, 10).map((c) => c.id)).toEqual(['b', 'a'])
    expect(buildQueue(cards, TODAY, 1)).toHaveLength(1)
  })

  it('thống kê phân biệt thẻ mới và thẻ đã thuộc', () => {
    const cards = [
      { ...initialSrs(TODAY) },
      { ...initialSrs(TODAY), reps: 4, interval_days: 30, due_date: '2027-01-01' },
    ]
    expect(deckStats(cards, TODAY)).toEqual({ total: 2, due: 1, fresh: 1, mature: 1 })
  })

  it('điền mặc định cho thẻ cũ chưa có cột SRS', () => {
    const filled = withSrsDefaults({ id: 'x' } as { id: string } & Partial<SrsFields>, TODAY)
    expect(filled.ease).toBe(2.5)
    expect(filled.due_date).toBe(TODAY)
    expect(filled.reps).toBe(0)
  })

  it('nhãn khoảng cách đọc được bằng tiếng Việt', () => {
    const long = { ...initialSrs(TODAY), reps: 5, interval_days: 30 }
    expect(intervalLabel(long, 'AGAIN')).toBe('lát nữa')
    expect(intervalLabel(initialSrs(TODAY), 'GOOD')).toMatch(/ngày$/)
    expect(intervalLabel(long, 'GOOD')).toMatch(/tuần|tháng/)
  })
})

describe('reviewStreak', () => {
  it('đếm ngược liên tiếp từ hôm nay', () => {
    expect(reviewStreak(['2026-08-18', '2026-08-17', '2026-08-16'], '2026-08-18')).toBe(3)
  })

  it('hôm nay chưa ôn thì vẫn giữ chuỗi tính từ hôm qua', () => {
    expect(reviewStreak(['2026-08-17', '2026-08-16'], '2026-08-18')).toBe(2)
  })

  it('nghỉ hai ngày là đứt chuỗi', () => {
    expect(reviewStreak(['2026-08-15', '2026-08-14'], '2026-08-18')).toBe(0)
  })
})
