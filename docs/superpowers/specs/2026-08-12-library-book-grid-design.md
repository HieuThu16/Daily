# Thiết kế: Lưới bìa sách trong Library

Ngày: 2026-08-12

## Mục tiêu

Thẻ sách trong Library đang nhồi quá nhiều thứ vào một hàng ngang và vỡ trên màn hẹp.
Đổi mục Books sang lưới bìa sách như kệ sách: ô bìa lớn, chữ nhỏ, chỉ giữ những thứ thật
sự cần nhìn thấy khi lướt. Mọi thứ còn lại đã có chỗ trong màn chi tiết.

## Phạm vi

Trong phạm vi:

- Lưới bìa cho mục Books, ở cả hai sub-tab "Tổng thể" và "Yêu thích".
- Ô bìa: ảnh bìa, tên, tác giả, chấm màu trạng thái, nút yêu thích.
- Thêm dropdown đổi trạng thái vào màn chi tiết sách.
- `BookCover` thêm cỡ `grid`.

Ngoài phạm vi:

- Tab "Tất cả thể loại" và bốn loại media còn lại — vẫn dạng dòng như hiện tại.
  Tab "Tất cả" sẽ thành báo cáo ở một spec riêng.
- Sắp xếp, lọc, tìm kiếm — giữ nguyên cơ chế đang có.
- Đổi kích thước ô bìa theo ý người dùng.

## Quyết định đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Kiểu hiển thị | Lưới bìa lớn, như kệ sách |
| Áp dụng cho loại nào | Chỉ `BOOK`. Bốn loại kia giữ dạng dòng |
| Lưới xuất hiện ở đâu | Chỉ khi `selectedType === 'BOOK'`. Tab "Tất cả" giữ dạng dòng |
| Thao tác còn lại trên ô bìa | Chấm màu trạng thái (chỉ để nhìn) + nút yêu thích |
| Đổi trạng thái | Vào màn chi tiết, nơi sẽ có dropdown mới |

## Bối cảnh hiện tại

`renderMediaRow` trong `src/features/LibraryPage.tsx` vẽ một thẻ chứa: ảnh bìa 40px, tên,
một dòng meta gộp (`📖 Đọc · tác giả · Chương N · 12/07 → 20/08`), chip tiến độ, nút nghe,
dropdown trạng thái, nút tim, nút bút chì, rồi một hàng thứ hai với nút Đọc / Ghi trang /
Lịch sử. Tất cả nằm trong một `flex` có `overflow: hidden`, nên màn hẹp là vỡ.

Hai chỗ gọi `.map(renderMediaRow)`: dòng 1046 (Tổng thể) và 1071 (Yêu thích).

Đã có sẵn từ feature ảnh bìa:

- `src/features/library/BookCover.tsx` — `<BookCover url alt size />`, tự rơi về
  placeholder khi thiếu ảnh hoặc ảnh lỗi.
- `src/features/library/BookDetailView.tsx` — màn chi tiết, đã có Đọc tiếp, Chỉnh sửa,
  đổi/xoá bìa, mục lục, thông tin.

## Kiến trúc

### Cây file

```
src/features/library/
  BookGrid.tsx          MỚI  Lưới bìa + ô bìa  + BookGrid.test.tsx
  BookCover.tsx         SỬA  thêm cỡ 'grid'
  BookDetailView.tsx    SỬA  thêm dropdown trạng thái  (+ test)

src/features/
  LibraryPage.tsx       SỬA  nhánh render lưới, truyền callback  (+ test)

src/styles.css          SỬA  .book-grid-*
```

### `BookGrid.tsx`

```tsx
type BookGridProps = {
  items: Media[]
  onOpen: (item: Media) => void
  onToggleFavorite: (item: Media) => void
}
```

Không tự query gì, không giữ state — mọi dữ liệu và hành vi đến từ `LibraryPage`, giống
cách `LibraryAudioAction` đang làm. State duy nhất trong lưới là cờ ảnh lỗi, và nó đã nằm
sẵn trong `BookCover`.

### Một ô bìa

```
┌─────────┐
│▓▓▓▓▓▓▓♡│   nút tim, position: absolute, đè góc trên phải
│▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓│   nút bìa phủ toàn ô, mở màn chi tiết
└─────────┘
● Đắc Nhân Tâm     tên, tối đa 2 dòng
  Dale Carnegie    tác giả, 1 dòng, ellipsis
```

```tsx
<li className="book-grid-cell">
  <button className="book-grid-cover" onClick={…} aria-label={`Xem chi tiết ${name}, ${statusLabel}`}>
    <BookCover url={item.cover_url} alt="" size="grid" />
  </button>
  <button className="book-grid-fav" onClick={…} aria-label={…} aria-pressed={item.is_favorite}>
    <Heart …/>
  </button>
  <p className="book-grid-title"><span className="book-grid-dot" data-status={item.status} aria-hidden="true" />{item.name}</p>
  <p className="book-grid-author">{item.author || 'Chưa rõ tác giả'}</p>
</li>
```

**Hai nút là anh em, không lồng nhau.** Nút tim nằm ngoài nút bìa và đè lên bằng
`position: absolute`. Lồng nút vào nút là HTML không hợp lệ và là đúng lỗi ARIA vừa phải
sửa ở thẻ dạng dòng — không lặp lại.

