# Thiết kế lại trang Home & tab Người

Ngày: 2026-08-12

## Bối cảnh

Trang Home hiện là lưới 2×2 gồm Habits, To Do, Today's Daily, Currently — thông tin đủ nhưng thiếu phần tóm tắt tổng quan và không có cái nhìn theo tuần. Tab Người thì mới ở mức thô: toàn bộ giao diện dồn trong hai dòng JSX, danh sách người chỉ là thẻ trắng có icon và tên, cột `avatar_url` trong bảng `people` chưa được dùng.

Mục tiêu:

1. Dựng lại Home theo bố cục: banner chào + vòng % hoàn thành → lưới 2×2 → tiến độ tuần → sắp tới.
2. Thêm dữ liệu **sinh nhật & kỉ niệm**, quản lý ở tab Người, hiển thị đếm ngược ở Home.
3. Thêm **ảnh bìa** cho mục thư viện để thẻ "Đang đọc" có hình.
4. Thiết kế lại toàn bộ giao diện tab Người.

Không nằm trong phạm vi: hệ mục tiêu (goals), widget dashboard kéo thả tuỳ biến.

## Mô hình dữ liệu

Migration `20260815000000_person_occasions_media_cover.sql`.

### Bảng mới `public.person_occasions`

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `user_id` | `uuid not null default auth.uid()` | Chủ sở hữu, theo pattern các bảng khác. |
| `person_id` | `uuid references people(id) on delete cascade` | Cho phép **null** — dịp không gắn với ai (ví dụ "Kỉ niệm ngày cưới"). |
| `kind` | `text not null default 'BIRTHDAY'` | Ràng buộc `check (kind in ('BIRTHDAY','ANNIVERSARY'))`. |
| `title` | `text not null default ''` | Rỗng với sinh nhật thì hiển thị `Sinh nhật {tên người}`. |
| `occasion_date` | `date not null` | Ngày gốc. Với sinh nhật, năm chính là năm sinh — dùng để tính tuổi. |
| `is_yearly` | `boolean not null default true` | `true` = lặp hằng năm; `false` = dịp một lần, qua rồi thì ẩn. |
| `created_at` | `timestamptz not null default now()` | |
| `deleted_at` | `timestamptz` | Xoá mềm, đồng bộ với các bảng khác. |

Bật RLS, policy `user_id = auth.uid()` cho cả `using` và `with check`, đúng khuôn các migration trước. Index `(user_id, occasion_date)`.

### Cột mới trên `public.media_items`

`alter table public.media_items add column if not exists cover_url text;` — link ảnh bìa, null thì giao diện tự sinh khối gradient thay thế.

### Kiểu TypeScript

Thêm vào `src/types/index.ts`:

