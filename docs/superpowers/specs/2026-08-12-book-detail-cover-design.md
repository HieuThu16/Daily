# Thiết kế: Màn chi tiết sách và ảnh bìa tự động

Ngày: 2026-08-12

## Mục tiêu

Ở mục **Books** của Library, bấm vào một thẻ sách thì mở màn chi tiết: ảnh bìa, mục lục,
và thông tin sách. Khi nhập file PDF hoặc EPUB, app tự lấy ảnh làm bìa mà không cần
người dùng làm gì thêm.

## Phạm vi

Trong phạm vi:

- Màn chi tiết cho **mọi** item type `BOOK`, kể cả sách nhập tay chưa có file.
- Ảnh bìa tự động: PDF render trang 1, EPUB lấy ảnh bìa khai báo trong file.
- Đổi và xoá ảnh bìa bằng tay ở màn chi tiết.
- Ảnh bìa nhỏ thay icon trên thẻ sách ngoài danh sách Library.
- Mục lục bấm được, nhảy thẳng tới chương trong màn đọc.

Ngoài phạm vi:

- Màn chi tiết cho Movie / Manga / YouTube. Music đã có `LibraryAudioDetail` riêng.
- Tải ảnh bìa từ internet theo tên sách (Google Books, OpenLibrary).
- Cắt / xoay / chỉnh ảnh bìa trong app.
- Sinh ảnh bìa cho sách đã nhập từ trước — file gốc không còn, chỉ đổi tay được.

## Quyết định đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Màn chi tiết cho sách nào | Mọi item `BOOK`, sách nhập tay hiện empty state ở phần mục lục |
| Kiến trúc màn hình | Component inline trong LibraryPage, theo pattern `LibraryAudioDetail` |
| Lưu ảnh bìa | Supabase Storage bucket public `book-covers`, DB giữ URL |
| Cột `cover_url` đặt ở đâu | `media_items`, vì sách nhập tay không có dòng `book_documents` |
| Nguồn ảnh bìa | Tự động từ PDF/EPUB, cộng nút đổi tay |
| Bấm 1 lần vào thẻ | Vào chi tiết luôn |
| Ảnh bìa trên thẻ danh sách | Có, thay icon 📖 khi sách đã có bìa |

## Bối cảnh hiện tại

- Thẻ sách nằm trong `renderMediaRow` ở `src/features/LibraryPage.tsx` (~1735 dòng).
  Bấm vào thân thẻ hiện **không** làm gì; chỉ các nút con phản hồi.
- Đã có tiền lệ màn chi tiết inline: `LibraryAudioDetail` trong
  `src/features/library/LibraryAudioView.tsx`, LibraryPage render nó thay danh sách khi
  `selectedAudioItemId` khác null.
- Mục lục đã có sẵn: `loadChapterList(documentId)` trả `BookChapterMeta[]` không kèm
  cột `content`.
- `useQuery<Media>('media_items')` trả `{ items, setItems }`, nên cập nhật `cover_url`
  tại chỗ sau khi upload là được, không cần refetch.
- Bucket `media-audio` là tiền lệ Storage duy nhất, nhưng nó do Edge Function ghi bằng
  service role nên migration chỉ có policy đọc.
- `index.html` chưa set `touch-action`, và app không khoá zoom.

## Cây file

```
src/lib/book/
  cover.ts              MỚI  canvasToJpeg, blobToCover — hàm thuần  + cover.test.ts
  types.ts              SỬA  RawBook thêm `cover: Blob | null`
  pdfExtract.ts         SỬA  renderCover(doc) — render trang 1
  epubExtract.ts        SỬA  findCover(zip, opfPath, opf)
  repository.ts         SỬA  uploadCover, saveCoverUrl, removeCover

src/features/library/
  BookCover.tsx         MỚI  Ảnh bìa + fallback, hai cỡ
  BookDetailView.tsx    MỚI  Màn chi tiết  + BookDetailView.test.tsx
  BookImportModal.tsx   SỬA  Xem trước bìa, upload sau khi lưu
  BookReaderPage.tsx    SỬA  Đọc ?chapter=

src/features/
  LibraryPage.tsx       SỬA  State + nhánh render + vùng bấm trên thẻ  (+ LibraryPage.test.tsx)

src/types/index.ts      SỬA  Media thêm cover_url
src/styles.css          SỬA  .library-book-detail*, .book-cover*
DATABASE_SCHEMA.sql     SỬA  cover_url + bucket book-covers
supabase/migrations/20260814010000_book_covers.sql   MỚI
```