`alt=""` trên `BookCover` là cố ý: tên sách đã nằm trong `aria-label` của nút bao ngoài,
để `alt` nữa thì screen reader đọc hai lần.

### Chấm trạng thái

| Trạng thái | Màu | Nhãn dùng trong `aria-label` |
|---|---|---|
| `PLANNED` | `--text-muted` | sẽ đọc / sẽ nghe |
| `IN_PROGRESS` | `--purple` | đang đọc / đang nghe |
| `COMPLETED` | `--emerald` | đã đọc / đã nghe |

Chấm màu là thông tin chỉ truyền bằng màu sắc, nên nó `aria-hidden` và nhãn chữ tương ứng
được ghép vào `aria-label` của nút bìa. Người mù màu và người dùng screen reader vẫn nắm
được trạng thái.

Nhãn đọc/nghe chọn theo `item.book_format`, dùng lại đúng bảng nhãn đã có trong
`BookDetailView`.

### Lưới

```css
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 14px 10px;
}
.book-grid-cover { aspect-ratio: 2 / 3; }
```

`auto-fill` cho 3 cột trên điện thoại hẹp và tự giãn trên màn rộng, không cần media query
riêng. Tên sách `-webkit-line-clamp: 2`, tác giả một dòng `text-overflow: ellipsis`.

### `BookCover` thêm cỡ `grid`

`size: 'thumb' | 'grid' | 'large'`. Cỡ icon placeholder: 19 / 28 / 34. `.book-cover-grid`
lấp đầy ô chứa (`width/height: 100%`), để `aspect-ratio` do `.book-grid-cover` quyết định.

### Dropdown trạng thái ở màn chi tiết

Bỏ dropdown khỏi thẻ thì không còn cách đổi trạng thái nhanh — phải mở chi tiết rồi mở
tiếp modal Sửa. Nên `BookDetailView` nhận thêm một prop:

```ts
onStatusChange: (item: Media, status: Media['status']) => void
```

và thay badge trạng thái tĩnh trong khối `library-book-badges` bằng một `<select>` cùng
kiểu dáng, ba lựa chọn Sẽ đọc / Đang đọc / Đã đọc (hoặc nghe, theo `book_format`).
`LibraryPage` nối nó vào `patchStatusOrFavorite` đã có — hàm đó cũng tự gán `end_date` khi
chuyển sang COMPLETED, nên hành vi khớp với dropdown cũ trên thẻ.

### Thay đổi ở `LibraryPage`

Giữ nguyên nguyên tắc không dồn logic vào file 1800 dòng này.

1. Sub-tab "Tổng thể" (dòng 1046) và "Yêu thích" (dòng 1071): khi
   `selectedType === 'BOOK'` thì render `<BookGrid …/>` thay cho `.map(renderMediaRow)`.
2. `onOpen` → `setSelectedBookItemId(item.id)`; `onToggleFavorite` →
   `patchStatusOrFavorite(item.id, { is_favorite: !item.is_favorite })`. Cả hai đã tồn tại.
3. Truyền `onStatusChange` xuống `BookDetailView`.

`renderMediaRow` **không đổi**. Sách vẫn vẽ dạng dòng ở tab "Tất cả" cho tới khi spec báo
cáo thay tab đó; lúc ấy nhánh sách trong `renderMediaRow` thành code chết và sẽ được dọn
trong spec đó, không phải ở đây.

## Xử lý lỗi

| Tình huống | Phản hồi |
|---|---|
| Sách không có ảnh bìa | `BookCover` hiện placeholder 📖 nền tím, ô vẫn đúng tỉ lệ |
| Ảnh bìa tải lỗi | `BookCover` tự rơi về placeholder, đã có sẵn |
| Không có sách nào | Dùng component `Empty` sẵn có, không vẽ lưới rỗng |
| Đổi trạng thái lỗi | `patchStatusOrFavorite` đã tự xử lý, không đổi hành vi |

## Kiểm thử

`src/features/library/BookGrid.test.tsx`:

- Vẽ đúng một ô cho mỗi sách, mỗi ô có nút mở chi tiết và nút yêu thích.
- `aria-label` của nút bìa chứa cả tên sách lẫn nhãn trạng thái bằng chữ.
- Bấm ô bìa gọi `onOpen` với đúng item.
- Bấm tim gọi `onToggleFavorite` và **không** gọi `onOpen` — hai nút phải độc lập.
- `aria-pressed` của nút tim phản ánh `is_favorite`.
- Sách `LISTEN` dùng nhãn "đang nghe" thay vì "đang đọc".
- Sách không có tác giả hiện "Chưa rõ tác giả".

`src/features/library/BookDetailView.test.tsx` (thêm vào file đã có):

- Đổi giá trị dropdown trạng thái gọi `onStatusChange` với item và trạng thái mới.
- Sách `LISTEN` hiện nhãn nghe trong dropdown.

`src/features/LibraryPage.test.tsx` (thêm vào file đã có):

- Chọn thể loại Books thì hiện lưới, không còn thẻ dạng dòng.
- Ở tab "Tất cả" sách vẫn vẽ dạng dòng.
- Bấm một ô bìa trong lưới mở màn chi tiết.

Kiểm thử tay: xem trên màn hẹp (360px) rằng lưới ra 3 cột và không có thanh cuộn ngang;
kiểm tra sách chưa có bìa nhìn vẫn ổn cạnh sách có bìa.
