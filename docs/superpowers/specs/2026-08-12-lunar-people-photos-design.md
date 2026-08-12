# Lịch âm cho dịp, sinh nhật & SĐT cho người, ảnh trong nhật ký

Ngày: 2026-08-12

## Mục tiêu

1. Dịp (sinh nhật / kỉ niệm) có thể lặp theo **lịch âm** thay vì dương.
2. Form "Người" nhập được **sinh nhật (âm/dương)** và **số điện thoại**.
3. Nhật ký trong trang chi tiết người đính kèm được **nhiều ảnh**, upload lên Supabase Storage.

## 1. Lõi âm lịch — `src/lib/lunar.ts`

Thuật toán Hồ Ngọc Đức, múi giờ cố định +7 (âm lịch Việt Nam). Không thêm dependency.

```ts
type LunarDate = { day: number; month: number; year: number; isLeap: boolean }
solarToLunar(date: Date): LunarDate
lunarToSolar(day, month, year, isLeap): Date
formatLunar(l: LunarDate): string   // "29/6 âm" | "29/6 nhuận âm"
```

Test (`lunar.test.ts`): Tết 2026, mốc đối xứng solar→lunar→solar, một năm có tháng nhuận.

## 2. Dữ liệu

- `person_occasions.calendar text not null default 'SOLAR'` — `'SOLAR' | 'LUNAR'`.
  `occasion_date` **luôn** là ngày dương của lần diễn ra gốc. `calendar='LUNAR'` nghĩa là
  "lặp lại theo ngày âm tương ứng của ngày gốc". Dữ liệu cũ không đổi.
- `people.phone text`.
- Bảng mới `person_daily_photos (id, user_id, person_id, log_date, url, storage_path, created_at)`,
  khoá theo `(person_id, log_date)` để thêm ảnh được cả khi chưa có chữ.
- Bucket Storage `person-photos`, public read, ghi theo RLS mặc định của authenticated.

## 3. Đếm ngược — `src/lib/occasions.ts`

`nextOccurrence()` rẽ nhánh khi `calendar === 'LUNAR'`:
đổi ngày gốc sang âm → dựng ngày âm đó ở năm âm hiện tại → nếu đã qua thì năm âm kế tiếp →
đổi ngược ra dương. Hai ca biên:

- ngày 30 rơi vào tháng thiếu → lùi về 29;
- tháng nhuận → luôn dùng tháng thường (mỗi năm đều có).

`ageOnNext()` tính theo hiệu năm âm khi dịp là âm. Card "Sắp tới" ở Trang chủ hưởng tự động.

## 4. Form dịp — `OccasionsSection.tsx`

Nút gạt **Dương / Âm**; dưới ô ngày hiện dòng phụ ngày tương ứng bên kia
("12/08/2026 · 29/6 âm"). Dòng dịp trong danh sách gắn chip "âm" khi `calendar='LUNAR'`.

## 5. Người

- Form thêm người mở rộng: tên, SĐT, ngày sinh + gạt Dương/Âm. Lưu xong ghi thêm một dịp
  `BIRTHDAY` gắn với người đó (dùng lại `addOccasion`), nên không có dữ liệu trùng.
- `PersonDetail` hiện số điện thoại dạng link `tel:`.

## 6. Ảnh nhật ký — `PersonDetail.tsx`

Nút "Thêm ảnh" (`input type=file multiple accept=image/*`) → upload từng file lên
`person-photos/{person_id}/{log_date}/{uuid}.{ext}` → lưu hàng vào `person_daily_photos` →
hiện lưới thumbnail; bấm thumbnail mở ảnh to (Modal), có nút xoá (xoá cả file trong bucket).
Khi chưa cấu hình Supabase, nút ảnh bị vô hiệu kèm chú thích.

## 7. Migration

`supabase/migrations/20260816000000_lunar_phone_person_photos.sql`, idempotent, và đồng bộ
vào `DATABASE_SCHEMA.sql`.