## Cơ sở dữ liệu và lưu trữ

Migration mới: `supabase/migrations/20260814010000_book_covers.sql`.

```sql
alter table public.media_items add column if not exists cover_url text;

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true) on conflict (id) do nothing;
```

Cộng 4 policy trên `storage.objects`, mỗi cái bọc trong khối
`do $$ begin ... exception when duplicate_object then null; end $$;` đúng như migration
`media_audio_storage` đang làm:

- `select`: `bucket_id = 'book-covers'` — công khai, để `<img src>` tải được.
- `insert`, `update`, `delete`: `bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text`.

Ba policy ghi là bắt buộc vì trình duyệt của người dùng upload trực tiếp, khác
`media-audio`.

Cập nhật kèm theo:

- `DATABASE_SCHEMA.sql`: thêm `cover_url` vào khối `media_items` và ghi chú bucket mới.
- `src/types/index.ts`: `Media` thêm `cover_url?: string | null`.

### Quy ước file trong bucket

- Đường dẫn: `<user_id>/<media_item_id>.jpg`, upload với `upsert: true`.
- URL lưu vào DB kèm query cache-buster: `<publicUrl>?v=<Date.now()>`. Không có nó thì
  đổi ảnh xong trình duyệt vẫn hiện ảnh cũ vì đường dẫn không đổi.
- Xoá sách không xoá file trong bucket. Library dùng soft-delete nên không có cascade,
  và một file JPEG mồ côi ~100KB không đáng để dựng cơ chế dọn dẹp ở v1.

## Bóc tách ảnh bìa

### `src/lib/book/cover.ts` (file mới)

Hàm thuần trên canvas/blob. **Không** import `supabase`, **không** import `pdfjs` —
giữ đúng ranh giới module mà spec book reader đã đặt.

```ts
export const COVER_MAX_WIDTH = 600
export const COVER_QUALITY = 0.8

/** Canvas đã đúng kích thước -> JPEG. pdfExtract dùng. */
export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null>

/** Giải mã blob ảnh, thu nhỏ về COVER_MAX_WIDTH, xuất JPEG.
 *  epubExtract và luồng đổi ảnh tay dùng. Trả null nếu không giải mã được. */
export function blobToCover(blob: Blob): Promise<Blob | null>
```

`blobToCover` dùng `createImageBitmap` để giải mã, vẽ vào canvas ở kích thước đã tính,
rồi `toBlob('image/jpeg', 0.8)`. Ảnh hẹp hơn 600px thì giữ nguyên kích thước gốc, không
phóng to. Cả hai hàm set `canvas.width = canvas.height = 0` sau khi dùng để iOS Safari
nhả bộ nhớ, và `bitmap.close()` khi xong.

Ảnh kết quả cỡ 60–120KB, đủ nét cho cả thẻ 40px lẫn ô bìa 120px ở màn chi tiết.

### Kiểu dữ liệu

`RawBook` trong `src/lib/book/types.ts` thêm một trường:

```ts
cover: Blob | null
```

### PDF (`pdfExtract.ts`)

Thêm hàm `renderCover(doc)`, gọi ngay sau khi mở tài liệu và sau khi đã qua bước phát
hiện bản scan:

1. `page = await doc.getPage(1)`.
2. `base = page.getViewport({ scale: 1 })`, `scale = min(1, COVER_MAX_WIDTH / base.width)`.
   Chặn trên bằng 1 để không phóng to trang nhỏ thành ảnh mờ.
3. Render vào canvas 2D ở viewport đã scale, rồi `canvasToJpeg`.
4. Lỗi bất kỳ ở bước này trả `null`, không ném — thiếu bìa không được làm hỏng lần nhập.

Chỉ một trang nên không thêm phase vào `ExtractProgress`.

### EPUB (`epubExtract.ts`)

Thêm hàm `findCover(zip, opfPath, opf)`, dùng lại `resolvePath` và cách đọc manifest đã
có trong file. Thứ tự tìm, dừng ở cái đầu tiên ra kết quả:

1. `<meta name="cover" content="ID">` trong OPF, tra `ID` trong manifest, lấy `href`.
2. Manifest item có `properties` chứa `cover-image` (EPUB 3).
3. Ảnh đầu tiên (`img[src]` hoặc `image[xlink:href]`) trong file spine đầu tiên,
   resolve tương đối theo thư mục của file đó.
