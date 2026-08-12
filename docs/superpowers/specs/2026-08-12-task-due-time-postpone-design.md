# Giờ hạn chót & Trì hoãn công việc

Ngày: 2026-08-12

## Bối cảnh

Công việc (`todos`) hiện chỉ có `due_date` — hạn theo ngày, không có giờ. Người dùng muốn:

1. Đặt được **giờ hạn chót** cho công việc, không chỉ ngày.
2. Có nút **trì hoãn** để cộng thêm thời gian cho việc đó, lưu xuống database.
3. **Thống kê** số lần trì hoãn và số phút đã trì hoãn.

## Mô hình dữ liệu

Migration `20260814000000_todos_due_time_postpone.sql`.

Thêm vào `public.todos`:

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `due_time` | `text` | Giờ hạn chót `'HH:MM'`. Null = cả ngày (giữ nguyên hành vi cũ). |
| `postpone_count` | `integer not null default 0` | Số lần đã trì hoãn. |
| `postpone_minutes` | `integer not null default 0` | Tổng số phút đã trì hoãn. |

Bảng mới `public.task_postpones` — lịch sử chi tiết từng lần: `todo_id` (FK, `on delete cascade`), `minutes`, `reason`, `prev_due_date`, `prev_due_time`, `new_due_date`, `new_due_time`, `created_at`. Bật RLS với policy `user_id = auth.uid()` theo đúng pattern các bảng khác.

Hai cột tổng hợp trên `todos` phục vụ hiển thị badge và thống kê nhanh mà không cần join; `task_postpones` là nguồn sự thật chi tiết.

## Logic hạn chót — `src/lib/deadline.ts`

Tách riêng thành hàm thuần, có unit test đầy đủ (`deadline.test.ts`):

- `deadlineOf(todo)` — ghép `due_date` + `due_time` thành `Date` theo giờ địa phương. Không có giờ → **23:59** ngày đó. Không có `due_date` → lấy ngày tạo. Không có mốc nào → `null`.
- `isOverdue(todo, now)` — quá hạn tính cả giờ; task đã hoàn thành không bao giờ tính quá hạn.
- `postponeTo(todo, minutes, now)` — trả về `{ due_date, due_time }` mới.
- `formatMinutes`, `formatDeadline`, `timeLabel` — định dạng hiển thị tiếng Việt.

**Quy tắc trì hoãn:** mốc cộng thêm = hạn cũ nếu hạn còn ở tương lai, ngược lại = thời điểm bấm nút. Nhờ vậy trì hoãn một task đã quá hạn luôn cho ra hạn mới ở phía trước thay vì vẫn nằm trong quá khứ. Cộng phút tự nhảy sang ngày mới khi vượt nửa đêm (`23:50 + 30p` → hôm sau `00:20`).

Số phút ghi vào thống kê là số phút người dùng chọn, không phụ thuộc mốc tính.

## Giao diện — `src/features/TasksPage.tsx`

**Component `TodoRow`** dùng chung cho danh sách tồn đọng (`compact`) và danh sách ngày đang chọn, thay cho hai khối markup trùng nhau trước đây. Trên mỗi dòng: giờ hạn (`⏰ 18:30`, đỏ khi quá giờ), badge `⏳×n` khi đã trì hoãn, nút trì hoãn, nút xem, nút sửa.

**Modal Thêm/Sửa:** dòng "Hạn hoàn thành" gồm input `date` + input `time` + nút "Cả ngày" để bỏ giờ.

**Modal Trì hoãn:** preset `+15 phút / +30 phút / +1 giờ / +3 giờ / +1 ngày`, ô nhập phút tùy chỉnh (ghi đè preset khi có giá trị), ô lý do tùy chọn, và khối preview "hạn mới" cập nhật realtime. Nút xác nhận bị vô hiệu khi số phút ≤ 0.

**Modal Chi tiết:** thêm Hạn hoàn thành, dòng "Đã trì hoãn: n lần · tổng X", danh sách lịch sử trì hoãn nạp từ `task_postpones`, và nút Trì hoãn mở thẳng modal trên.

**Tab Thống kê:** 2 card mới (Số lần trì hoãn, Tổng thời gian trì hoãn) + khối "Thống kê trì hoãn" gồm số công việc từng bị trì hoãn, trung bình mỗi lần, và top 5 công việc bị trì hoãn nhiều nhất.

Một đồng hồ `now` cập nhật mỗi 60 giây giữ cho việc tô đỏ quá hạn luôn đúng mà không cần tải lại trang.

## Ghi dữ liệu

Theo đúng pattern optimistic sẵn có: cập nhật state trước → `update` bảng `todos` → `insert` một dòng `task_postpones`. Lỗi mạng thì `saveLocal` và báo "Đã lưu Local".

## Phạm vi không làm

Nhóm "Tồn đọng ngày trước" vẫn phân loại **theo ngày** như cũ; task quá giờ trong ngày chỉ được tô đỏ giờ hạn chứ không nhảy sang khối tồn đọng — giữ bố cục quen thuộc.

## Kiểm thử

- `src/lib/deadline.test.ts` — 19 test cho toàn bộ logic hạn/trì hoãn, gồm các ca biên: qua nửa đêm, task quá hạn, task cả ngày, task không có hạn.
- `src/features/TasksPage.test.tsx` — 4 test luồng UI: hiện giờ hạn, trì hoãn bằng preset (cập nhật bộ đếm + ghi lịch sử + badge), trì hoãn bằng số phút tùy chỉnh, chặn xác nhận khi nhập số không hợp lệ.
