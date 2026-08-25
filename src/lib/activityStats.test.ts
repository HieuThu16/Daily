import { describe, expect, it } from 'vitest'
import { buildActivityStats, formatMoney, longestStreak } from './activityStats'

const base = { from: '2026-08-01', days: 30, today: '2026-08-25' }
const find = (out: ReturnType<typeof buildActivityStats>, key: string) => out.find((s) => s.key === key)

describe('formatMoney', () => {
  it('rut gon cho de doc tren dien thoai', () => {
    expect(formatMoney(950)).toBe('950 d'.replace('d', 'đ'))
    expect(formatMoney(350_000)).toBe('350 nghìn')
    expect(formatMoney(1_200_000)).toBe('1.2 triệu')
    expect(formatMoney(12_000_000)).toBe('12 triệu')
    expect(formatMoney(-5_000_000)).toBe('5 triệu')
  })
})

describe('longestStreak', () => {
  it('dem chuoi ngay lien tiep dai nhat', () => {
    expect(longestStreak(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-09'])).toBe(3)
    expect(longestStreak(['2026-08-01', '2026-08-03'])).toBe(1)
    expect(longestStreak([])).toBe(0)
  })
  it('ngay trung nhau chi tinh mot lan', () => {
    expect(longestStreak(['2026-08-01', '2026-08-01', '2026-08-02'])).toBe(2)
  })
  it('khong nham qua thang', () => {
    expect(longestStreak(['2026-07-31', '2026-08-01'])).toBe(2)
  })
})

describe('buildActivityStats', () => {
  it('khong co du lieu thi khong tao muc rong nao', () => {
    expect(buildActivityStats(base)).toEqual([])
  })

  it('bo qua dong cu hon moc thoi gian', () => {
    const out = buildActivityStats({
      ...base,
      entries: [
        { id: '1', content: '', entry_date: '2026-07-01', created_at: '', entry_type: 'WORK' },
        { id: '2', content: '', entry_date: '2026-08-10', created_at: '', entry_type: 'WORK' },
      ] as never,
    })
    expect(find(out, 'daily')?.headline).toBe('1 bài viết')
  })

  it('Tien: tach thu chi va gom nhom chi lon nhat', () => {
    const out = buildActivityStats({
      ...base,
      transactions: [
        { id: '1', direction: 'OUT', amount: 300_000, category: 'Ăn uống', log_date: '2026-08-10' },
        { id: '2', direction: 'OUT', amount: 700_000, category: 'Ăn uống', log_date: '2026-08-11' },
        { id: '3', direction: 'OUT', amount: 200_000, category: 'Xăng', log_date: '2026-08-12' },
        { id: '4', direction: 'IN', amount: 5_000_000, category: 'Lương', log_date: '2026-08-05' },
      ] as never,
    })
    const money = find(out, 'money')!
    expect(money.headline).toBe('Chi 1.2 triệu')
    expect(money.metrics[0]).toEqual({ label: 'Thu', value: '5 triệu' })
    expect(money.metrics[1].label).toBe('Dư')
    // Nhom chi nhieu nhat dung dau, va chi gom nhanh OUT
    expect(money.details[0].title).toBe('Ăn uống')
    expect(money.details[0].value).toBe('1 triệu')
    expect(money.details).toHaveLength(2)
  })

  it('Viec: dem xong / con lai / qua han theo hom nay', () => {
    const out = buildActivityStats({
      ...base,
      todos: [
        { id: '1', title: 'a', completed: true, created_at: '2026-08-10', completed_at: '2026-08-10', postpone_count: 2, category: 'Nhà' },
        { id: '2', title: 'b', completed: false, created_at: '2026-08-10', due_date: '2026-08-20' },
        { id: '3', title: 'c', completed: false, created_at: '2026-08-10', due_date: '2026-08-30' },
      ] as never,
    })
    const tasks = find(out, 'tasks')!
    expect(tasks.headline).toBe('1 việc xong')
    expect(tasks.metrics).toEqual([
      { label: 'Còn lại', value: '2' },
      { label: 'Quá hạn', value: '1' },
      { label: 'Lượt hoãn', value: '2' },
    ])
  })

  it('Thoi quen: ti le khong bao gio vuot 100%', () => {
    const out = buildActivityStats({
      ...base,
      days: 2,
      habits: [{ id: 'h1', name: 'Uống nước', is_active: true }],
      habitLogs: [
        { habit_id: 'h1', date: '2026-08-10', completed: true },
        { habit_id: 'h1', date: '2026-08-11', completed: true },
        { habit_id: 'h1', date: '2026-08-12', completed: true },
      ],
    })
    const habit = find(out, 'habit')!
    expect(habit.metrics[0]).toEqual({ label: 'Đều đặn', value: '100%' })
    expect(habit.metrics[1].value).toBe('3 ngày')
  })

  it('Thoi quen: bo qua lan chua tick', () => {
    const out = buildActivityStats({
      ...base,
      habits: [{ id: 'h1', name: 'X' }],
      habitLogs: [
        { habit_id: 'h1', date: '2026-08-10', completed: false },
        { habit_id: 'h1', date: '2026-08-11', completed: true },
      ],
    })
    expect(find(out, 'habit')?.headline).toBe('1 lần tick')
  })

  it('Xem chung: tach gui di va nhan ve theo user dang dang nhap', () => {
    const out = buildActivityStats({
      ...base,
      myUserId: 'me',
      shares: [
        { id: '1', sender_id: 'me', sender_email: null, recipient_email: 'ban@gmail.com', title: 'A', created_at: '2026-08-10T00:00:00Z' },
        { id: '2', sender_id: 'khac', sender_email: 'ban@gmail.com', recipient_email: null, title: 'B', created_at: '2026-08-11T00:00:00Z' },
      ],
    })
    const watch = find(out, 'watch')!
    expect(watch.headline).toBe('1 lượt gửi')
    expect(watch.metrics[0]).toEqual({ label: 'Nhận được', value: '1' })
  })

  it('from rong thi lay tat ca, khong loc ngay', () => {
    const out = buildActivityStats({
      from: '',
      days: 0,
      entries: [{ id: '1', content: '', entry_date: '2020-01-01', created_at: '', entry_type: 'WORK' }] as never,
    })
    expect(find(out, 'daily')?.headline).toBe('1 bài viết')
  })
})
