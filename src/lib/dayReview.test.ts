import { describe, expect, it } from 'vitest'
import { buildDayReview } from './dayReview'

const date = '2026-08-14'
/** ISO giữ đúng giờ local, để clock() ra đúng 'HH:MM' bất kể máy chạy ở múi nào. */
const at = (hhmm: string) => new Date(`${date}T${hhmm}:00`).toISOString()

describe('buildDayReview', () => {
  it('gom mọi nguồn của đúng ngày và xếp theo giờ gần hiện tại nhất lên trên (giảm dần)', () => {
    const events = buildDayReview({
      date,
      sleeps: [{ id: 's', sleep_start: '23:30', sleep_end: '07:00', duration_minutes: 450, log_date: date }],
      meals: [
        { id: 'm', meal_slot: 'LUNCH', food_name: 'Cơm gà', price: 50_000, log_date: date, log_time: '12:00' },
        { id: 'm2', meal_slot: 'MORNING', food_name: 'Phở', price: 40_000, log_date: '2026-08-13', log_time: '07:30' },
      ],
      entries: [{ id: 'e', content: 'Hôm nay ổn', entry_date: date, entry_time: '20:15', created_at: at('20:15'), entry_type: 'FEELING' }],
      todos: [
        { id: 't', title: 'Viết báo cáo', completed: true, created_at: at('09:00'), completed_at: at('17:00') },
        { id: 't2', title: 'Việc hôm qua', completed: false, created_at: new Date('2026-08-13T09:00:00').toISOString() },
      ],
      media: [{ id: 'a', type: 'MUSIC', name: 'Lofi', artist: 'Ai đó', status: 'IN_PROGRESS', is_favorite: false, description: null, log_date: date, log_time: '22:00' }],
    })

    expect(events.map((e) => [e.time, e.kind])).toEqual([
      ['22:00', 'MEDIA'],
      ['20:15', 'DIARY'],
      ['17:00', 'TASK_DONE'],
      ['12:00', 'MEAL'],
      ['09:00', 'TASK_ADD'],
      ['07:00', 'WAKE'],
    ])
  })

  it('mục chưa có giờ vẫn hiện, xếp cuối', () => {
    const events = buildDayReview({
      date,
      sleeps: [],
      meals: [{ id: 'm', meal_slot: 'EVENING', food_name: 'Bún', price: 0, log_date: date }],
      entries: [{ id: 'e', content: 'x', entry_date: date, entry_time: '08:00', created_at: at('08:00'), entry_type: 'SAD_THING' }],
      todos: [],
      media: [],
      mangaLogs: [],
    })
    expect(events.map((e) => e.kind)).toEqual(['DIARY', 'MEAL'])
  })

  it('gom lịch sử đọc truyện BL và ngôn tình vào review ngày', () => {
    const events = buildDayReview({
      date,
      sleeps: [],
      meals: [],
      entries: [],
      todos: [],
      media: [],
      mangaLogs: [
        {
          id: 'ml1',
          mangaSlug: 'da-ky',
          mangaTitle: 'Dạ Ký',
          mangaType: 'BL',
          chapterNumber: 5,
          chapterName: 'Chương 5',
          readAt: at('14:30'),
          log_date: date,
          log_time: '14:30',
          status: 'COMPLETED',
        },
        {
          id: 'ml2',
          mangaSlug: 'vung-trom',
          mangaTitle: 'Vụng Trộm Không Thể Giấu',
          mangaType: 'NGONTINH',
          chapterNumber: 12,
          chapterName: 'Chương 12',
          readAt: at('21:00'),
          log_date: date,
          log_time: '21:00',
          status: 'READING',
        },
      ],
    })

    expect(events).toEqual([
      {
        time: '21:00',
        kind: 'MANGA',
        label: 'Đọc truyện Ngôn tình',
        detail: 'Vụng Trộm Không Thể Giấu — Chương 12',
      },
      {
        time: '14:30',
        kind: 'MANGA',
        label: 'Đọc truyện BL',
        detail: 'Dạ Ký — Chương 5 (Đã đọc xong)',
      },
    ])
  })

  it('thông minh gom các chapter đọc liên tục (ví dụ Chap 1 2 3 4 trong 30 phút) và video watch time', () => {
    const events = buildDayReview({
      date,
      sleeps: [],
      meals: [],
      entries: [],
      todos: [],
      media: [],
      mangaLogs: [
        {
          id: 'h1',
          mangaSlug: 'gai-chung-cu',
          mangaTitle: 'Tôi Được Giao Nhiệm Vụ',
          mangaType: 'H_MANGA',
          chapterNumber: 1,
          chapterName: 'Chương 1',
          readAt: at('14:00'),
          log_date: date,
          log_time: '14:00',
          status: 'COMPLETED',
        },
        {
          id: 'h2',
          mangaSlug: 'gai-chung-cu',
          mangaTitle: 'Tôi Được Giao Nhiệm Vụ',
          mangaType: 'H_MANGA',
          chapterNumber: 2,
          chapterName: 'Chương 2',
          readAt: at('14:10'),
          log_date: date,
          log_time: '14:10',
          status: 'COMPLETED',
        },
        {
          id: 'h3',
          mangaSlug: 'gai-chung-cu',
          mangaTitle: 'Tôi Được Giao Nhiệm Vụ',
          mangaType: 'H_MANGA',
          chapterNumber: 3,
          chapterName: 'Chương 3',
          readAt: at('14:20'),
          log_date: date,
          log_time: '14:20',
          status: 'COMPLETED',
        },
        {
          id: 'h4',
          mangaSlug: 'gai-chung-cu',
          mangaTitle: 'Tôi Được Giao Nhiệm Vụ',
          mangaType: 'H_MANGA',
          chapterNumber: 4,
          chapterName: 'Chương 4',
          readAt: at('14:30'),
          log_date: date,
          log_time: '14:30',
          status: 'COMPLETED',
        },
      ],
      videoWatchLogs: [
        {
          id: 'v1',
          videoId: 'yt123',
          title: 'Tập 52 - 2 Ngày 1 Đêm',
          channelName: 'Dong Tay Promotion',
          type: 'tvshow',
          startTime: at('15:00'),
          endTime: at('15:35'),
          durationMinutes: 35,
          log_date: date,
          log_time: '15:00',
        },
      ],
    })

    expect(events).toEqual([
      {
        time: '15:00 - 15:35',
        kind: 'MEDIA',
        label: 'Xem YouTube',
        detail: 'Tập 52 - 2 Ngày 1 Đêm — Dong Tay Promotion (Đã xem 35 phút)',
      },
      {
        time: '14:00 - 14:30',
        kind: 'MANGA',
        label: 'Đọc truyện H (18+)',
        detail: 'Tôi Được Giao Nhiệm Vụ — Đã đọc 4 chương (Chương 1 → 4) trong ~30 phút (Đã đọc xong)',
      },
    ])
  })
})