4. Entry bất kỳ trong zip khớp `/(^|\/)cover\.(jpe?g|png|webp)$/i`.

Lấy được thì `zip.file(path).async('blob')` rồi qua `blobToCover`. Không có thì `null`.

### `repository.ts`

Vẫn là nơi duy nhất chạm Supabase của feature. Thêm:

```ts
uploadCover(mediaItemId: string, blob: Blob): Promise<string>   // trả public URL kèm ?v=
saveCoverUrl(mediaItemId: string, url: string | null): Promise<void>
removeCover(mediaItemId: string): Promise<void>                 // xoá file + set cover_url null
```

`uploadCover` cần `user_id` cho đường dẫn; lấy bằng `supabase.auth.getUser()`.

### Luồng nhập sách (`BookImportModal.tsx`)

- Màn xem trước hiện ảnh bìa cạnh tên sách, nguồn ảnh là
  `URL.createObjectURL(book.cover)`. Revoke URL khi đổi file hoặc unmount.
- Không có bìa thì hiện ô placeholder chữ *"Không tìm thấy ảnh bìa trong file"*, kèm câu
  *"Đổi được ở màn chi tiết sách"*. Không chặn lưu.
- Lưu: sau khi `saveBook()` thành công mới upload bìa, rồi `saveCoverUrl`.
- Upload bìa lỗi **không** làm hỏng lần nhập: sách đã vào, chỉ toast cảnh báo
  *"Đã nhập sách nhưng chưa lưu được ảnh bìa"*. Callback báo về LibraryPage vẫn chạy.

## Màn chi tiết

### `src/features/library/BookDetailView.tsx` (file mới)

```
← Quay lại
┌──────┐  Đắc Nhân Tâm
│      │  Dale Carnegie
│ bìa  │  📖 Đọc · Đang đọc · ♥
│      │  [Đổi ảnh bìa] [Xoá bìa]
└──────┘
▓▓▓▓▓▓░░░░░░░░ 42%   Chương 3/24 · trang 88/210
[ 📖 Đọc tiếp ]  [ ✏️ Sửa ]

── Thông tin ────────────────
Nguồn        PDF · dacnhantam.pdf
Số chương    24
Số chữ       412.000
Số trang     210
Bắt đầu      12/07/2026
Đọc lần cuối Hôm nay 21:30

── Mục lục (24) ─────────────
   1. Lời nói đầu         4 tr
   2. Chương 1 · Nếu…     9 tr
 ▸ 3. Chương 2 · Bí mật… 11 tr
```

Props:

```ts
type BookDetailViewProps = {
  item: Media
  onBack: () => void
  onEdit: (item: Media) => void
  onCoverChange: (mediaItemId: string, coverUrl: string | null) => void
}
```

Điều hướng sang màn đọc dùng `useNavigate` ngay trong component, không nhận qua props —
LibraryPage đã có `nav` nhưng truyền xuống chỉ để gọi lại là thừa.

### Trạng thái

Ba trạng thái sau khi mount:

| Trạng thái | Hiển thị |
|---|---|
| `loading` | Skeleton cho khối tiến độ và mục lục. Header (bìa, tên, tác giả) hiện ngay vì lấy từ `item` đã có sẵn |
| `ready` | Đủ như hình trên |
| `no-document` | Ẩn khối tiến độ và nút Đọc tiếp. Khối Thông tin rút còn tác giả, ngày bắt đầu/kết thúc, `current_chapter`. Mục lục thay bằng empty state |

`no-document` là sách nhập tay. Empty state: *"Chưa nhập file cho sách này. Dùng nút
Nhập sách ở Library để đọc ngay trong app."* Ô ảnh bìa vẫn đổi được bình thường.

Nạp lỗi (mất mạng) cũng rơi vào `no-document` kèm dòng lỗi nhỏ và nút *"Thử lại"*, để
người dùng phân biệt được với sách thật sự chưa nhập file.

### Nạp dữ liệu

`useEffect` theo `item.id`: `loadBookDocument(item.id)` → nếu có thì `loadChapterList(doc.id)`.
Cả hai đã tồn tại. Dùng cờ `cancelled` để không set state sau unmount, giống pattern ở
`BookReaderPage`.

