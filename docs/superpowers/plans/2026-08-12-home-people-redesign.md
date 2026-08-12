# Kế hoạch triển khai — Thiết kế lại Home & tab Người

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại trang Home theo bố cục banner chào → lưới 2×2 → tiến độ tuần → sắp tới, thêm dữ liệu sinh nhật/kỉ niệm quản lý ở tab Người, và thiết kế lại toàn bộ giao diện tab Người.

**Architecture:** Toàn bộ logic tính toán (phần trăm hoàn thành, dải ngày trong tuần, đếm ngược dịp, màu avatar) tách thành hàm thuần trong `src/lib/` và `src/features/people/avatar.ts` để test bằng vitest không cần render. Giao diện tách thành hai thư mục `src/features/home/` và `src/features/people/`, mỗi thẻ một tệp, theo đúng pattern `src/features/library/` và `src/features/nutrition/` đang có. Dữ liệu mới nằm trong một migration duy nhất.

**Tech Stack:** React 18 + TypeScript + Vite, react-router-dom, Supabase JS, lucide-react, vitest + @testing-library/react. CSS thuần trong `src/styles.css` dùng biến token có sẵn (tự động chạy đúng cả chế độ sáng và tối).

**Spec:** `docs/superpowers/specs/2026-08-12-home-people-redesign-design.md`

---

## Bản đồ tệp

**Tạo mới**

| Tệp | Trách nhiệm |
| --- | --- |
| `supabase/migrations/20260815000000_person_occasions_media_cover.sql` | Bảng `person_occasions`, cột `media_items.cover_url` |
| `src/lib/occasions.ts` + `.test.ts` | Tính lần tới của dịp, số ngày còn lại, tuổi, nhãn, danh sách sắp tới |
| `src/lib/date.test.ts` | Test cho hàm định dạng ngày mới thêm |
| `src/lib/homeProgress.ts` + `.test.ts` | Phần trăm hoàn thành hôm nay, dải 7 ngày, trạng thái ngày, lời chào |
| `src/features/home/ProgressRing.tsx` | Vòng tròn SVG dùng chung |
| `src/features/home/useHomeData.ts` | Nạp dữ liệu Home, tick habit/todo |
| `src/features/home/GreetingBanner.tsx` | Banner chào + vòng phần trăm |
| `src/features/home/HabitsCard.tsx` | Thẻ Habits |
| `src/features/home/TodosCard.tsx` | Thẻ Việc cần làm |
| `src/features/home/DailyCard.tsx` | Thẻ Nhật ký hôm nay |
| `src/features/home/ReadingCard.tsx` | Thẻ Đang đọc |
| `src/features/home/WeekProgressCard.tsx` | Tiến độ tuần |
| `src/features/home/UpcomingCard.tsx` | Sắp tới |
| `src/features/home/HomePage.tsx` | Bố cục Home |
| `src/features/home/HomePage.test.tsx` | Test render Home |
| `src/features/people/avatar.ts` + `.test.ts` | Chữ cái đầu + màu avatar |
| `src/features/people/usePeopleData.ts` | Nạp người + dịp, thêm/xoá, fallback localStorage |
| `src/features/people/OccasionsSection.tsx` | Khu sinh nhật & kỉ niệm |
| `src/features/people/PersonDetail.tsx` | Màn chi tiết một người |
| `src/features/people/PeoplePage.tsx` | Màn danh sách người |
| `src/features/people/PeoplePage.test.tsx` | Test render tab Người |

**Sửa**

| Tệp | Thay đổi |
| --- | --- |
| `src/types/index.ts` | Thêm `OccasionKind`, `PersonOccasion`; `Media` thêm `cover_url` |
| `src/lib/date.ts` | Thêm `vietnameseDate`, `shortDate`, `dayMonth`, `timeOfDay` |
| `src/App.tsx` | Chip ngày trên header, đổi import Home và Người |
| `src/features/LibraryPage.tsx` | Ô nhập link ảnh bìa trong modal thêm/sửa |
| `src/styles.css` | Lớp CSS mới cho Home và tab Người |

**Xoá**

- `src/features/HomePage.tsx` (thay bằng `src/features/home/HomePage.tsx`)
- `src/features/PeoplePage.tsx` (thay bằng `src/features/people/PeoplePage.tsx`)

---

## Task 1: Migration và kiểu dữ liệu

**Files:**
- Create: `supabase/migrations/20260815000000_person_occasions_media_cover.sql`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Viết migration**

Tạo `supabase/migrations/20260815000000_person_occasions_media_cover.sql`:

```sql
-- Dịp đáng nhớ: sinh nhật và kỉ niệm, quản lý ở tab Người, hiển thị đếm ngược ở Home.
create table if not exists public.person_occasions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  person_id uuid references public.people(id) on delete cascade,
  kind text not null default 'BIRTHDAY' check (kind in ('BIRTHDAY', 'ANNIVERSARY')),
  title text not null default '',
  occasion_date date not null,
  is_yearly boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists person_occasions_user_date_idx
  on public.person_occasions (user_id, occasion_date);

alter table public.person_occasions enable row level security;

do $$ begin
  create policy "own occasions" on public.person_occasions
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Ảnh bìa cho mục thư viện, dùng ở thẻ "Đang đọc" trên Home.
alter table public.media_items add column if not exists cover_url text;
```

- [ ] **Step 2: Thêm kiểu TypeScript**

Trong `src/types/index.ts`, thêm ngay sau khối `PersonDailyLog` (dòng 130):

```ts
export type OccasionKind = 'BIRTHDAY' | 'ANNIVERSARY'

/** Dịp đáng nhớ. `person_id` null = dịp không gắn với ai. */
export type PersonOccasion = {
  id: string
  person_id: string | null
  kind: OccasionKind
  title: string
  occasion_date: string
  is_yearly: boolean
  created_at?: string
}
```

Trong cùng tệp, thêm một dòng vào type `Media` ngay dưới `book_format?: BookFormat | null` (dòng 78):

```ts
  cover_url?: string | null
```

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npx tsc -b --noEmit false`
Expected: không có lỗi.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260815000000_person_occasions_media_cover.sql src/types/index.ts
git commit -m "feat: add person_occasions table and media cover_url"
```

---

## Task 2: Hàm định dạng ngày

**Files:**
- Modify: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { dayMonth, shortDate, timeOfDay, vietnameseDate } from './date'

describe('vietnameseDate', () => {
  it('ghép thứ và ngày theo định dạng tiếng Việt', () => {
    expect(vietnameseDate(new Date(2026, 7, 12))).toBe('Thứ Tư, 12/08/2026')
  })

  it('gọi Chủ Nhật đúng tên', () => {
    expect(vietnameseDate(new Date(2026, 7, 16))).toBe('Chủ Nhật, 16/08/2026')
  })
})

describe('shortDate', () => {
  it('chỉ trả về ngày tháng năm', () => {
    expect(shortDate(new Date(2026, 7, 12))).toBe('12/08/2026')
  })
})

describe('dayMonth', () => {
  it('bỏ số 0 ở đầu', () => {
    expect(dayMonth(new Date(2026, 7, 3))).toBe('3/8')
  })
})