```ts
export type OccasionKind = 'BIRTHDAY' | 'ANNIVERSARY'

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

`Media` thêm `cover_url?: string | null`.

## Logic thuần — thư viện dùng chung

### `src/lib/occasions.ts` (+ `occasions.test.ts`)

- `nextOccurrence(occasion, today)` — dịp lặp hằng năm: trả về ngày cùng tháng/ngày ở năm nay nếu chưa qua, ngược lại năm sau. **Hôm nay tính là chưa qua.** Dịp một lần: trả về chính `occasion_date`, hoặc `null` nếu đã qua. Ngày 29/02 vào năm không nhuận lùi về 28/02.
- `daysUntil(date, today)` — số ngày nguyên, so sánh theo ngày địa phương chứ không theo mốc giờ, nên không bị lệch vì múi giờ.
- `ageOnNext(occasion, today)` — tuổi sẽ tròn vào lần tới; trả `null` khi năm gốc lớn hơn hoặc bằng năm tới (dữ liệu không hợp lệ).
- `occasionLabel(occasion, personName)` — `title` nếu có, không thì `Sinh nhật {tên}` / `Kỉ niệm`.
- `countdownLabel(days)` — `Hôm nay` · `Ngày mai` · `Còn N ngày`.
- `upcomingOccasions(occasions, people, today, { withinDays, limit })` — ghép tên người, lọc theo cửa sổ ngày, sắp xếp tăng dần theo số ngày còn lại, cắt theo `limit`.

### `src/lib/homeProgress.ts` (+ `homeProgress.test.ts`)

- `todayCompletion({ habits, habitLogs, todos }, today)` → `{ done, total, percent, remaining }`.
  - Mẫu số: số habit đang hoạt động + số todo chưa hoàn thành + số todo hoàn thành trong hôm nay.
  - Tử số: số habit đã tick hôm nay + số todo hoàn thành hôm nay.
  - `total = 0` → `percent = 0`, tránh chia cho không.
  - `remaining` là số việc còn lại, dùng cho câu "Hôm nay bạn có N việc cần làm".
- `weekDays(today)` — 7 ngày của tuần hiện tại, **bắt đầu từ Thứ Hai**, mỗi phần tử `{ date, label: 'T2'…'CN', dayMonth: '12/8', isToday, isFuture }`.
- `dayStatus(day, habits, logsOfWeek)` → `'done' | 'partial' | 'empty' | 'today' | 'future'`. Ngày đã qua đạt từ **80%** habit trở lên là `done`.
- `greetingFor(hour)` → `Chào buổi sáng` (5–11) · `Chào buổi trưa` (11–13) · `Chào buổi chiều` (13–18) · `Chào buổi tối` (18–5), kèm emoji tương ứng.

Hạn chế đã biết: những ngày trước khi một habit được tạo vẫn tính habit đó vào mẫu số, nên tuần đầu dùng app có thể hiện thiếu. Chấp nhận được, đổi lại không phải lưu lịch sử thay đổi habit.

### `src/features/people/avatar.ts` (+ `avatar.test.ts`)

- `initials(name)` — chữ cái đầu của từ đầu và từ cuối, viết hoa, tối đa 2 kí tự; chuỗi rỗng trả `'?'`.
- `avatarColor(name)` — băm tên rồi chọn ổn định một trong sáu cặp màu token sẵn có (blue, amber, emerald, purple, rose, cyan). Cùng một tên luôn ra cùng màu.

## Trang Home — `src/features/home/`

`HomePage.tsx` cũ (281 dòng, mọi thứ trong một component) tách thành thư mục, theo đúng pattern `src/features/library/` và `src/features/nutrition/`:

| Tệp | Trách nhiệm |
| --- | --- |
| `HomePage.tsx` | Bố cục dọc, gọi `useHomeData`, phân phối dữ liệu xuống các thẻ. |
| `useHomeData.ts` | Nạp toàn bộ dữ liệu Home trong một `Promise.all`, giữ state, cung cấp `toggleHabit` / `toggleTodo` với cập nhật lạc quan. |
| `ProgressRing.tsx` | Vòng tròn SVG dùng lại cho banner và cột ngày trong tiến độ tuần. |
| `GreetingBanner.tsx` | Banner chào. |
| `HabitsCard.tsx` | Thẻ Habits. |
| `TodosCard.tsx` | Thẻ Việc cần làm. |
| `DailyCard.tsx` | Thẻ Nhật ký hôm nay. |
| `ReadingCard.tsx` | Thẻ Đang đọc. |
| `WeekProgressCard.tsx` | Tiến độ tuần. |
| `UpcomingCard.tsx` | Sắp tới. |

Tệp `src/features/HomePage.tsx` cũ bị xoá; `App.tsx` đổi import sang `./features/home/HomePage`.

### Nạp dữ liệu

`useHomeData` gọi song song: habits đang hoạt động · habit_logs hôm nay · habit_logs cả tuần · todos chưa xong (giới hạn 4 để hiển thị) · todos hoàn thành hôm nay (đếm phần trăm) · daily_entries hôm nay · media đang thưởng thức · person_occasions + people. Trả về `loading` để các thẻ hiện trạng thái "Đang tải…" như hiện tại.

### Chip ngày trên header

Chuyển ngày tiếng Việt (`Thứ Tư, 12/08/2026`) từ thân trang Home lên giữa header trong `Shell` của `App.tsx`, dạng chip nền `--primary-light` chữ `--primary` kèm icon lịch. Hiện ở mọi trang. Trên màn hẹp (dưới 640px) chip rút gọn còn `12/08/2026` để không đẩy các nút hành động.

### Banner chào

Thẻ nền gradient nhạt, một hàng: icon buổi trong ngày trên nền tròn trắng → khối chữ `Chào buổi sáng` (đậm, cỡ lớn) và `Hôm nay bạn có N việc cần làm` (số N tô màu primary) → `ProgressRing` hiện `{percent}%` với nhãn `Hoàn thành` → mũi tên `›`. Bấm cả banner điều hướng sang `/tasks`.

### Lưới 2×2

- **Habits** — giữ nguyên logic khung giờ hiện tại (`MORNING` 6–11h, `AFTERNOON` 11–18h, `EVENING` còn lại), chia mục thói quen tốt / thói quen cần bỏ với đường kẻ đứt ở giữa, tick vẫn `upsert` vào `habit_logs`. Thêm chân thẻ `Xem tất cả ›` sang `/habit`.
- **Việc cần làm** — 4 việc chưa xong, badge `🔥 Gấp` cho `priority = 'URGENT'`, chân thẻ `Xem tất cả ›` sang `/tasks`. Tick việc vẫn cập nhật `completed` và bỏ khỏi danh sách ngay.
- **Nhật ký hôm nay** — đổi từ thẻ gradient xanh đậm sang thẻ trắng như các thẻ khác. Mỗi mục: chấm tròn màu, nội dung một dòng cắt bớt, giờ tạo `HH:mm` bên dưới. Chân thẻ là nút `✏️ Viết nhật ký` nền `--primary-light` sang `/daily`.
- **Đang đọc** — mục đầu tiên trong `media` hiển thị nổi: ảnh bìa 56×80 bo góc từ `cover_url`, không có thì khối gradient theo màu của loại kèm icon; bên phải là tên (tối đa 2 dòng) và badge loại. Chân thẻ `Xem thư viện ›` sang `/library`.

Cả bốn thẻ dùng chung khung: `.card` sẵn có, tiêu đề gồm `icon-box` + tên + số đếm bên phải, đường kẻ dưới tiêu đề, thân thẻ cuộn dọc, chân thẻ cố định. Chiều cao cố định như hiện tại để lưới thẳng hàng.

### Tiến độ tuần

Thẻ ngang đầy chiều rộng. Tiêu đề `📈 Tiến độ tuần` bên trái, chú thích `● Hoàn thành ● Chưa xong` bên phải. Bảy cột chia đều, mỗi cột: nhãn thứ (`T2`…`CN`, hôm nay tô primary), ngày `d/M`, rồi vòng tròn 28px:

| Trạng thái | Hiển thị |
| --- | --- |
| `done` | Tròn đặc màu `--emerald`, dấu tick trắng |
| `today` | `ProgressRing` viền primary theo phần trăm hôm nay |
| `partial` / `empty` | Vòng rỗng viền `--card-border` |
| `future` | Vòng rỗng mờ (opacity thấp hơn) |

Có vạch ngăn dọc mảnh giữa các cột như trong mẫu.

### Sắp tới

Thẻ ngang đầy chiều rộng. Tiêu đề `📅 Sắp tới`, bên phải là `Xem tất cả` sang `/people`. Mỗi dòng: icon theo loại (bánh sinh nhật cho `BIRTHDAY`, trái tim cho `ANNIVERSARY`) trên nền nhạt → nhãn dịp → badge đếm ngược → ngày `dd/MM/yyyy` căn phải. Badge trong vòng 7 ngày dùng nền `--rose-bg` chữ `--rose`, xa hơn thì nền `--soft` chữ `--text-muted`.

Lấy tối đa **3 dịp** trong **60 ngày** tới. Không có dịp nào thì hiện dòng gợi ý mờ `Chưa có dịp nào sắp tới — thêm ở tab Người`, không ẩn hẳn thẻ.

## Tab Người — `src/features/people/`

`src/features/PeoplePage.tsx` cũ bị xoá, thay bằng thư mục:

| Tệp | Trách nhiệm |
| --- | --- |
| `PeoplePage.tsx` | Màn danh sách, chuyển đổi sang màn chi tiết. |
| `PersonDetail.tsx` | Màn chi tiết một người. |
| `OccasionsSection.tsx` | Khu sinh nhật & kỉ niệm, dùng lại ở cả hai màn (có prop lọc theo người). |
| `usePeopleData.ts` | Nạp người + dịp, thêm/xoá, gồm cả nhánh dự phòng `localStorage`. |
| `avatar.ts` | Chữ cái đầu và màu avatar. |

### Màn danh sách

1. **Thẻ đầu trang** — icon Người + tiêu đề + tổng số, ô tìm theo tên (lọc phía client), nút `+ Thêm người` mở ô nhập tên ngay dưới.
2. **Khu "Sinh nhật & Kỉ niệm"** — danh sách dịp sắp tới trong 90 ngày kèm badge đếm ngược, cùng nguồn dữ liệu và cùng hàm `upcomingOccasions` với khối Sắp tới ở Home. Có nút `+ Thêm dịp` mở form: chọn người (tuỳ chọn, có mục "Không gắn ai") · loại · tiêu đề · ngày · ô tích lặp hằng năm. Mỗi dòng có nút xoá (xoá mềm, đặt `deleted_at`).
3. **Lưới người 2 cột** — mỗi thẻ: avatar tròn 44px (ảnh từ `avatar_url`, không có thì chữ cái đầu trên nền màu sinh từ tên), tên đậm, tối đa 2 chip sở thích rồi `+N`, dòng phụ `🎂 15/08` nếu người đó có sinh nhật, mũi tên `›` bên phải. Chưa có ai thì dùng `Empty` sẵn có.

Trên màn hẹp lưới rút về 1 cột.

### Màn chi tiết

1. **Nút quay lại** dạng chip có icon mũi tên trái.
2. **Hero** — thẻ gradient nhạt: avatar 64px, tên cỡ lớn, dòng phụ `Sinh nhật 15/08 · 25 tuổi` khi có dữ liệu sinh nhật (tuổi lấy từ `ageOnNext`).
3. **Thẻ Sở thích** — chip bo tròn nền `--rose-bg` có nút xoá nhỏ, ô nhập thêm nhanh với nút `+`.
4. **Thẻ Dịp** — `OccasionsSection` lọc theo người này, thêm/xoá tại chỗ.
5. **Thẻ Nhật ký** — chọn ngày, textarea, nút Lưu. Giữ nguyên `upsert` lên `person_daily_logs` với `onConflict: 'user_id,person_id,log_date'` và nhãn nguồn `(Local)` / `(Supabase)` hiện có.

### Ràng buộc giữ nguyên

- Dự phòng `localStorage` khi chưa cấu hình Supabase, dùng đúng khoá `daily_people_local`. Dịp cũng được lưu dự phòng theo khoá `daily_occasions_local`.
- Toast `Đã lưu Local` / `Đã lưu Supabase` như hiện tại.
- Mọi truy vấn giữ điều kiện `.is('deleted_at', null)`.

## Thư viện — thêm ảnh bìa

Trong modal thêm/sửa mục ở `src/features/LibraryPage.tsx`, thêm một ô nhập `Link ảnh bìa` (dán URL) vào phần thông tin chung, ghi xuống `cover_url`. Ô này áp dụng cho mọi loại mục, không riêng sách. Khi có link, modal hiện xem trước nhỏ; link hỏng thì ẩn ảnh và quay về khối gradient thay thế.

## CSS

Thêm vào `src/styles.css` các lớp mới, dùng biến token sẵn có nên tự động chạy đúng ở cả hai chế độ sáng/tối:

`.greeting-banner`, `.progress-ring`, `.home-section-card`, `.week-strip`, `.week-day`, `.upcoming-row`, `.countdown-badge`, `.person-grid`, `.person-tile`, `.person-avatar`, `.person-hero`, `.interest-chip`, `.occasion-row`, `.media-cover`.

Không sửa các lớp đang dùng chung (`.card`, `.check-row`, `.icon-box`, `.bottom-nav`) để tránh ảnh hưởng các trang khác.

## Kiểm thử

Chạy bằng `npm test` (vitest). Mock `../lib/supabase` theo đúng khuôn `NutritionPage.test.tsx`.

| Tệp | Nội dung |
| --- | --- |
| `src/lib/occasions.test.ts` | Lặp hằng năm qua mốc năm mới, dịp hôm nay, dịp một lần đã qua, 29/02, tính tuổi, sắp xếp và cắt danh sách. |
| `src/lib/homeProgress.test.ts` | Phần trăm khi không có việc nào, đếm đúng habit và todo, tuần bắt đầu Thứ Hai, phân loại trạng thái ngày ở ngưỡng 80%, lời chào theo giờ. |
| `src/features/people/avatar.test.ts` | Chữ cái đầu với tên một từ / nhiều từ / rỗng, màu ổn định theo tên. |
| `src/features/home/HomePage.test.tsx` | Hiện lời chào và phần trăm, đủ bốn thẻ, dải bảy ngày, dòng dịp sắp tới. |
| `src/features/people/PeoplePage.test.tsx` | Lọc theo ô tìm kiếm, thêm dịp hiện ra trong danh sách, mở được màn chi tiết. |

Kiểm tra cuối cùng: `npm test` và `npm run build` đều phải xanh.