Nhật ký đọc gần nhất không query lại — LibraryPage đã có `bookReadingLogsQuery`, nhưng
để component tự lập, dòng *"Đọc lần cuối"* lấy từ `book_documents.last_read_at` chứ
không từ bảng log.

### Số trang mỗi chương

```ts
chapterPages(chapter, doc) =
  doc.page_count && doc.total_chars > 0
    ? max(1, round(chapter.char_count / doc.total_chars * doc.page_count))
    : max(1, round(chapter.char_count / CHARS_PER_PAGE))
```

`CHARS_PER_PAGE` export sẵn ở `repository.ts`.

### Đổi ảnh bìa

Nút *"Đổi ảnh bìa"* mở `<input type="file" accept="image/*">` ẩn. Luồng:
`blobToCover(file)` → `uploadCover` → `saveCoverUrl` → gọi `onCoverChange` để LibraryPage
`setItems` cập nhật tại chỗ. Trong lúc chạy, nút hiện trạng thái *"Đang lưu…"* và bị khoá.

Nút *"Xoá bìa"* chỉ hiện khi `item.cover_url` khác null, gọi `removeCover` rồi
`onCoverChange(id, null)`.

Ảnh lớn hơn 15MB bị từ chối trước khi giải mã, tránh treo tab trên điện thoại.

### Mục lục

Mỗi dòng là một `<button>`: số thứ tự, tiêu đề, số trang ước tính. Chương đang đọc
(`idx === doc.last_chapter_idx`) được tô nổi và có `aria-current="true"`.

Bấm → `nav('/read/<id>?chapter=<idx>')`.

### Sửa kèm theo ở `BookReaderPage.tsx`

Hiện tại màn đọc luôn mở ở `doc.last_chapter_idx`. Thêm đọc `?chapter=` qua
`useSearchParams`:

```ts
const requested = Number(searchParams.get('chapter'))
const startIdx = Number.isInteger(requested) && requested >= 0 ? requested : doc.last_chapter_idx
setActiveIdx(Math.min(startIdx, Math.max(0, list.length - 1)))
```

Khi có `?chapter=`, bỏ qua `last_scroll_ratio` (đặt `pendingRatio.current = 0`) — người
dùng chủ động chọn chương thì phải vào đầu chương, không phải giữa chương cũ. Toast
*"Tiếp tục từ…"* cũng không hiện trong trường hợp này.

## Thay đổi ở LibraryPage

Giữ nguyên nguyên tắc của spec book reader: không dồn thêm logic vào file 1735 dòng này.

1. State mới: `const [selectedBookItemId, setSelectedBookItemId] = useState<string | null>(null)`.
2. Nhánh render sớm, đặt ngay cạnh nhánh `selectedAudioItem` đã có:

```tsx
const selectedBookItem = items.find((i) => i.id === selectedBookItemId) ?? null
if (selectedBookItem) return <BookDetailView … />
```

3. Trong `renderMediaRow`, khi `isBook`: bọc `library-media-main` thành vùng bấm được —
   `onClick`, `role="button"`, `tabIndex={0}`, `onKeyDown` cho Enter và Space,
   `aria-label={'Xem chi tiết ' + item.name}`.
4. Thêm `onClick={(e) => e.stopPropagation()}` lên đúng một chỗ: div
   `library-media-actions`. Mọi nút và select đều nằm trong đó, nên một dòng là đủ, không
   phải rải `stopPropagation` lên từng nút. Hàng `library-book-actions` nằm ngoài
   `library-media-main` nên không bị ảnh hưởng.
5. Icon thẻ: khi `isBook` thì `library-media-icon` render `<BookCover>` thay cho `<Icon>`.
6. Handler `onCoverChange` gọi `setItems` cập nhật `cover_url` của đúng một dòng.

### `src/features/library/BookCover.tsx` (file mới)

`renderMediaRow` là một hàm thường bên trong `LibraryPage`, **không** phải component, nên
không đặt hook vào đó được. Fallback khi ảnh tải lỗi cần state, nên tách thành component
riêng — dùng chung cho cả thẻ danh sách lẫn ô bìa lớn ở màn chi tiết:

```tsx
type BookCoverProps = {
  url: string | null | undefined
  alt: string
  size: 'thumb' | 'large'   // 40px vuông trên thẻ, 120px tỉ lệ 2:3 ở chi tiết
}
```

Không có `url`, hoặc `<img>` bắn `onError`, thì render placeholder icon 📖 trên nền
`--purple-bg`. State `failed` reset theo `url` để đổi bìa xong ảnh mới được thử lại.