describe('timeOfDay', () => {
  it('lấy giờ phút từ chuỗi ISO', () => {
    expect(timeOfDay('2026-08-12T08:30:00')).toBe('08:30')
  })

  it('trả chuỗi rỗng khi không có dữ liệu', () => {
    expect(timeOfDay(null)).toBe('')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/lib/date.test.ts`
Expected: FAIL — `No "vietnameseDate" export is defined`.

- [ ] **Step 3: Cài đặt**

Thêm vào cuối `src/lib/date.ts`:

```ts
const WEEKDAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

const pad = (value: number) => String(value).padStart(2, '0')

/** '12/08/2026' */
export const shortDate = (date = new Date()) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`

/** 'Thứ Tư, 12/08/2026' */
export const vietnameseDate = (date = new Date()) =>
  `${WEEKDAY_NAMES[date.getDay()]}, ${shortDate(date)}`

/** '3/8' — dùng cho dải ngày trong tuần, không đệm số 0. */
export const dayMonth = (date = new Date()) => `${date.getDate()}/${date.getMonth() + 1}`

/** Lấy 'HH:MM' từ chuỗi thời gian ISO; rỗng nếu không có. */
export const timeOfDay = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
```

- [ ] **Step 4: Chạy test để xác nhận đạt**

Run: `npx vitest run src/lib/date.test.ts`
Expected: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts
git commit -m "feat: add Vietnamese date formatting helpers"
```

---

## Task 3: Thư viện dịp — `src/lib/occasions.ts`

**Files:**
- Create: `src/lib/occasions.ts`
- Test: `src/lib/occasions.test.ts`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/occasions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Person, PersonOccasion } from '../types'
import { ageOnNext, countdownLabel, daysUntil, nextOccurrence, occasionLabel, upcomingOccasions } from './occasions'

const make = (over: Partial<PersonOccasion> = {}): PersonOccasion => ({
  id: 'o1',
  person_id: 'p1',
  kind: 'BIRTHDAY',
  title: '',
  occasion_date: '2001-08-15',
  is_yearly: true,
  ...over,
})

const people: Person[] = [{ id: 'p1', name: 'Linh' }]

describe('nextOccurrence', () => {
  it('trả về ngày trong năm nay khi dịp chưa qua', () => {
    expect(nextOccurrence(make(), new Date(2026, 7, 12))).toEqual(new Date(2026, 7, 15))
  })

  it('coi dịp rơi đúng hôm nay là chưa qua', () => {
    expect(nextOccurrence(make(), new Date(2026, 7, 15))).toEqual(new Date(2026, 7, 15))
  })

  it('nhảy sang năm sau khi dịp đã qua', () => {
    expect(nextOccurrence(make(), new Date(2026, 8, 1))).toEqual(new Date(2027, 7, 15))
  })

  it('lùi 29/02 về 28/02 ở năm không nhuận', () => {
    expect(nextOccurrence(make({ occasion_date: '2000-02-29' }), new Date(2026, 0, 10))).toEqual(new Date(2026, 1, 28))
  })

  it('giữ nguyên 29/02 ở năm nhuận', () => {
    expect(nextOccurrence(make({ occasion_date: '2000-02-29' }), new Date(2028, 0, 10))).toEqual(new Date(2028, 1, 29))
  })

  it('ẩn dịp một lần đã qua', () => {
    expect(nextOccurrence(make({ is_yearly: false, occasion_date: '2026-08-01' }), new Date(2026, 7, 12))).toBeNull()
  })

  it('giữ dịp một lần còn ở tương lai', () => {
    expect(nextOccurrence(make({ is_yearly: false, occasion_date: '2026-09-01' }), new Date(2026, 7, 12))).toEqual(new Date(2026, 8, 1))
  })
})

describe('daysUntil', () => {
  it('đếm theo ngày địa phương', () => {
    expect(daysUntil(new Date(2026, 7, 15), new Date(2026, 7, 12, 23, 30))).toBe(3)
  })

  it('trả 0 cho hôm nay', () => {
    expect(daysUntil(new Date(2026, 7, 12, 1), new Date(2026, 7, 12, 22))).toBe(0)
  })
})

describe('ageOnNext', () => {
  it('tính tuổi sẽ tròn vào lần tới', () => {
    expect(ageOnNext(make(), new Date(2026, 7, 12))).toBe(25)
  })

  it('trả null cho kỉ niệm', () => {
    expect(ageOnNext(make({ kind: 'ANNIVERSARY' }), new Date(2026, 7, 12))).toBeNull()
  })

  it('trả null khi năm gốc ở tương lai', () => {
    expect(ageOnNext(make({ occasion_date: '2030-08-15' }), new Date(2026, 7, 12))).toBeNull()
  })
})

describe('occasionLabel', () => {
  it('ưu tiên tiêu đề tự đặt', () => {
    expect(occasionLabel(make({ title: 'Kỉ niệm quen nhau' }), 'Linh')).toBe('Kỉ niệm quen nhau')
  })

  it('sinh nhật không tiêu đề thì ghép tên người', () => {
    expect(occasionLabel(make(), 'Linh')).toBe('Sinh nhật Linh')
  })

  it('không gắn người thì dùng nhãn chung', () => {
    expect(occasionLabel(make({ person_id: null }), null)).toBe('Sinh nhật')
  })
})

describe('countdownLabel', () => {
  it('gọi tên hôm nay và ngày mai', () => {
    expect(countdownLabel(0)).toBe('Hôm nay')
    expect(countdownLabel(1)).toBe('Ngày mai')
    expect(countdownLabel(3)).toBe('Còn 3 ngày')
  })
})

describe('upcomingOccasions', () => {
  const list = [
    make({ id: 'far', occasion_date: '2001-10-20' }),
    make({ id: 'near', occasion_date: '2001-08-15' }),
    make({ id: 'outside', occasion_date: '2001-12-25' }),
  ]

  it('sắp xếp theo số ngày còn lại và cắt theo giới hạn', () => {
    const result = upcomingOccasions(list, people, new Date(2026, 7, 12), { withinDays: 90, limit: 2 })
    expect(result.map((r) => r.occasion.id)).toEqual(['near', 'far'])
    expect(result[0].days).toBe(3)
    expect(result[0].label).toBe('Sinh nhật Linh')
  })

  it('bỏ dịp nằm ngoài cửa sổ ngày', () => {
    const result = upcomingOccasions(list, people, new Date(2026, 7, 12), { withinDays: 10, limit: 5 })
    expect(result.map((r) => r.occasion.id)).toEqual(['near'])
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/lib/occasions.test.ts`
Expected: FAIL — không tìm thấy module `./occasions`.

- [ ] **Step 3: Cài đặt**

Tạo `src/lib/occasions.ts`:

```ts
import type { Person, PersonOccasion } from '../types'

/** 'YYYY-MM-DD' → Date lúc 00:00 giờ địa phương (tránh lệch múi giờ của new Date(chuỗi)). */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/** Cắt phần giờ để so sánh thuần theo ngày. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Lần tới của dịp. Dịp một lần đã qua trả về null. */
export function nextOccurrence(occasion: PersonOccasion, today = new Date()): Date | null {
  const base = parseLocalDate(occasion.occasion_date)
  const from = startOfDay(today)

  if (!occasion.is_yearly) return base.getTime() >= from.getTime() ? base : null

  const build = (year: number) => {
    const candidate = new Date(year, base.getMonth(), base.getDate())
    // 29/02 ở năm không nhuận bị Date đẩy sang 01/03 → kéo về ngày cuối tháng 2.
    if (candidate.getMonth() !== base.getMonth()) return new Date(year, base.getMonth() + 1, 0)
    return candidate
  }

  const thisYear = build(from.getFullYear())
  return thisYear.getTime() >= from.getTime() ? thisYear : build(from.getFullYear() + 1)
}

/** Số ngày nguyên còn lại, làm tròn để không lệch vì giờ mùa hè. */
export function daysUntil(date: Date, today = new Date()): number {
  const diff = startOfDay(date).getTime() - startOfDay(today).getTime()
  return Math.round(diff / 86_400_000)
}

/** Tuổi sẽ tròn vào lần sinh nhật tới; null nếu không áp dụng. */
export function ageOnNext(occasion: PersonOccasion, today = new Date()): number | null {
  if (occasion.kind !== 'BIRTHDAY' || !occasion.is_yearly) return null
  const next = nextOccurrence(occasion, today)
  if (!next) return null
  const age = next.getFullYear() - parseLocalDate(occasion.occasion_date).getFullYear()
  return age > 0 ? age : null
}

export function occasionLabel(occasion: PersonOccasion, personName?: string | null): string {
  const title = occasion.title?.trim()
  if (title) return title
  const base = occasion.kind === 'BIRTHDAY' ? 'Sinh nhật' : 'Kỉ niệm'
  return personName ? `${base} ${personName}` : base
}

export function countdownLabel(days: number): string {
  if (days <= 0) return 'Hôm nay'
  if (days === 1) return 'Ngày mai'
  return `Còn ${days} ngày`
}

export type UpcomingOccasion = {
  occasion: PersonOccasion
  personName: string | null
  date: Date
  days: number
  label: string
}

export function upcomingOccasions(
  occasions: PersonOccasion[],
  people: Person[],
  today = new Date(),
  { withinDays = 60, limit = 3 }: { withinDays?: number; limit?: number } = {},
): UpcomingOccasion[] {
  const nameById = new Map(people.map((p) => [p.id, p.name]))

  return occasions
    .map((occasion): UpcomingOccasion | null => {
      const date = nextOccurrence(occasion, today)
      if (!date) return null
      const personName = occasion.person_id ? nameById.get(occasion.person_id) ?? null : null
      return { occasion, personName, date, days: daysUntil(date, today), label: occasionLabel(occasion, personName) }
    })
    .filter((item): item is UpcomingOccasion => item !== null && item.days <= withinDays)
    .sort((a, b) => a.days - b.days)
    .slice(0, limit)
}
```

- [ ] **Step 4: Chạy test để xác nhận đạt**

Run: `npx vitest run src/lib/occasions.test.ts`
Expected: PASS — 18 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/occasions.ts src/lib/occasions.test.ts
git commit -m "feat: add occasion countdown helpers"
```

---

## Task 4: Thư viện tiến độ — `src/lib/homeProgress.ts`

**Files:**
- Create: `src/lib/homeProgress.ts`
- Test: `src/lib/homeProgress.test.ts`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/homeProgress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog, Todo } from '../types'
import { dayStatus, greetingFor, todayCompletion, weekDays } from './homeProgress'

const habit = (id: string): Habit => ({ id, name: id, is_active: true, category_id: null })

const todo = (over: Partial<Todo> & { id: string }): Todo => ({
  title: over.id,
  completed: false,
  created_at: '2026-08-12T07:00:00',
  ...over,
})

describe('todayCompletion', () => {
  const today = new Date(2026, 7, 12)

  it('trả về 0% khi không có việc nào', () => {
    expect(todayCompletion({ habits: [], habitLogs: [], todos: [] }, today)).toEqual({
      done: 0,
      total: 0,
      percent: 0,
      remaining: 0,
    })
  })

  it('đếm cả habit đã tick lẫn todo hoàn thành hôm nay', () => {
    const habits = [habit('h1'), habit('h2')]
    const habitLogs: HabitLog[] = [{ habit_id: 'h1', date: '2026-08-12', completed: true }]
    const todos = [
      todo({ id: 't1' }),
      todo({ id: 't2', completed: true, completed_at: '2026-08-12T09:00:00' }),
    ]

    expect(todayCompletion({ habits, habitLogs, todos }, today)).toEqual({
      done: 2,
      total: 4,
      percent: 50,
      remaining: 2,
    })
  })

  it('bỏ qua todo hoàn thành từ hôm trước', () => {
    const todos = [
      todo({ id: 't1' }),
      todo({ id: 'old', completed: true, completed_at: '2026-08-11T09:00:00' }),
    ]

    expect(todayCompletion({ habits: [], habitLogs: [], todos }, today).total).toBe(1)
  })

  it('không tính log của ngày khác', () => {
    const habitLogs: HabitLog[] = [{ habit_id: 'h1', date: '2026-08-11', completed: true }]
    expect(todayCompletion({ habits: [habit('h1')], habitLogs, todos: [] }, today).done).toBe(0)
  })
})

describe('weekDays', () => {
  it('bắt đầu từ Thứ Hai và đủ bảy ngày', () => {
    const week = weekDays(new Date(2026, 7, 12))
    expect(week).toHaveLength(7)
    expect(week[0].key).toBe('2026-08-10')
    expect(week[0].label).toBe('T2')
    expect(week[6].key).toBe('2026-08-16')
    expect(week[6].label).toBe('CN')
  })

  it('coi Chủ Nhật là ngày cuối tuần chứ không phải ngày đầu', () => {
    const week = weekDays(new Date(2026, 7, 16))
    expect(week[0].key).toBe('2026-08-10')
    expect(week[6].isToday).toBe(true)
  })

  it('đánh dấu hôm nay và ngày tương lai', () => {
    const week = weekDays(new Date(2026, 7, 12))
    expect(week[2].isToday).toBe(true)
    expect(week[2].isFuture).toBe(false)
    expect(week[3].isFuture).toBe(true)
    expect(week[1].isFuture).toBe(false)
    expect(week[2].dayMonth).toBe('12/8')
  })
})

describe('dayStatus', () => {
  const week = weekDays(new Date(2026, 7, 12))
  const habits = [habit('h1'), habit('h2'), habit('h3'), habit('h4'), habit('h5')]
  const logsFor = (date: string, count: number): HabitLog[] =>
    habits.slice(0, count).map((h) => ({ habit_id: h.id, date, completed: true }))

  it('ngày hôm nay luôn là today', () => {
    expect(dayStatus(week[2], habits, [])).toBe('today')
  })

  it('ngày tương lai là future', () => {
    expect(dayStatus(week[3], habits, [])).toBe('future')
  })

  it('đạt từ 80% trở lên là done', () => {
    expect(dayStatus(week[0], habits, logsFor('2026-08-10', 4))).toBe('done')
  })

  it('dưới 80% mà có tick là partial', () => {
    expect(dayStatus(week[0], habits, logsFor('2026-08-10', 3))).toBe('partial')
  })

  it('không tick gì là empty', () => {
    expect(dayStatus(week[0], habits, [])).toBe('empty')
  })

  it('không có habit nào thì là empty', () => {
    expect(dayStatus(week[0], [], [])).toBe('empty')
  })
})

describe('greetingFor', () => {
  it('chia lời chào theo khung giờ', () => {
    expect(greetingFor(7).text).toBe('Chào buổi sáng')
    expect(greetingFor(12).text).toBe('Chào buổi trưa')
    expect(greetingFor(15).text).toBe('Chào buổi chiều')
    expect(greetingFor(21).text).toBe('Chào buổi tối')
    expect(greetingFor(3).text).toBe('Chào buổi tối')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/lib/homeProgress.test.ts`
Expected: FAIL — không tìm thấy module `./homeProgress`.

- [ ] **Step 3: Cài đặt**

Tạo `src/lib/homeProgress.ts`:

```ts
import type { Habit, HabitLog, Todo } from '../types'
import { dayMonth, localDate } from './date'

export type CompletionSummary = { done: number; total: number; percent: number; remaining: number }

/**
 * Phần trăm hoàn thành trong ngày.
 * Mẫu số = habit đang hoạt động + todo chưa xong + todo đã xong hôm nay.
 */
export function todayCompletion(
  input: { habits: Habit[]; habitLogs: HabitLog[]; todos: Todo[] },
  today = new Date(),
): CompletionSummary {
  const day = localDate(today)

  const doneHabitIds = new Set(
    input.habitLogs.filter((log) => log.date === day && log.completed).map((log) => log.habit_id),
  )
  const habitDone = input.habits.filter((h) => doneHabitIds.has(h.id)).length

  const relevantTodos = input.todos.filter(
    (t) => !t.completed || (t.completed_at ?? '').slice(0, 10) === day,
  )
  const todoDone = relevantTodos.filter((t) => t.completed).length

  const total = input.habits.length + relevantTodos.length
  const done = habitDone + todoDone
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100), remaining: total - done }
}

export type WeekDay = {
  date: Date
  key: string
  label: string
  dayMonth: string
  isToday: boolean
  isFuture: boolean
}

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Bảy ngày của tuần hiện tại, bắt đầu từ Thứ Hai. */
export function weekDays(today = new Date()): WeekDay[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const offsetFromMonday = (base.getDay() + 6) % 7
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offsetFromMonday)
  const todayKey = localDate(base)

  return DAY_LABELS.map((label, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
    const key = localDate(date)
    return { date, key, label, dayMonth: dayMonth(date), isToday: key === todayKey, isFuture: key > todayKey }
  })
}

export type DayStatus = 'done' | 'partial' | 'empty' | 'today' | 'future'

/** Tỉ lệ habit tối thiểu để coi một ngày là đã hoàn thành. */
export const DAY_DONE_RATIO = 0.8

export function dayStatus(day: WeekDay, habits: Habit[], logs: HabitLog[]): DayStatus {
  if (day.isToday) return 'today'
  if (day.isFuture) return 'future'
  if (habits.length === 0) return 'empty'

  const done = logs.filter((log) => log.date === day.key && log.completed).length
  if (done / habits.length >= DAY_DONE_RATIO) return 'done'
  return done > 0 ? 'partial' : 'empty'
}

export type Greeting = { text: string; emoji: string }

export function greetingFor(hour: number): Greeting {
  if (hour >= 5 && hour < 11) return { text: 'Chào buổi sáng', emoji: '🌤️' }
  if (hour >= 11 && hour < 13) return { text: 'Chào buổi trưa', emoji: '☀️' }
  if (hour >= 13 && hour < 18) return { text: 'Chào buổi chiều', emoji: '🌇' }
  return { text: 'Chào buổi tối', emoji: '🌙' }
}
```

- [ ] **Step 4: Chạy test để xác nhận đạt**

Run: `npx vitest run src/lib/homeProgress.test.ts`
Expected: PASS — 14 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/homeProgress.ts src/lib/homeProgress.test.ts
git commit -m "feat: add home progress calculations"
```

---

## Task 5: Avatar cho tab Người

**Files:**
- Create: `src/features/people/avatar.ts`
- Test: `src/features/people/avatar.test.ts`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/features/people/avatar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { avatarStyle, avatarTone, initials } from './avatar'

describe('initials', () => {
  it('lấy chữ cái đầu của từ đầu và từ cuối', () => {
    expect(initials('Nguyễn Thuỳ Linh')).toBe('NL')
  })

  it('tên một từ chỉ trả một chữ', () => {
    expect(initials('Linh')).toBe('L')
  })

  it('bỏ khoảng trắng thừa', () => {
    expect(initials('  Minh   Anh  ')).toBe('MA')
  })

  it('tên rỗng trả dấu hỏi', () => {
    expect(initials('   ')).toBe('?')
  })
})

describe('avatarTone', () => {
  it('cùng một tên luôn ra cùng màu', () => {
    expect(avatarTone('Linh')).toBe(avatarTone('Linh'))
  })

  it('luôn nằm trong bảng màu cho trước', () => {
    const tones = ['Linh', 'Minh', 'An', 'Bảo', 'Chi', 'Dũng', ''].map(avatarTone)
    for (const tone of tones) {
      expect(['blue', 'amber', 'emerald', 'purple', 'rose', 'cyan']).toContain(tone)
    }
  })
})

describe('avatarStyle', () => {
  it('trả về biến màu token tương ứng', () => {
    const tone = avatarTone('Linh')
    expect(avatarStyle('Linh')).toEqual({ background: `var(--${tone}-bg)`, color: `var(--${tone})` })
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/features/people/avatar.test.ts`
Expected: FAIL — không tìm thấy module `./avatar`.

- [ ] **Step 3: Cài đặt**

Tạo `src/features/people/avatar.ts`:

```ts
const PALETTE = ['blue', 'amber', 'emerald', 'purple', 'rose', 'cyan'] as const

export type AvatarTone = (typeof PALETTE)[number]

/** Chữ cái đầu của từ đầu và từ cuối, tối đa 2 kí tự. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Chọn màu ổn định theo tên để cùng một người luôn cùng màu. */
export function avatarTone(name: string): AvatarTone {
  let hash = 0
  for (const char of name.trim()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100_000
  return PALETTE[hash % PALETTE.length]
}

export function avatarStyle(name: string) {
  const tone = avatarTone(name)
  return { background: `var(--${tone}-bg)`, color: `var(--${tone})` }
}
```

- [ ] **Step 4: Chạy test để xác nhận đạt**

Run: `npx vitest run src/features/people/avatar.test.ts`
Expected: PASS — 7 test.

- [ ] **Step 5: Commit**

```bash
git add src/features/people/avatar.ts src/features/people/avatar.test.ts
git commit -m "feat: add avatar initials and tone helpers"
```

---

## Task 6: CSS cho Home và tab Người

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Thêm khối CSS mới**

Thêm vào **cuối** `src/styles.css`:

```css
/* ===== Chip ngày trên header ===== */
.header-date {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  /* header dùng space-between; margin auto kéo chip về giữa hai đầu. */
  margin: 0 auto;
  padding: 5px 14px;
  border-radius: 20px;
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 800;
  font-size: 0.84rem;
  white-space: nowrap;
}

.header-date .header-date-short { display: none; }

@media (max-width: 640px) {
  .header-date { padding: 4px 10px; font-size: 0.76rem; margin: 0 8px 0 auto; }
  .header-date .header-date-full { display: none; }
  .header-date .header-date-short { display: inline; }
  .brand { min-width: 0; font-size: 1.05rem; }
  .brand span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

/* ===== Home ===== */
.home-page { max-width: 800px; margin: 0 auto; }

.greeting-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 18px;
  margin-bottom: 14px;
  border: 1px solid var(--card-border);
  border-radius: 20px;
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--bg-subtle) 100%);
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.greeting-banner:hover { transform: translateY(-1px); box-shadow: var(--card-shadow); }

.greeting-emoji {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 16px;
  background: var(--card-bg);
  font-size: 1.6rem;
}

.greeting-text { flex: 1; min-width: 0; }
.greeting-text strong { display: block; font-size: 1.35rem; font-weight: 800; line-height: 1.2; }
.greeting-text span { font-size: 0.86rem; color: var(--text-muted); }
.greeting-text b { color: var(--primary); }

.progress-ring { position: relative; display: grid; place-items: center; flex-shrink: 0; }
.progress-ring svg { display: block; }
.progress-ring-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
  line-height: 1.1;
}
.progress-ring-label strong { font-size: 1rem; font-weight: 800; color: var(--primary); }
.progress-ring-label span { font-size: 0.55rem; color: var(--text-muted); font-weight: 600; }

.home-grid-2 { grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (max-width: 560px) { .home-grid-2 { grid-template-columns: 1fr; } }

.home-card {
  display: flex;
  flex-direction: column;
  padding: 12px;
  margin: 0;
  min-height: 208px;
}

.home-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 7px;
  margin-bottom: 7px;
  border-bottom: 1px solid var(--card-border);
}

.home-card-title { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 0.9rem; min-width: 0; }
.home-card-title small { display: block; font-size: 0.62rem; font-weight: 600; color: var(--text-muted); margin-top: 1px; }

.home-card-count {
  min-width: 24px;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--soft);
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 800;
  text-align: center;
}

.home-card-body { flex: 1; min-height: 0; overflow-y: auto; display: grid; align-content: start; gap: 5px; }

.home-card-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 8px;
  padding: 7px 0;
  border: 0;
  border-radius: 10px;
  background: var(--soft);
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.home-card-foot:hover { background: var(--primary-light); color: var(--primary); }
.home-card-foot.accent { background: var(--primary-light); color: var(--primary); }

.home-card-empty { font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 16px 0; }

.home-group-title { font-size: 0.7rem; font-weight: 800; margin-bottom: 3px; }
.home-divider { border-top: 1.5px dashed var(--card-border); margin: 3px 0; }

.urgent-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--amber-bg);
  color: var(--amber);
  border: 1px solid var(--amber);
  font-size: 0.65rem;
  font-weight: 700;
}

.entry-line { display: flex; align-items: flex-start; gap: 7px; padding: 3px 2px; }
.entry-line i { width: 7px; height: 7px; margin-top: 6px; border-radius: 50%; background: var(--primary); flex-shrink: 0; }
.entry-line div { min-width: 0; }
.entry-line p { margin: 0; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry-line time { font-size: 0.68rem; color: var(--text-muted); }

.media-cover {
  width: 56px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: cover;
  display: grid;
  place-items: center;
  background: var(--primary-gradient);
  color: #fff;
  box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.4);
}

.reading-row { display: flex; gap: 10px; align-items: center; }
.reading-row strong { display: block; font-size: 0.88rem; line-height: 1.25; }
.reading-badge {
  display: inline-block;
  margin-top: 5px;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--blue-bg);
  color: var(--blue);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
}

/* ===== Tiến độ tuần & Sắp tới ===== */
.home-section-card { padding: 14px 16px; margin: 12px 0 0; }

.home-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.home-section-head h3 { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 0.95rem; font-weight: 800; }

.week-legend { display: flex; gap: 10px; font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
.week-legend i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }

.week-strip { display: grid; grid-template-columns: repeat(7, 1fr); }
.week-day { display: grid; justify-items: center; gap: 3px; padding: 2px 0; border-left: 1px solid var(--card-border); }
.week-day:first-child { border-left: 0; }
.week-day .week-label { font-size: 0.76rem; font-weight: 800; color: var(--text-muted); }
.week-day .week-date { font-size: 0.66rem; color: var(--text-muted); }
.week-day.is-today .week-label, .week-day.is-today .week-date { color: var(--primary); }
.week-day.is-future { opacity: 0.5; }

.week-dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; margin-top: 2px; }
.week-dot.done { background: var(--emerald); color: #fff; }
.week-dot.partial { border: 2px solid var(--amber); }
.week-dot.empty, .week-dot.future { border: 2px solid var(--card-border); }

.upcoming-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-top: 1px solid var(--card-border);
}
.upcoming-row:first-child { border-top: 0; }
.upcoming-row .upcoming-name { flex: 1; min-width: 0; font-size: 0.86rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upcoming-row time { font-size: 0.76rem; color: var(--text-muted); white-space: nowrap; }

.countdown-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--soft);
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
}
.countdown-badge.soon { background: var(--rose-bg); color: var(--rose); }

/* ===== Tab Người ===== */
.people-page { max-width: 800px; margin: 0 auto; }

.person-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (max-width: 560px) { .person-grid { grid-template-columns: 1fr; } }

.person-tile {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--card-border);
  border-radius: 16px;
  background: var(--card-bg);
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.person-tile:hover { transform: translateY(-1px); box-shadow: var(--card-shadow); border-color: rgba(37, 99, 235, 0.25); }
.person-tile .person-body { flex: 1; min-width: 0; }
.person-tile strong { display: block; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person-tile .person-meta { font-size: 0.7rem; color: var(--text-muted); }

.person-avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.95rem;
  object-fit: cover;
}
.person-avatar.large { width: 64px; height: 64px; font-size: 1.3rem; }

.person-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--card-border);
  border-radius: 20px;
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--bg-subtle) 100%);
  margin-bottom: 14px;
}
.person-hero h2 { margin: 0; font-size: 1.3rem; }
.person-hero .person-meta { font-size: 0.82rem; color: var(--text-muted); }

.interest-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 99px;
  background: var(--rose-bg);
  color: var(--rose);
  font-size: 0.76rem;
  font-weight: 700;
}
.interest-chip button { border: 0; background: transparent; color: inherit; cursor: pointer; display: grid; place-items: center; padding: 0; }

.occasion-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-top: 1px solid var(--card-border);
}
.occasion-row:first-child { border-top: 0; }
.occasion-row .occasion-name { flex: 1; min-width: 0; font-size: 0.86rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.occasion-form { display: grid; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--card-border); }
.occasion-form .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.occasion-form input, .occasion-form select {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font-size: 0.84rem;
}
.occasion-form label.check { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; color: var(--text-muted); }
```

- [ ] **Step 2: Kiểm tra build không hỏng**

Run: `npm run build`
Expected: build thành công (CSS chưa được dùng nhưng không gây lỗi).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: add home and people redesign styles"
```

---

## Task 7: Vòng tiến độ SVG

**Files:**
- Create: `src/features/home/ProgressRing.tsx`

- [ ] **Step 1: Cài đặt**

Tạo `src/features/home/ProgressRing.tsx`:

```tsx
type Props = {
  percent: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: React.ReactNode
}

/** Vòng tròn tiến độ dùng cho banner chào và cột "hôm nay" trong dải tuần. */
export function ProgressRing({
  percent,
  size = 64,
  stroke = 6,
  color = 'var(--primary)',
  track = 'var(--card-border)',
  children,
}: Props) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  const dash = (clamped / 100) * circumference
  const center = size / 2

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {children ? <div className="progress-ring-label">{children}</div> : null}
    </div>
  )
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/ProgressRing.tsx
git commit -m "feat: add progress ring component"
```

---

## Task 8: Hook dữ liệu Home

**Files:**
- Create: `src/features/home/useHomeData.ts`

- [ ] **Step 1: Cài đặt**

Tạo `src/features/home/useHomeData.ts`:

```ts
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { weekDays } from '../../lib/homeProgress'
import type { Entry, Habit, HabitLog, Media, Person, PersonOccasion, Todo } from '../../types'
import { useToast } from '../ToastContext'

/**
 * Nạp toàn bộ dữ liệu trang Home trong một lượt.
 * Bảng nào chưa có trong database (ví dụ person_occasions khi chưa chạy migration)
 * sẽ trả data null và được coi như danh sách rỗng, không làm hỏng cả trang.
 */
export function useHomeData() {
  const { showToast } = useToast()
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([])
  const [weekLogs, setWeekLogs] = useState<HabitLog[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [todosDoneToday, setTodosDoneToday] = useState<Todo[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [occasions, setOccasions] = useState<PersonOccasion[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  const week = useMemo(() => weekDays(), [])

  useEffect(() => {
    ;(async () => {
      if (!supabase) {
        setLoading(false)
        return
      }
      setLoading(true)
      const today = localDate()

      const [h, tl, wl, t, td, e, m, o, p] = await Promise.all([
        supabase.from('habits').select('*').eq('is_active', true).is('deleted_at', null),
        supabase.from('habit_logs').select('*').eq('date', today),
        supabase.from('habit_logs').select('*').gte('date', week[0].key).lte('date', week[6].key),
        supabase.from('todos').select('*').eq('completed', false).is('deleted_at', null).order('created_at'),
        supabase.from('todos').select('*').eq('completed', true).gte('completed_at', today).is('deleted_at', null),
        supabase.from('daily_entries').select('*').eq('entry_date', today).is('deleted_at', null),
        supabase.from('media_items').select('*').eq('status', 'IN_PROGRESS').is('deleted_at', null).limit(5),
        supabase.from('person_occasions').select('*').is('deleted_at', null),
        supabase.from('people').select('*').is('deleted_at', null),
      ])

      setHabits((h.data ?? []) as Habit[])
      setTodayLogs((tl.data ?? []) as HabitLog[])
      setWeekLogs((wl.data ?? []) as HabitLog[])
      setTodos((t.data ?? []) as Todo[])
      setTodosDoneToday((td.data ?? []) as Todo[])
      setEntries((e.data ?? []) as Entry[])
      setMedia((m.data ?? []) as Media[])
      setOccasions((o.data ?? []) as PersonOccasion[])
      setPeople((p.data ?? []) as Person[])
      setLoading(false)
    })()
  }, [week])

  const completedHabitIds = useMemo(
    () => new Set(todayLogs.filter((l) => l.completed).map((l) => l.habit_id)),
    [todayLogs],
  )

  const toggleHabit = async (habit: Habit) => {
    const done = !completedHabitIds.has(habit.id)
    const day = localDate()
    const next = { habit_id: habit.id, date: day, completed: done }
    setTodayLogs((prev) => [...prev.filter((l) => l.habit_id !== habit.id), next])
    setWeekLogs((prev) => [...prev.filter((l) => !(l.habit_id === habit.id && l.date === day)), next])
    await supabase?.from('habit_logs').upsert(next, { onConflict: 'habit_id,date' })
    showToast(
      done
        ? habit.habit_type === 'BAD'
          ? '⚠️ Đã đánh dấu thói quen xấu!'
          : '✅ Đã hoàn thành thói quen!'
        : '🔄 Đã bỏ tích thói quen',
    )
  }

  const toggleTodo = async (todo: Todo) => {
    const completedAt = new Date().toISOString()
    setTodos((prev) => prev.filter((t) => t.id !== todo.id))
    setTodosDoneToday((prev) => [...prev, { ...todo, completed: true, completed_at: completedAt }])
    await supabase?.from('todos').update({ completed: true, completed_at: completedAt }).eq('id', todo.id)
    showToast('✅ Đã hoàn thành công việc!')
  }

  return {
    habits,
    todayLogs,
    weekLogs,
    todos,
    todosDoneToday,
    entries,
    media,
    occasions,
    people,
    week,
    loading,
    completedHabitIds,
    toggleHabit,
    toggleTodo,
  }
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/useHomeData.ts
git commit -m "feat: add home data hook"
```

---

## Task 9: Banner chào và thẻ Habits

**Files:**
- Create: `src/features/home/GreetingBanner.tsx`
- Create: `src/features/home/HabitsCard.tsx`

- [ ] **Step 1: Viết GreetingBanner**

Tạo `src/features/home/GreetingBanner.tsx`:

```tsx
import { ChevronRight } from 'lucide-react'
import { greetingFor, type CompletionSummary } from '../../lib/homeProgress'
import { ProgressRing } from './ProgressRing'

export function GreetingBanner({ completion, onOpen }: { completion: CompletionSummary; onOpen: () => void }) {
  const greeting = greetingFor(new Date().getHours())

  return (
    <button type="button" className="greeting-banner" onClick={onOpen}>
      <span className="greeting-emoji">{greeting.emoji}</span>
      <span className="greeting-text">
        <strong>{greeting.text}</strong>
        <span>
          {completion.remaining > 0 ? (
            <>Hôm nay bạn có <b>{completion.remaining}</b> việc cần làm</>
          ) : (
            <>Hôm nay bạn đã xong hết việc rồi ✨</>
          )}
        </span>
      </span>
      <ProgressRing percent={completion.percent} size={72} stroke={7}>
        <strong>{completion.percent}%</strong>
        <span>Hoàn thành</span>
      </ProgressRing>
      <ChevronRight size={20} color="var(--text-muted)" />
    </button>
  )
}
```

- [ ] **Step 2: Viết HabitsCard**

Tạo `src/features/home/HabitsCard.tsx`:

```tsx
import { Check, ChevronRight, Flame } from 'lucide-react'
import type { Habit } from '../../types'

const ROUTINE_LABEL: Record<string, string> = {
  MORNING: '🌅 Sáng (6h–11h)',
  AFTERNOON: '☀️ Trưa (11h–18h)',
  EVENING: '🌙 Tối (18h–6h)',
}

export function currentRoutineSlot(hour = new Date().getHours()): 'MORNING' | 'AFTERNOON' | 'EVENING' {
  if (hour >= 6 && hour < 11) return 'MORNING'
  if (hour >= 11 && hour < 18) return 'AFTERNOON'
  return 'EVENING'
}

type Props = {
  habits: Habit[]
  completedIds: Set<string>
  loading: boolean
  onToggle: (habit: Habit) => void
  onOpenAll: () => void
}

export function HabitsCard({ habits, completedIds, loading, onToggle, onOpenAll }: Props) {
  const slot = currentRoutineSlot()
  const slotHabits = habits.filter((h) => (h.routine ?? 'MORNING') === slot)
  const good = slotHabits.filter((h) => h.habit_type !== 'BAD')
  const bad = slotHabits.filter((h) => h.habit_type === 'BAD')
  const doneCount = (list: Habit[]) => list.filter((h) => completedIds.has(h.id)).length

  const row = (habit: Habit, isBad: boolean) => {
    const done = completedIds.has(habit.id)
    return (
      <div
        key={habit.id}
        className={'check-row ' + (done ? 'checked' : '')}
        onClick={() => onToggle(habit)}
        style={{
          padding: '4px 8px',
          borderRadius: 8,
          margin: 0,
          cursor: 'pointer',
          background: isBad && done ? 'var(--rose-bg)' : undefined,
          border: isBad && done ? '1px solid var(--rose)' : undefined,
        }}
      >
        <span
          className="checkbox"
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: isBad && done ? 'var(--rose)' : undefined,
            borderColor: isBad && done ? 'var(--rose)' : undefined,
          }}
        >
          {done && <Check size={11} style={isBad ? { color: '#fff' } : undefined} />}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: isBad && done ? 'var(--rose)' : undefined }}>
          {habit.name}
        </span>
      </div>
    )
  }

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-amber" style={{ width: 24, height: 24 }}>
            <Flame size={14} />
          </div>
          <div>
            <div style={{ lineHeight: 1 }}>Habits</div>
            <small>{ROUTINE_LABEL[slot]}</small>
          </div>
        </div>
        <span className="home-card-count">
          {doneCount(slotHabits)}/{slotHabits.length}
        </span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : slotHabits.length === 0 ? (
          <p className="home-card-empty">Chưa có thói quen nào.</p>
        ) : (
          <>
            {good.length > 0 && (
              <div>
                <div className="home-group-title" style={{ color: 'var(--emerald)' }}>
                  🌟 Thói quen tốt ({doneCount(good)}/{good.length})
                </div>
                <div style={{ display: 'grid', gap: 3 }}>{good.map((h) => row(h, false))}</div>
              </div>
            )}

            {good.length > 0 && bad.length > 0 && <div className="home-divider" />}

            {bad.length > 0 && (
              <div>
                <div className="home-group-title" style={{ color: 'var(--rose)' }}>
                  ⚠️ Thói quen cần bỏ ({doneCount(bad)}/{bad.length})
                </div>
                <div style={{ display: 'grid', gap: 3 }}>{bad.map((h) => row(h, true))}</div>
              </div>
            )}
          </>
        )}
      </div>

      <button type="button" className="home-card-foot" onClick={onOpenAll}>
        Xem tất cả <ChevronRight size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/GreetingBanner.tsx src/features/home/HabitsCard.tsx
git commit -m "feat: add greeting banner and habits card"
```

---

## Task 10: Thẻ Việc cần làm và Nhật ký

**Files:**
- Create: `src/features/home/TodosCard.tsx`
- Create: `src/features/home/DailyCard.tsx`

- [ ] **Step 1: Viết TodosCard**

Tạo `src/features/home/TodosCard.tsx`:

```tsx
import { CheckSquare, ChevronRight } from 'lucide-react'
import type { Todo } from '../../types'

type Props = {
  todos: Todo[]
  loading: boolean
  onToggle: (todo: Todo) => void
  onOpenAll: () => void
}

export function TodosCard({ todos, loading, onToggle, onOpenAll }: Props) {
  const visible = todos.slice(0, 4)

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-purple" style={{ width: 24, height: 24 }}>
            <CheckSquare size={14} />
          </div>
          <span>Việc cần làm</span>
        </div>
        <span className="home-card-count">{todos.length}</span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : visible.length === 0 ? (
          <p className="home-card-empty">Hoàn thành hết rồi ✨</p>
        ) : (
          visible.map((todo) => (
            <div
              key={todo.id}
              className="check-row"
              onClick={() => onToggle(todo)}
              style={{ padding: '5px 8px', borderRadius: 8, margin: 0, cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span className="checkbox" style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {todo.title}
                </span>
              </div>
              {todo.priority === 'URGENT' && <span className="urgent-badge">🔥 Gấp</span>}
            </div>
          ))
        )}
      </div>

      <button type="button" className="home-card-foot" onClick={onOpenAll}>
        Xem tất cả <ChevronRight size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Viết DailyCard**

Tạo `src/features/home/DailyCard.tsx`:

```tsx
import { NotebookPen, PenLine } from 'lucide-react'
import { timeOfDay } from '../../lib/date'
import type { Entry } from '../../types'

type Props = { entries: Entry[]; loading: boolean; onWrite: () => void }

export function DailyCard({ entries, loading, onWrite }: Props) {
  const visible = entries.slice(0, 3)

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-emerald" style={{ width: 24, height: 24 }}>
            <NotebookPen size={14} />
          </div>
          <span>Nhật ký hôm nay</span>
        </div>
        <span className="home-card-count">{entries.length}</span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : visible.length === 0 ? (
          <p className="home-card-empty">Hôm nay chưa có bài viết nào.</p>
        ) : (
          visible.map((entry) => (
            <div key={entry.id} className="entry-line">
              <i />
              <div>
                <p>{entry.content}</p>
                <time>{timeOfDay(entry.created_at)}</time>
              </div>
            </div>
          ))
        )}
      </div>

      <button type="button" className="home-card-foot accent" onClick={onWrite}>
        <PenLine size={14} /> Viết nhật ký
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/TodosCard.tsx src/features/home/DailyCard.tsx
git commit -m "feat: add todos and daily cards"
```

---

## Task 11: Thẻ Đang đọc

**Files:**
- Create: `src/features/home/ReadingCard.tsx`

- [ ] **Step 1: Cài đặt**

Tạo `src/features/home/ReadingCard.tsx`:

```tsx
import { useState } from 'react'
import { BookOpen, ChevronRight, Film, Music, Youtube } from 'lucide-react'
import type { Media } from '../../types'

const TYPE_ICON = { BOOK: BookOpen, MANGA: BookOpen, MOVIE: Film, MUSIC: Music, YOUTUBE: Youtube }

function Cover({ item }: { item: Media }) {
  const [broken, setBroken] = useState(false)
  const Icon = TYPE_ICON[item.type] ?? BookOpen

  if (item.cover_url && !broken) {
    return <img className="media-cover" src={item.cover_url} alt={item.name} onError={() => setBroken(true)} />
  }
  return (
    <div className="media-cover" aria-hidden="true">
      <Icon size={22} />
    </div>
  )
}

type Props = { media: Media[]; loading: boolean; onOpenLibrary: () => void }

export function ReadingCard({ media, loading, onOpenLibrary }: Props) {
  const [featured, ...rest] = media

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-blue" style={{ width: 24, height: 24 }}>
            <BookOpen size={14} />
          </div>
          <span>Đang đọc</span>
        </div>
        <span className="home-card-count">{media.length}</span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : !featured ? (
          <p className="home-card-empty">Chưa có mục nào đang thưởng thức.</p>
        ) : (
          <>
            <div className="reading-row">
              <Cover item={featured} />
              <div style={{ minWidth: 0 }}>
                <strong>{featured.name}</strong>
                <span className="reading-badge">{featured.type}</span>
              </div>
            </div>
            {rest.slice(0, 2).map((item) => (
              <div key={item.id} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                • {item.name}
              </div>
            ))}
          </>
        )}
      </div>

      <button type="button" className="home-card-foot accent" onClick={onOpenLibrary}>
        Xem thư viện <ChevronRight size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/ReadingCard.tsx
git commit -m "feat: add reading card with cover art"
```

---

## Task 12: Tiến độ tuần và Sắp tới

**Files:**
- Create: `src/features/home/WeekProgressCard.tsx`
- Create: `src/features/home/UpcomingCard.tsx`

- [ ] **Step 1: Viết WeekProgressCard**

Tạo `src/features/home/WeekProgressCard.tsx`:

```tsx
import { Check, TrendingUp } from 'lucide-react'
import { dayStatus, type WeekDay } from '../../lib/homeProgress'
import type { Habit, HabitLog } from '../../types'
import { ProgressRing } from './ProgressRing'

type Props = { week: WeekDay[]; habits: Habit[]; logs: HabitLog[]; todayPercent: number }

export function WeekProgressCard({ week, habits, logs, todayPercent }: Props) {
  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <TrendingUp size={17} color="var(--emerald)" /> Tiến độ tuần
        </h3>
        <div className="week-legend">
          <span>
            <i style={{ background: 'var(--emerald)' }} />
            Hoàn thành
          </span>
          <span>
            <i style={{ background: 'var(--card-border)' }} />
            Chưa xong
          </span>
        </div>
      </div>

      <div className="week-strip">
        {week.map((day) => {
          const status = dayStatus(day, habits, logs)
          return (
            <div
              key={day.key}
              className={'week-day' + (day.isToday ? ' is-today' : '') + (day.isFuture ? ' is-future' : '')}
            >
              <span className="week-label">{day.label}</span>
              <span className="week-date">{day.dayMonth}</span>
              {status === 'today' ? (
                <ProgressRing percent={todayPercent} size={28} stroke={3} />
              ) : (
                <span className={'week-dot ' + status}>{status === 'done' && <Check size={15} />}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Viết UpcomingCard**

Tạo `src/features/home/UpcomingCard.tsx`:

```tsx
import { CalendarDays, Cake, Heart } from 'lucide-react'
import { countdownLabel, type UpcomingOccasion } from '../../lib/occasions'
import { shortDate } from '../../lib/date'

type Props = { items: UpcomingOccasion[]; onOpenAll: () => void }

export function UpcomingCard({ items, onOpenAll }: Props) {
  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <CalendarDays size={17} color="var(--emerald)" /> Sắp tới
        </h3>
        <button
          type="button"
          className="icon"
          onClick={onOpenAll}
          style={{ color: 'var(--emerald)', fontSize: '0.8rem', fontWeight: 700, padding: '2px 6px' }}
        >
          Xem tất cả
        </button>
      </div>

      {items.length === 0 ? (
        <p className="home-card-empty">Chưa có dịp nào sắp tới — thêm ở tab Người.</p>
      ) : (
        items.map(({ occasion, days, date, label }) => {
          const Icon = occasion.kind === 'BIRTHDAY' ? Cake : Heart
          const tone = occasion.kind === 'BIRTHDAY' ? 'rose' : 'purple'
          return (
            <div key={occasion.id} className="upcoming-row">
              <div
                className="icon-box icon-box-sm"
                style={{ width: 26, height: 26, background: `var(--${tone}-bg)`, color: `var(--${tone})` }}
              >
                <Icon size={14} />
              </div>
              <span className="upcoming-name">{label}</span>
              <span className={'countdown-badge' + (days <= 7 ? ' soon' : '')}>{countdownLabel(days)}</span>
              <time>{shortDate(date)}</time>
            </div>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/WeekProgressCard.tsx src/features/home/UpcomingCard.tsx
git commit -m "feat: add week progress and upcoming cards"
```

---

## Task 13: Ghép trang Home và nối vào App

**Files:**
- Create: `src/features/home/HomePage.tsx`
- Delete: `src/features/HomePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Viết HomePage**

Tạo `src/features/home/HomePage.tsx`:

```tsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { todayCompletion } from '../../lib/homeProgress'
import { upcomingOccasions } from '../../lib/occasions'
import { DailyCard } from './DailyCard'
import { GreetingBanner } from './GreetingBanner'
import { HabitsCard } from './HabitsCard'
import { ReadingCard } from './ReadingCard'
import { TodosCard } from './TodosCard'
import { UpcomingCard } from './UpcomingCard'
import { useHomeData } from './useHomeData'
import { WeekProgressCard } from './WeekProgressCard'

export function HomePage() {
  const data = useHomeData()
  const nav = useNavigate()

  const completion = useMemo(
    () =>
      todayCompletion({
        habits: data.habits,
        habitLogs: data.todayLogs,
        todos: [...data.todos, ...data.todosDoneToday],
      }),
    [data.habits, data.todayLogs, data.todos, data.todosDoneToday],
  )

  const upcoming = useMemo(
    () => upcomingOccasions(data.occasions, data.people, new Date(), { withinDays: 60, limit: 3 }),
    [data.occasions, data.people],
  )

  return (
    <section className="home-page">
      <GreetingBanner completion={completion} onOpen={() => nav('/tasks')} />

      <div className="home-grid home-grid-2">
        <HabitsCard
          habits={data.habits}
          completedIds={data.completedHabitIds}
          loading={data.loading}
          onToggle={data.toggleHabit}
          onOpenAll={() => nav('/habit')}
        />
        <TodosCard todos={data.todos} loading={data.loading} onToggle={data.toggleTodo} onOpenAll={() => nav('/tasks')} />
        <DailyCard entries={data.entries} loading={data.loading} onWrite={() => nav('/daily')} />
        <ReadingCard media={data.media} loading={data.loading} onOpenLibrary={() => nav('/library')} />
      </div>

      <WeekProgressCard week={data.week} habits={data.habits} logs={data.weekLogs} todayPercent={completion.percent} />
      <UpcomingCard items={upcoming} onOpenAll={() => nav('/people')} />
    </section>
  )
}
```

- [ ] **Step 2: Xoá trang Home cũ**

```bash
git rm src/features/HomePage.tsx
```

- [ ] **Step 3: Nối vào App và thêm chip ngày trên header**

Trong `src/App.tsx`:

Đổi dòng import (dòng 7) từ `import { HomePage } from './features/HomePage'` thành:

```ts
import { HomePage } from './features/home/HomePage'
```

Thêm `Calendar` vào danh sách import từ `lucide-react` (dòng 3) và thêm `shortDate, vietnameseDate` vào import từ `./lib/date` (dòng 5):

```ts
import { BookOpen, Calendar, CheckSquare, Download, Flame, Gamepad2, Home, LogOut, NotebookPen, Salad, Sparkles, SunMoon, UserRound } from 'lucide-react'
import { localDate, shortDate, vietnameseDate } from './lib/date'
```

Trong `Shell`, chèn chip ngày giữa khối `.brand` và `.header-actions` (ngay sau thẻ `</div>` đóng `.brand`, trước `<div className="header-actions">`):

```tsx
        <div className="header-date">
          <Calendar size={14} />
          <span className="header-date-full">{vietnameseDate()}</span>
          <span className="header-date-short">{shortDate()}</span>
        </div>
```

- [ ] **Step 4: Chạy toàn bộ test và build**

Run: `npm test`
Expected: PASS toàn bộ.

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/HomePage.tsx src/App.tsx
git commit -m "feat: redesign home page layout"
```

---

## Task 14: Test trang Home

**Files:**
- Test: `src/features/home/HomePage.test.tsx`

- [ ] **Step 1: Viết test**

Tạo `src/features/home/HomePage.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

// Dịp cách hôm nay 3 ngày, tính động để test không phụ thuộc vào ngày chạy.
// Năm gốc 2000 là năm nhuận nên mọi cặp ngày/tháng đều hợp lệ, kể cả 29/02.
const inThreeDays = new Date()
inThreeDays.setDate(inThreeDays.getDate() + 3)
const pad = (n: number) => String(n).padStart(2, '0')
const occasionDate = `2000-${pad(inThreeDays.getMonth() + 1)}-${pad(inThreeDays.getDate())}`

const rows: Record<string, unknown[]> = {
  habits: [
    { id: 'h1', name: 'Đọc sách', is_active: true, category_id: null, routine: 'MORNING', habit_type: 'GOOD' },
    { id: 'h2', name: 'TikTok', is_active: true, category_id: null, routine: 'MORNING', habit_type: 'BAD' },
  ],
  habit_logs: [],
  todos: [{ id: 't1', title: 'Học tiếng Anh', completed: false, created_at: '2026-08-12T07:00:00', priority: 'URGENT' }],
  daily_entries: [{ id: 'e1', content: 'Gặp chú trên đường đi', entry_date: '2026-08-12', created_at: '2026-08-12T08:30:00', entry_type: 'FEELING' }],
  media_items: [{ id: 'm1', name: 'Người đua diều', type: 'BOOK', status: 'IN_PROGRESS', is_favorite: false, description: null }],
  people: [{ id: 'p1', name: 'Linh' }],
  person_occasions: [{ id: 'o1', person_id: 'p1', kind: 'BIRTHDAY', title: '', occasion_date: occasionDate, is_yearly: true }],
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: rows[table] ?? [], error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'is', 'order', 'gte', 'lte', 'limit', 'update', 'upsert']) {
        query[method] = vi.fn(() => query)
      }
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
      return query
    },
  },
}))

vi.mock('../ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

afterEach(cleanup)

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )

describe('HomePage', () => {
  it('hiện lời chào và vòng phần trăm', async () => {
    renderHome()
    expect(await screen.findByText(/Chào buổi/)).toBeInTheDocument()
    expect(screen.getByText(/%$/)).toBeInTheDocument()
  })

  it('hiện đủ bốn thẻ chính', async () => {
    renderHome()
    expect(await screen.findByText('Habits')).toBeInTheDocument()
    expect(screen.getByText('Việc cần làm')).toBeInTheDocument()
    expect(screen.getByText('Nhật ký hôm nay')).toBeInTheDocument()
    expect(screen.getByText('Đang đọc')).toBeInTheDocument()
  })

  it('hiện dải bảy ngày trong tuần', async () => {
    renderHome()
    expect(await screen.findByText('Tiến độ tuần')).toBeInTheDocument()
    for (const label of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('hiện dịp sắp tới lấy từ tab Người', async () => {
    renderHome()
    expect(await screen.findByText('Sinh nhật Linh')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test**

Run: `npx vitest run src/features/home/HomePage.test.tsx`
Expected: PASS — 4 test.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/HomePage.test.tsx
git commit -m "test: cover home page rendering"
```

---

## Task 15: Hook dữ liệu tab Người

**Files:**
- Create: `src/features/people/usePeopleData.ts`

- [ ] **Step 1: Cài đặt**

Tạo `src/features/people/usePeopleData.ts`:

```ts
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { OccasionKind, Person, PersonOccasion } from '../../types'

const PEOPLE_KEY = 'daily_people_local'
const OCCASIONS_KEY = 'daily_occasions_local'

export type NewOccasion = {
  person_id: string | null
  kind: OccasionKind
  title: string
  occasion_date: string
  is_yearly: boolean
}

export type DataSource = 'Local' | 'Supabase'

/** Nạp người và dịp, có nhánh dự phòng localStorage khi chưa cấu hình Supabase. */
export function usePeopleData() {
  const [people, setPeople] = useState<Person[]>([])
  const [occasions, setOccasions] = useState<PersonOccasion[]>([])
  const [source, setSource] = useState<DataSource>('Local')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const savedPeople = localStorage.getItem(PEOPLE_KEY)
      if (savedPeople) setPeople(JSON.parse(savedPeople) as Person[])
      const savedOccasions = localStorage.getItem(OCCASIONS_KEY)
      if (savedOccasions) setOccasions(JSON.parse(savedOccasions) as PersonOccasion[])

      if (supabase) {
        const [p, o] = await Promise.all([
          supabase.from('people').select('*').is('deleted_at', null).order('name'),
          supabase.from('person_occasions').select('*').is('deleted_at', null).order('occasion_date'),
        ])
        if (p.data) {
          setPeople(p.data as Person[])
          setSource('Supabase')
        }
        if (o.data) setOccasions(o.data as PersonOccasion[])
      }
      setLoading(false)
    })()
  }, [])

  const persistPeople = (next: Person[]) => {
    setPeople(next)
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(next))
  }

  const persistOccasions = (next: PersonOccasion[]) => {
    setOccasions(next)
    localStorage.setItem(OCCASIONS_KEY, JSON.stringify(next))
  }

  /** Trả về nguồn đã lưu để trang hiện toast tương ứng. */
  const addPerson = async (rawName: string): Promise<DataSource> => {
    const name = rawName.trim()
    if (!name) return source
    const local: Person = { id: crypto.randomUUID(), name }

    if (!supabase) {
      persistPeople([local, ...people])
      setSource('Local')
      return 'Local'
    }

    const { data, error } = await supabase.from('people').insert({ name }).select().single()
    if (error || !data) {
      persistPeople([local, ...people])
      setSource('Local')
      return 'Local'
    }
    setPeople((prev) => [data as Person, ...prev])
    setSource('Supabase')
    return 'Supabase'
  }

  const addOccasion = async (input: NewOccasion): Promise<DataSource> => {
    const local: PersonOccasion = { id: crypto.randomUUID(), ...input, title: input.title.trim() }

    if (!supabase) {
      persistOccasions([...occasions, local])
      setSource('Local')
      return 'Local'
    }

    const { data, error } = await supabase
      .from('person_occasions')
      .insert({ ...input, title: input.title.trim() })
      .select()
      .single()

    if (error || !data) {
      persistOccasions([...occasions, local])
      setSource('Local')
      return 'Local'
    }
    setOccasions((prev) => [...prev, data as PersonOccasion])
    setSource('Supabase')
    return 'Supabase'
  }

  const removeOccasion = async (id: string) => {
    const next = occasions.filter((o) => o.id !== id)
    if (!supabase) {
      persistOccasions(next)
      return
    }
    setOccasions(next)
    await supabase.from('person_occasions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  return { people, occasions, source, loading, addPerson, addOccasion, removeOccasion }
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/features/people/usePeopleData.ts
git commit -m "feat: add people data hook with occasions"
```

---

## Task 16: Khu sinh nhật & kỉ niệm

**Files:**
- Create: `src/features/people/OccasionsSection.tsx`

- [ ] **Step 1: Cài đặt**

Tạo `src/features/people/OccasionsSection.tsx`:

```tsx
import { useState } from 'react'
import { Cake, Heart, Plus, Trash2, X } from 'lucide-react'
import { localDate, shortDate } from '../../lib/date'
import { countdownLabel, upcomingOccasions } from '../../lib/occasions'
import type { OccasionKind, Person, PersonOccasion } from '../../types'
import type { NewOccasion } from './usePeopleData'

type Props = {
  occasions: PersonOccasion[]
  people: Person[]
  /** Chỉ hiện dịp của người này và mặc định gắn dịp mới cho họ. */
  personId?: string
  title?: string
  withinDays?: number
  onAdd: (input: NewOccasion) => void
  onRemove: (id: string) => void
}

export function OccasionsSection({
  occasions,
  people,
  personId,
  title = 'Sinh nhật & Kỉ niệm',
  withinDays = 90,
  onAdd,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<OccasionKind>('BIRTHDAY')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(localDate())
  const [target, setTarget] = useState(personId ?? '')
  const [yearly, setYearly] = useState(true)

  const scoped = personId ? occasions.filter((o) => o.person_id === personId) : occasions
  const items = upcomingOccasions(scoped, people, new Date(), { withinDays, limit: 50 })

  const submit = () => {
    if (!date) return
    onAdd({
      person_id: personId ?? (target || null),
      kind,
      title: label,
      occasion_date: date,
      is_yearly: yearly,
    })
    setLabel('')
    setDate(localDate())
    setKind('BIRTHDAY')
    setYearly(true)
    if (!personId) setTarget('')
    setOpen(false)
  }

  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <Cake size={17} color="var(--rose)" /> {title}
        </h3>
        <button
          type="button"
          className="icon"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Đóng form thêm dịp' : 'Thêm dịp'}
          style={{ color: 'var(--primary)' }}
        >
          {open ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="home-card-empty">Chưa có dịp nào — bấm dấu cộng để thêm.</p>
      ) : (
        items.map(({ occasion, days, date: next, label: name }) => {
          const Icon = occasion.kind === 'BIRTHDAY' ? Cake : Heart
          const tone = occasion.kind === 'BIRTHDAY' ? 'rose' : 'purple'
          return (
            <div key={occasion.id} className="occasion-row">
              <div
                className="icon-box icon-box-sm"
                style={{ width: 26, height: 26, background: `var(--${tone}-bg)`, color: `var(--${tone})` }}
              >
                <Icon size={14} />
              </div>
              <span className="occasion-name">{name}</span>
              <span className={'countdown-badge' + (days <= 7 ? ' soon' : '')}>{countdownLabel(days)}</span>
              <time style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{shortDate(next)}</time>
              <button
                type="button"
                className="icon danger"
                aria-label={`Xoá ${name}`}
                onClick={() => onRemove(occasion.id)}
                style={{ padding: 4 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })
      )}

      {open && (
        <div className="occasion-form">
          <div className="row">
            <select value={kind} onChange={(e) => setKind(e.target.value as OccasionKind)} aria-label="Loại dịp">
              <option value="BIRTHDAY">🎂 Sinh nhật</option>
              <option value="ANNIVERSARY">💜 Kỉ niệm</option>
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày diễn ra" />
          </div>

          {!personId && (
            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Gắn với người">
              <option value="">Không gắn ai</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Tên dịp (để trống sẽ tự đặt)"
            aria-label="Tên dịp"
          />

          <label className="check">
            <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
            Lặp lại hằng năm
          </label>

          <button type="button" className="primary" onClick={submit}>
            <Plus size={14} /> Thêm dịp
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/features/people/OccasionsSection.tsx
git commit -m "feat: add occasions section component"
```

---

## Task 17: Màn chi tiết người

**Files:**
- Create: `src/features/people/PersonDetail.tsx`

- [ ] **Step 1: Cài đặt**

Tạo `src/features/people/PersonDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { ArrowLeft, Heart, Plus, Save, X } from 'lucide-react'
import { localDate } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import { ageOnNext, nextOccurrence } from '../../lib/occasions'
import type { Person, PersonDailyLog, PersonInterest, PersonOccasion } from '../../types'
import { useToast } from '../ToastContext'
import { avatarStyle, initials } from './avatar'
import { OccasionsSection } from './OccasionsSection'
import type { NewOccasion } from './usePeopleData'

type Props = {
  person: Person
  occasions: PersonOccasion[]
  people: Person[]
  onBack: () => void
  onAddOccasion: (input: NewOccasion) => void
  onRemoveOccasion: (id: string) => void
}

export function PersonDetail({ person, occasions, people, onBack, onAddOccasion, onRemoveOccasion }: Props) {
  const { showToast } = useToast()
  const [interests, setInterests] = useState<PersonInterest[]>([])
  const [interest, setInterest] = useState('')
  const [date, setDate] = useState(localDate())
  const [log, setLog] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('person_interests')
      .select('*')
      .eq('person_id', person.id)
      .then(({ data }) => setInterests((data ?? []) as PersonInterest[]))
  }, [person.id])

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('person_daily_logs')
      .select('*')
      .eq('person_id', person.id)
      .eq('log_date', date)
      .maybeSingle()
      .then(({ data }) => setLog((data as PersonDailyLog | null)?.content ?? ''))
  }, [person.id, date])

  const birthday = occasions.find((o) => o.person_id === person.id && o.kind === 'BIRTHDAY')
  const nextBirthday = birthday ? nextOccurrence(birthday) : null
  const age = birthday ? ageOnNext(birthday) : null

  const addInterest = async () => {
    const label = interest.trim()
    if (!label) return
    const local: PersonInterest = { id: crypto.randomUUID(), person_id: person.id, label }
    setInterests((prev) => [...prev, local])
    setInterest('')
    if (!supabase) return showToast('Sở thích đã lưu Local')
    const { error } = await supabase.from('person_interests').insert({ person_id: person.id, label })
    showToast(error ? 'Sở thích đã lưu Local' : 'Sở thích đã lưu Supabase')
  }

  const removeInterest = async (id: string) => {
    setInterests((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('person_interests').delete().eq('id', id)
  }

  const saveLog = async () => {
    if (!log.trim()) return
    if (!supabase) return showToast('Đã lưu Local')
    const { error } = await supabase
      .from('person_daily_logs')
      .upsert({ person_id: person.id, log_date: date, content: log.trim() }, { onConflict: 'user_id,person_id,log_date' })
    showToast(error ? 'Đã lưu Local' : 'Đã lưu Supabase')
  }

  return (
    <section className="people-page">
      <button className="icon" onClick={onBack} style={{ marginBottom: 10, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <ArrowLeft size={18} /> Người
      </button>

      <div className="person-hero">
        {person.avatar_url ? (
          <img className="person-avatar large" src={person.avatar_url} alt={person.name} />
        ) : (
          <div className="person-avatar large" style={avatarStyle(person.name)}>
            {initials(person.name)}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h2>{person.name}</h2>
          {nextBirthday && (
            <div className="person-meta">
              🎂 Sinh nhật {nextBirthday.getDate()}/{nextBirthday.getMonth() + 1}
              {age ? ` · ${age} tuổi` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="card home-section-card">
        <div className="home-section-head">
          <h3>
            <Heart size={17} color="var(--rose)" /> Sở thích
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="Thêm sở thích…"
            aria-label="Thêm sở thích"
          />
          <button className="primary" onClick={addInterest} aria-label="Lưu sở thích">
            <Plus size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {interests.length === 0 && <p className="home-card-empty">Chưa ghi sở thích nào.</p>}
          {interests.map((item) => (
            <span key={item.id} className="interest-chip">
              <Heart size={12} /> {item.label}
              <button onClick={() => removeInterest(item.id)} aria-label={`Xoá ${item.label}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <OccasionsSection
        occasions={occasions}
        people={people}
        personId={person.id}
        title="Dịp của người này"
        withinDays={400}
        onAdd={onAddOccasion}
        onRemove={onRemoveOccasion}
      />

      <div className="card home-section-card">
        <div className="home-section-head">
          <h3>Nhật ký</h3>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày nhật ký" />
        </div>
        <textarea
          rows={8}
          value={log}
          onChange={(e) => setLog(e.target.value)}
          placeholder={`Viết nhật ký với ${person.name}…`}
          style={{ width: '100%' }}
        />
        <button className="primary" onClick={saveLog} style={{ marginTop: 8 }}>
          <Save size={14} /> Lưu
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/features/people/PersonDetail.tsx
git commit -m "feat: redesign person detail view"
```

---

## Task 18: Màn danh sách người

**Files:**
- Create: `src/features/people/PeoplePage.tsx`
- Delete: `src/features/PeoplePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Viết PeoplePage**

Tạo `src/features/people/PeoplePage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { ChevronRight, Plus, UserRound } from 'lucide-react'
import { nextOccurrence } from '../../lib/occasions'
import type { Person } from '../../types'
import { Empty } from '../shared'
import { useToast } from '../ToastContext'
import { avatarStyle, initials } from './avatar'
import { OccasionsSection } from './OccasionsSection'
import { PersonDetail } from './PersonDetail'
import { usePeopleData, type NewOccasion } from './usePeopleData'

export function PeoplePage() {
  const { showToast } = useToast()
  const { people, occasions, loading, addPerson, addOccasion, removeOccasion } = usePeopleData()
  const [selected, setSelected] = useState<Person | null>(null)
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
    [people, search],
  )

  const handleAddOccasion = async (input: NewOccasion) => {
    const savedTo = await addOccasion(input)
    showToast(`Đã lưu ${savedTo}`)
  }

  const handleAddPerson = async () => {
    if (!name.trim()) return
    const savedTo = await addPerson(name)
    setName('')
    showToast(`Đã lưu ${savedTo}`)
  }

  const birthdayOf = (personId: string) => {
    const birthday = occasions.find((o) => o.person_id === personId && o.kind === 'BIRTHDAY')
    if (!birthday) return null
    const next = nextOccurrence(birthday)
    return next ? `${next.getDate()}/${next.getMonth() + 1}` : null
  }

  if (selected) {
    return (
      <PersonDetail
        person={selected}
        occasions={occasions}
        people={people}
        onBack={() => setSelected(null)}
        onAddOccasion={handleAddOccasion}
        onRemoveOccasion={removeOccasion}
      />
    )
  }

  return (
    <section className="people-page">
      <div className="card home-section-card">
        <div className="home-section-head">
          <h3>
            <UserRound size={17} color="var(--cyan)" /> Người
          </h3>
          <span className="home-card-count">{people.length}</span>
        </div>

        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên…"
          aria-label="Tìm theo tên"
          style={{ width: '100%', marginBottom: 8 }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên người…"
            aria-label="Tên người mới"
          />
          <button className="primary" onClick={handleAddPerson}>
            <Plus size={14} /> Thêm
          </button>
        </div>
      </div>

      <OccasionsSection
        occasions={occasions}
        people={people}
        onAdd={handleAddOccasion}
        onRemove={removeOccasion}
      />

      <div style={{ marginTop: 12 }}>
        {loading && people.length === 0 ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : filtered.length === 0 ? (
          <Empty icon={UserRound}>{people.length === 0 ? 'Chưa có người nào.' : 'Không tìm thấy ai.'}</Empty>
        ) : (
          <div className="person-grid">
            {filtered.map((person) => {
              const birthday = birthdayOf(person.id)
              return (
                <button key={person.id} className="person-tile" onClick={() => setSelected(person)}>
                  {person.avatar_url ? (
                    <img className="person-avatar" src={person.avatar_url} alt={person.name} />
                  ) : (
                    <div className="person-avatar" style={avatarStyle(person.name)}>
                      {initials(person.name)}
                    </div>
                  )}
                  <div className="person-body">
                    <strong>{person.name}</strong>
                    {birthday && <div className="person-meta">🎂 {birthday}</div>}
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Xoá trang cũ và nối vào App**

```bash
git rm src/features/PeoplePage.tsx
```

Trong `src/App.tsx`, đổi dòng import `import { PeoplePage } from './features/PeoplePage'` thành:

```ts
import { PeoplePage } from './features/people/PeoplePage'
```

- [ ] **Step 3: Chạy test và build**

Run: `npm test`
Expected: PASS toàn bộ.

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/features/people/PeoplePage.tsx src/App.tsx
git commit -m "feat: redesign people list with occasions"
```

---

## Task 19: Test tab Người

**Files:**
- Test: `src/features/people/PeoplePage.test.tsx`

- [ ] **Step 1: Viết test**

Tạo `src/features/people/PeoplePage.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PeoplePage } from './PeoplePage'

const rows: Record<string, unknown[]> = {
  people: [
    { id: 'p1', name: 'Nguyễn Thuỳ Linh' },
    { id: 'p2', name: 'Minh' },
  ],
  person_occasions: [],
  person_interests: [],
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: rows[table] ?? [], error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'is', 'order', 'insert', 'update', 'upsert', 'delete', 'single', 'maybeSingle']) {
        query[method] = vi.fn(() => query)
      }
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
      return query
    },
  },
}))

vi.mock('../ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('PeoplePage', () => {
  it('hiện danh sách người kèm chữ cái đầu', async () => {
    render(<PeoplePage />)
    expect(await screen.findByText('Nguyễn Thuỳ Linh')).toBeInTheDocument()
    expect(screen.getByText('NL')).toBeInTheDocument()
  })

  it('lọc theo ô tìm kiếm', async () => {
    render(<PeoplePage />)
    await screen.findByText('Nguyễn Thuỳ Linh')
    await userEvent.type(screen.getByLabelText('Tìm theo tên'), 'minh')
    expect(screen.queryByText('Nguyễn Thuỳ Linh')).not.toBeInTheDocument()
    expect(screen.getByText('Minh')).toBeInTheDocument()
  })

  it('mở được form thêm dịp', async () => {
    render(<PeoplePage />)
    await userEvent.click(await screen.findByLabelText('Thêm dịp'))
    expect(screen.getByLabelText('Loại dịp')).toBeInTheDocument()
    expect(screen.getByLabelText('Gắn với người')).toBeInTheDocument()
  })

  it('mở màn chi tiết khi bấm vào một người', async () => {
    render(<PeoplePage />)
    await userEvent.click(await screen.findByText('Minh'))
    expect(await screen.findByLabelText('Thêm sở thích')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test**

Run: `npx vitest run src/features/people/PeoplePage.test.tsx`
Expected: PASS — 4 test.

- [ ] **Step 3: Commit**

```bash
git add src/features/people/PeoplePage.test.tsx
git commit -m "test: cover people page rendering"
```

---

## Task 20: Ô nhập ảnh bìa trong Thư viện

**Files:**
- Modify: `src/features/LibraryPage.tsx`

- [ ] **Step 1: Thêm state**

Trong `src/features/LibraryPage.tsx`, thêm ngay dưới dòng 132 (`const [audioUrlVal, setAudioUrlVal] = useState('')`):

```ts
  const [coverUrlVal, setCoverUrlVal] = useState('')
```

- [ ] **Step 2: Đặt lại giá trị khi mở modal**

Trong `openAdd` (dòng 203), thêm sau `setAudioUrlVal('')`:

```ts
    setCoverUrlVal('')
```

Trong `openEdit` (dòng 220), thêm sau `setAudioUrlVal(item.audio_url ?? '')`:

```ts
    setCoverUrlVal(item.cover_url ?? '')
```

- [ ] **Step 3: Ghi vào payload khi lưu**

Trong `saveItem`, thêm vào object `payload` ngay sau dòng `audio_url: audioUrlVal.trim() || null,`:

```ts
      cover_url: coverUrlVal.trim() || null,
```

- [ ] **Step 4: Thêm ô nhập vào modal**

Trong khối `<Modal>`, chèn ngay sau khối `<label>Tên mục …</label>` (kết thúc ở dòng 1142):

```tsx
          <label>
            Link ảnh bìa
            <input
              value={coverUrlVal}
              onChange={(e) => setCoverUrlVal(e.target.value)}
              placeholder="Dán link ảnh bìa (tuỳ chọn)…"
            />
          </label>
          {coverUrlVal.trim() && (
            <img
              src={coverUrlVal.trim()}
              alt="Xem trước ảnh bìa"
              style={{ width: 64, height: 92, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
```

- [ ] **Step 5: Kiểm tra biên dịch và test**

Run: `npm run build`
Expected: build thành công.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/features/LibraryPage.tsx
git commit -m "feat: add cover url input to library form"
```

---

## Task 21: Kiểm tra tổng thể

**Files:** không sửa tệp nào, chỉ xác minh.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: tất cả tệp test PASS, không có test nào bị bỏ qua.

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: `tsc -b` không lỗi, `vite build` sinh thư mục `dist`.

- [ ] **Step 3: Kiểm tra bằng mắt**

Run: `npm run dev`

Mở `http://localhost:5173` và xác nhận:
1. Header có chip ngày tiếng Việt, thu nhỏ cửa sổ dưới 640px thì chip rút gọn còn `dd/MM/yyyy`.
2. Home hiện banner chào đúng buổi, vòng phần trăm khớp với số việc đã xong.
3. Bốn thẻ xếp 2×2, thu hẹp dưới 560px thì xuống 1 cột.
4. Tick một habit thì phần trăm ở banner và chấm "hôm nay" ở dải tuần đổi ngay.
5. Dải tuần bắt đầu từ T2 và kết thúc CN, hôm nay được tô primary.
6. Tab Người: thêm một dịp sinh nhật, dịp xuất hiện trong khu "Sinh nhật & Kỉ niệm" và trong khối "Sắp tới" ở Home sau khi tải lại.
7. Bấm vào một người mở màn chi tiết có avatar lớn, sở thích, dịp riêng, nhật ký.
8. Thư viện: dán link ảnh bìa cho một mục `IN_PROGRESS`, ảnh hiện ở thẻ "Đang đọc" trên Home.
9. Bật chế độ tối, toàn bộ giao diện mới vẫn đọc được, không có mảng trắng lạc lõng.

- [ ] **Step 4: Commit nếu có chỉnh sửa nhỏ sau kiểm tra**

```bash
git add -A
git commit -m "fix: polish home and people redesign after review"
```

---

## Ghi chú khi chạy

- Migration phải được áp lên Supabase trước khi khu "Sinh nhật & Kỉ niệm" lưu được lên server. Chưa chạy migration thì truy vấn `person_occasions` trả về lỗi, code coi như danh sách rỗng và tự rơi về `localStorage` — giao diện vẫn chạy.
- Nếu database chưa có cột `media_items.cover_url`, `saveItem` trong `LibraryPage` đã có sẵn nhánh dự phòng lưu các cột cơ bản, nên form vẫn lưu được tên và trạng thái.