### CSS (`src/styles.css`)

Thêm cụm `.library-book-detail*` theo đúng cách đặt tên của `.library-audio-detail*` đã
có, và:

- `.library-media-card` khi là sách: `cursor: pointer` và `touch-action: manipulation`.
  Vế thứ hai chặn double-tap-to-zoom của trình duyệt trên thẻ, vì app không khoá zoom
  toàn trang.
- `.book-cover-thumb`: lấp đầy ô 40px của `library-media-icon`, `object-fit: cover`,
  bo góc theo khối cha. Bản mobile ở media query đã có sẵn thu về 34px.
- `.book-cover-large`: rộng 120px, tỉ lệ 2:3, `object-fit: cover`, bo góc 12px.
- `.book-cover-placeholder`: nền `--purple-bg`, màu `--purple`, icon 📖 canh giữa, dùng
  chung cho cả hai cỡ.

## Xử lý lỗi

| Tình huống | Phản hồi |
|---|---|
| PDF render bìa lỗi | `cover: null`, nhập sách vẫn chạy bình thường |
| EPUB không tìm thấy ảnh bìa | `cover: null`, modal ghi *"Không tìm thấy ảnh bìa trong file"* |
| Upload bìa lỗi lúc nhập sách | Toast *"Đã nhập sách nhưng chưa lưu được ảnh bìa"*, sách vẫn vào |
| Đổi ảnh bìa: file không phải ảnh, hoặc giải mã lỗi | *"File này không phải ảnh hợp lệ"*, không đụng tới bìa cũ |
| Đổi ảnh bìa: file lớn hơn 15MB | *"Ảnh quá lớn (tối đa 15MB)"*, chặn trước khi giải mã |
| Đổi ảnh bìa: upload lỗi | *"Không lưu được ảnh bìa, thử lại sau"*, giữ nguyên bìa cũ |
| `<img>` bìa trên thẻ tải lỗi | Fallback về icon 📖, im lặng |
| Nạp `book_documents` lỗi | Màn chi tiết vào nhánh `no-document` kèm nút *"Thử lại"* |
| Mở `/read/:id?chapter=999` | Kẹp về chương cuối, không lỗi |

## Kiểm thử

Vitest + Testing Library đã có sẵn, chạy bằng `npm test`.

`src/lib/book/cover.test.ts`:

- `blobToCover` thu ảnh 1200px về đúng 600px, giữ tỉ lệ.
- `blobToCover` giữ nguyên kích thước ảnh hẹp hơn 600px, không phóng to.
- `blobToCover` trả `null` khi blob không giải mã được.
- Kết quả luôn có `type === 'image/jpeg'`.

jsdom không có `createImageBitmap` và `canvas.toBlob` thật, nên test stub hai API này
trên `globalThis` và khẳng định trên tham số được truyền vào (kích thước canvas, mime,
quality) thay vì trên nội dung ảnh.

`src/features/library/BookDetailView.test.tsx`:

- Sách có tài liệu: hiện đủ số chương, số chữ, phần trăm, và danh sách chương.
- Chương đang đọc có `aria-current="true"`.
- Bấm một chương gọi navigate tới `/read/<id>?chapter=<idx>`.
- Sách không có tài liệu: hiện empty state, không hiện nút *"Đọc tiếp"*.
- Chọn file không phải ảnh thì hiện thông báo lỗi và không gọi `onCoverChange`.

`src/features/library/BookCover.test.tsx`:

- Có `url` thì render `<img>` đúng `src`; không có thì render placeholder.
- `<img>` bắn `onError` thì chuyển sang placeholder.
- Đổi `url` sau khi lỗi thì thử render `<img>` lại, không kẹt ở placeholder.

`src/features/LibraryPage.test.tsx` (thêm vào file đã có):

- Bấm thân thẻ sách mở màn chi tiết.
- Bấm nút Sửa trên thẻ **không** mở màn chi tiết — kiểm chứng `stopPropagation`.
- Nhấn Enter khi thẻ đang focus mở màn chi tiết.

Kiểm thử tay: nhập một PDF và một EPUB thật, xác nhận bìa hiện đúng ở modal xem trước,
ở thẻ danh sách, và ở màn chi tiết; đổi bìa bằng ảnh chụp từ điện thoại; bấm một chương
giữa mục lục và kiểm tra màn đọc mở đúng chương từ đầu chương.
