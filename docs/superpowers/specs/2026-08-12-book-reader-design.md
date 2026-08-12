# Thiết kế: Nhập sách PDF/EPUB và đọc trong app

Ngày: 2026-08-12

## Mục tiêu

Trong mục **Books** của Library, thêm nút nhập file PDF hoặc EPUB. App bóc tách file
thành văn bản sạch (chỉ chữ), chia chương và dựng mục lục, cho đọc ngay trong app với
giao diện gọn gàng, và lưu tiến độ đọc vào Supabase.

## Phạm vi

Trong phạm vi:

- Nhập file PDF và EPUB, bóc tách ngay trên trình duyệt.
- Làm sạch văn bản: gỡ header/footer, số trang, gạch nối cuối dòng, gộp đoạn.
- Chia chương tự động, cho người dùng sửa mục lục trước khi lưu.
- Màn hình đọc toàn màn hình: mục lục, cỡ chữ, nền sáng/sepia/tối.
- Lưu vị trí đọc và tự ghi nhật ký đọc theo ngày vào bảng sẵn có.

Ngoài phạm vi (v1):

- OCR cho PDF bản scan. App phát hiện và báo lỗi rõ ràng thay vì cố xử lý.
- Giữ lại file gốc. Chỉ lưu văn bản đã bóc tách.
- Highlight, ghi chú, bookmark trong lúc đọc.
- Đọc offline (cache nội dung sách vào thiết bị).
- Nhập các định dạng khác: MOBI, AZW3, DOCX, TXT.

## Quyết định đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Bóc tách ở đâu | Trình duyệt (`pdfjs-dist` + `jszip`), không dùng Edge Function |
| Sách import nằm ở đâu | Gắn vào mục Books sẵn có, mỗi sách là một dòng `media_items` type `BOOK` |
| Kiểu đọc | Cuộn liên tục theo từng chương |
| File gốc | Không lưu, chỉ lưu văn bản |
| PDF bản scan | Báo lỗi, không OCR |
| Tiến độ | Tự động ghi `book_reading_logs` theo ngày |
| Mục lục dò sai | Cho sửa ở màn hình xem trước, trước khi lưu |
| Lưu nội dung | Mỗi chương một dòng trong `book_chapters` |

## Bối cảnh hiện tại

- React 18 + Vite + TypeScript + Supabase, PWA, deploy trên Vercel.
- Mục Books nằm trong `src/features/LibraryPage.tsx` (~85KB, gộp chung 5 loại media).
  Feature mới **không** thêm code vào file này ngoài hai nút và state mở modal.
- `media_items` đã có `book_format` (`READ`/`LISTEN`), `current_chapter`,
  `start_date`, `end_date`, `status`.
- `book_reading_logs` lưu tiến độ đọc/nghe theo ngày, có `page`, `listen_hours`,
  `listen_minutes`, `note`.
- Đã có tiền lệ dùng Supabase Storage (bucket `media-audio`) và Edge Function.
- Repo đã có sẵn Vitest 4 + jsdom + Testing Library, script `npm test` / `npm run test:watch`,
  setup ở `src/test/setup.ts`. Test đặt cạnh file nguồn (`LibraryAudioView.test.tsx`).
- Đã có thư mục con `src/features/library/` (`LibraryAudioView.tsx`) — feature này đi
  theo cùng pattern đó thay vì tạo thư mục mới.

## Kiến trúc

### Cây file

```
src/lib/book/
  types.ts               RawBook, RawChapter, ExtractProgress
  pdfExtract.ts          File PDF  -> RawBook
  epubExtract.ts         File EPUB -> RawBook
  cleanText.ts           Làm sạch văn bản dùng chung (hàm thuần)  + cleanText.test.ts
  chapters.ts            Dò chương, tách chương dài, tính offset  + chapters.test.ts
  repository.ts          Mọi truy vấn Supabase của feature
  index.ts               extractBook(file, onProgress) — dispatch theo định dạng

src/features/library/          (thư mục đã có sẵn, thêm vào)
  BookChapterEditor.tsx        Danh sách chương sửa được  + BookChapterEditor.test.tsx
  BookImportModal.tsx          Chọn file -> tiến trình -> xem trước -> lưu
  BookReaderPage.tsx           Màn hình đọc
  useBookReadingProgress.ts    Khôi phục vị trí, auto-save, auto-ghi log ngày

supabase/migrations/20260813020000_book_documents.sql
```

Thư viện thêm: `pdfjs-dist`, `jszip`.

Toàn bộ `src/lib/book/` được nạp bằng `import()` động từ `ImportBookModal`, nên bundle
lần tải đầu của app không tăng.

### Ranh giới giữa các module

- `pdfExtract` / `epubExtract` nhận `File`, trả `RawBook`. Không biết gì về Supabase
  hay React.
- `cleanText` và `chapters` là hàm thuần: vào chuỗi/mảng, ra chuỗi/mảng. Đây là phần
  có unit test.
- `repository` là nơi duy nhất gọi `supabase` cho feature này. Component không gọi
  trực tiếp.
- `ImportBookModal` và `ReaderPage` không import lẫn nhau; giao tiếp qua route và DB.

### Kiểu dữ liệu trung gian

```ts
type RawChapter = {
  title: string
  content: string      // văn bản thuần, đoạn cách nhau bằng \n\n
}

type RawBook = {
  title: string
  author: string | null
  sourceFormat: 'PDF' | 'EPUB'
  sourceFilename: string
  pageCount: number | null   // số trang thật, chỉ PDF có
  chapters: RawChapter[]
}

type ExtractProgress = {
  phase: 'reading' | 'extracting' | 'cleaning' | 'splitting'
  current: number
  total: number
}
```

## Cơ sở dữ liệu

Migration mới: `supabase/migrations/20260813020000_book_documents.sql`.
Không thay đổi cấu trúc `media_items` và `book_reading_logs`.

### `book_documents`

Một dòng cho mỗi sách đã nhập, quan hệ 1:1 với `media_items`. Tiến độ đọc gộp luôn vào
bảng này thay vì tách bảng thứ ba, vì quan hệ là 1:1.

```sql
create table if not exists public.book_documents (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null default auth.uid() references auth.users(id),
  media_item_id     uuid        not null unique references public.media_items(id) on delete cascade,
  source_format     text        not null check (source_format in ('PDF', 'EPUB')),
  source_filename   text,
  total_chars       integer     not null default 0,
  page_count        integer,              -- số trang thật của PDF, null với EPUB
  est_pages         integer     not null default 1,
  chapter_count     integer     not null default 0,
  -- tiến độ đọc
  last_chapter_idx  integer     not null default 0,
  last_scroll_ratio real        not null default 0 check (last_scroll_ratio >= 0 and last_scroll_ratio <= 1),
  last_char_offset  integer     not null default 0,
  percent           real        not null default 0 check (percent >= 0 and percent <= 100),
  last_read_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

### `book_chapters`

```sql
create table if not exists public.book_chapters (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users(id),
  document_id  uuid        not null references public.book_documents(id) on delete cascade,
  idx          integer     not null,          -- thứ tự, bắt đầu từ 0
  title        text        not null,
  content      text        not null,
  char_count   integer     not null default 0,
  char_offset  integer     not null default 0, -- tổng ký tự của các chương trước
  created_at   timestamptz not null default now(),
  unique (document_id, idx)
);
```

Index: `book_chapters(document_id, idx)`.

Cả hai bảng bật RLS với policy `user_id = auth.uid()`, đúng pattern các bảng hiện có.
Cập nhật `DATABASE_SCHEMA.sql` và `src/types/index.ts` tương ứng.

**Hai bảng này cố tình không có `deleted_at`**, khác với các bảng còn lại của repo.
Chúng chứa nội dung dẫn xuất từ file gốc, không phải dữ liệu người dùng tự nhập, và
luôn nhập lại được. Soft-delete sẽ khiến `unique (media_item_id)` chặn lần nhập lại
tiếp theo, và giữ lại vài MB văn bản chết. Nên: xoá là xoá hẳn, `on delete cascade`
dọn `book_chapters` theo. Nhập lại cho một sách đã có tài liệu thì xoá dòng cũ trước.

Lưu ý: Library xoá `media_items` bằng soft-delete nên cascade không kích hoạt.
`book_documents` của sách đã xoá sẽ nằm lại nhưng không hiển thị ở đâu. Chấp nhận
trong v1; dọn dẹp là việc của một migration riêng sau này nếu cần.

### Sửa nhỏ đi kèm: upsert nhật ký đọc

`LibraryPage.tsx` (hàm `saveBookReadingLog`) gọi
`upsert(logData, { onConflict: 'media_item_id,log_date' })`, nhưng `book_reading_logs`
không có unique constraint trên cặp cột đó. Upsert luôn lỗi và rơi xuống nhánh insert
dự phòng, tạo dòng trùng mỗi lần ghi lại cùng một ngày.

Vì auto-log của feature này ghi vào cùng bảng, sửa cả hai chỗ sang cùng một cách:
tìm dòng của `(media_item_id, log_date)` chưa bị soft-delete, có thì `update`, không có
thì `insert`. Không thêm unique constraint để tránh đụng với soft-delete, và không đổi
hành vi hiện tại của người dùng.

## Luồng nhập sách

1. Ở mục Books, nút **"Nhập sách"** đứng cạnh nút **+**. Bấm vào mở file picker với
   `accept=".pdf,.epub,application/pdf,application/epub+zip"`.
2. Modal hiện thanh tiến trình theo `ExtractProgress`, ví dụ *"Đang xử lý trang 45/312"*.
   Vòng lặp bóc tách nhả luồng (`await new Promise(r => setTimeout(r, 0))`) mỗi 5 trang
   để UI không đơ.
3. Bóc tách (chi tiết ở mục dưới).
4. Màn hình xem trước trong cùng modal: tên sách, tác giả, định dạng, số chương,
   số chữ, số trang ước tính; danh sách chương cho **đổi tên**, **xoá** (nội dung gộp
   vào chương phía trên), **gộp lên**. Chương đầu tiên không cho xoá hay gộp lên.
5. Chọn đích: **tạo sách mới** trong Books (điền sẵn tên và tác giả từ metadata), hoặc
   **gắn vào một sách BOOK đã có** qua dropdown. Sách đã có `book_documents` không xuất
   hiện trong dropdown.
6. Lưu: insert `media_items` (nếu tạo mới) → insert `book_documents` → insert
   `book_chapters` theo lô 20 chương mỗi lần. Xong thì đóng modal, toast, và điều hướng
   thẳng sang màn hình đọc.

## Bóc tách và làm sạch văn bản

### PDF (`pdfExtract.ts`)

Dùng `pdfjs-dist`. Worker nạp qua `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`.

Mỗi trang, `getTextContent()` trả về các mảnh chữ kèm ma trận `transform`. Xử lý:

1. Nhóm mảnh thành dòng theo toạ độ y (sai lệch dưới 2pt coi là cùng dòng), trong dòng
   sắp theo x tăng dần. Ghi lại cỡ chữ lớn nhất của mỗi dòng để dùng cho việc dò tiêu đề.
2. Nối các mảnh cùng dòng, chèn dấu cách khi khoảng hở ngang lớn hơn nửa cỡ chữ.

Sau khi có toàn bộ dòng của mọi trang, `cleanText` xử lý:

3. **Header/footer lặp lại**: chuẩn hoá dòng đầu và dòng cuối của mỗi trang (bỏ chữ số,
   hạ chữ thường, gộp khoảng trắng). Dạng nào xuất hiện ở từ 30% số trang trở lên thì xoá.
   Chỉ áp dụng khi tài liệu có từ 5 trang.
4. **Số trang lẻ**: xoá dòng chỉ chứa số, hoặc dạng `- 12 -`, `Trang 12`, `Page 12`,
   hoặc số La Mã đứng một mình.
5. **Gạch nối cuối dòng**: dòng kết thúc bằng `-` hoặc `­` và dòng kế tiếp bắt đầu
   bằng chữ thường thì nối liền, bỏ dấu gạch.
6. **Gộp đoạn**: dòng không kết thúc bằng dấu kết câu (`.!?…:;"”'’)`) và dòng kế tiếp
   không bắt đầu bằng chữ hoa hay ký hiệu đầu mục thì nối bằng một dấu cách. Ngược lại
   là ngắt đoạn.
7. **Chuẩn hoá**: `normalize('NFC')` (bắt buộc với dấu tiếng Việt), thay ligature
   `ﬁ ﬂ ﬀ`, đổi dấu nháy cong về thẳng nếu lẫn lộn, xoá ký tự điều khiển, gộp từ 3 dòng
   trống trở lên thành 2.

**Phát hiện bản scan**: sau khi đọc 5 trang đầu, nếu trung bình dưới 100 ký tự mỗi trang
thì dừng và báo lỗi *"File này là bản scan (ảnh chụp), chưa hỗ trợ. Hãy dùng file PDF có
lớp văn bản hoặc file EPUB."*

### EPUB (`epubExtract.ts`)

Dùng `jszip` và `DOMParser` có sẵn của trình duyệt. Không dùng epub.js vì mục tiêu là
lấy văn bản thuần, không phải render lại sách.

1. Đọc `META-INF/container.xml` để tìm đường dẫn file OPF.
2. Từ OPF lấy `metadata` (title, creator), `manifest` và `spine`.
3. Đọc từng file XHTML theo thứ tự spine, parse bằng `DOMParser`.
4. Xoá `script`, `style`, `nav`, `header`, `footer`, `svg`. Lấy text theo khối:
   `h1`–`h6` thành dòng tiêu đề, `p`/`div`/`li`/`blockquote` thành đoạn, `br` thành
   xuống dòng.
5. Qua `cleanText` (bỏ qua bước header/footer và số trang vì EPUB không có).

### Chia chương (`chapters.ts`)

Thứ tự ưu tiên:

1. **PDF có bookmark**: `pdf.getOutline()` có kết quả thì resolve mỗi mục về chỉ số
   trang và cắt tại ranh giới trang đó. Chỉ lấy outline cấp 1.
2. **EPUB có TOC**: lấy từ `nav[epub:type=toc]` (EPUB 3) hoặc `toc.ncx` (EPUB 2).
   Mỗi file trong spine là một chương, tiêu đề lấy từ TOC. File spine không có mục TOC
   tương ứng thì gộp vào chương liền trước. Mục TOC trỏ vào giữa file (có `#fragment`)
   thì v1 bỏ qua fragment, vẫn tính cả file là một chương.
3. **Heuristic** khi không có outline/TOC, hoặc khi kết quả ra dưới 3 chương mà sách dài
   hơn 100.000 ký tự:
   - Dòng khớp `/^\s*(chương|chuong|phần|phan|chapter|part|mục|muc)\s+([0-9]+|[IVXLC]+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\b/i`.
   - Hoặc, với PDF, dòng ngắn dưới 80 ký tự, đứng riêng, có cỡ chữ từ 1.2 lần cỡ chữ
     phổ biến nhất trở lên.
4. **Không dò được gì**: cả sách là một chương tên *"Toàn bộ nội dung"*.

Sau khi chia, chương nào dài hơn 60.000 ký tự thì tự tách tại ranh giới đoạn gần nhất
thành *"<tên chương> — Phần 1"*, *"Phần 2"*… để trang đọc không phải render DOM quá lớn.

Cuối cùng tính `char_offset` tích luỹ cho từng chương.

## Màn hình đọc

Route `/read/:mediaItemId`, đăng ký **bên ngoài** `Shell` trong `Protected` để chiếm
trọn màn hình, không bị header và bottom nav che.

```
┌──────────────────────────────┐
│ ←  Đắc Nhân Tâm      ☰   Aa │  thanh trên, tự ẩn khi cuộn xuống
│ ━━━━━━━━━━━━──────── 42%     │  tiến độ toàn sách
├──────────────────────────────┤
│   Chương 3                   │
│   Không chỉ trích            │
│                              │
│   Ngày 7 tháng 5 năm 1931,   │  rộng tối đa ~68 ký tự
│   cả thành phố New York…     │  giãn dòng thoáng
│                              │
│  [ ‹ Chương trước ] 3/24 [ Chương sau › ]
└──────────────────────────────┘
```

- Mở màn hình: nạp `book_documents` và danh sách chương **không kèm cột `content`**
  (chỉ `id, idx, title, char_count, char_offset`), rồi nạp riêng `content` của chương
  đang đọc. Chuyển chương thì nạp `content` chương mới, giữ cache các chương đã nạp
  trong state.
- **Mục lục**: ngăn kéo trượt từ trái, làm nổi chương hiện tại, bấm để nhảy và cuộn lên đầu.
- **Aa**: cỡ chữ 14–24px, giãn dòng 1.5–2.1, font Sans hoặc Serif, nền Sáng / Sepia /
  Tối. Lưu ở `localStorage` qua `saveLocal`/`loadLocal` trong `src/lib/persistence.ts`.
  Đây là thiết lập theo thiết bị nên không cần vào DB.
- **Khôi phục**: mở lại sách thì nhảy về `last_chapter_idx` và cuộn tới
  `last_scroll_ratio`, kèm toast *"Tiếp tục từ Chương 3 · 42%"*.
- **Kết thúc**: cuộn hết chương cuối hiện thẻ *"Đã đọc xong"* với nút đánh dấu
  `status = COMPLETED`. Không tự đổi trạng thái.
- Sách chưa có `book_documents` thì route hiện thông báo và nút quay lại Library.

## Lưu tiến độ

| Thời điểm | Hành động |
|---|---|
| Ngừng cuộn 2 giây, hoặc `visibilitychange` sang ẩn, hoặc rời route | Ghi `book_documents`: `last_chapter_idx`, `last_scroll_ratio`, `last_char_offset`, `percent`, `last_read_at`. Chặn ghi dày hơn 10 giây một lần |
| Mở sách lần đầu | `media_items.status` chuyển `PLANNED` → `IN_PROGRESS` |
| Đã đọc tích luỹ từ 60 giây trong ngày | Ghi `book_reading_logs` của hôm nay, `page` = trang ước tính. Giá trị chỉ tăng, không bao giờ ghi đè bằng số nhỏ hơn |

Cách đếm 60 giây: một `setInterval` 5 giây cộng dồn thời gian, chỉ chạy khi màn hình đọc
đang mở và `document.visibilityState === 'visible'`. Bộ đếm reset khi rời màn hình.
Sau lần ghi log đầu tiên trong ngày, mỗi lần lưu vị trí kế tiếp cũng cập nhật lại `page`
nếu số trang ước tính đã tăng.

`percent = (char_offset của chương + scroll_ratio × char_count của chương) / total_chars × 100`.

Trang ước tính:

- PDF: `round(percent / 100 × page_count)`, dùng số trang thật của file.
- EPUB: `round(char_offset / 1800) + 1`. Đây là ước lượng, màn hình đọc ghi rõ
  *"trang ước tính"* để không gây nhầm với số trang sách giấy.

Lỗi khi lưu tiến độ không chặn việc đọc: log ra console, thử lại ở lần ghi kế tiếp.

## Xử lý lỗi

| Tình huống | Phản hồi |
|---|---|
| File lớn hơn 60MB | *"File quá lớn (tối đa 60MB)"*, không bắt đầu bóc tách |
| Đuôi/MIME không phải PDF hay EPUB | *"Chỉ hỗ trợ file PDF và EPUB"* |
| PDF có mật khẩu (`PasswordException`) | *"PDF này có mật khẩu, không mở được"* |
| PDF bản scan | *"File này là bản scan (ảnh chụp), chưa hỗ trợ"* |
| EPUB thiếu `container.xml` hoặc OPF | *"File EPUB không hợp lệ hoặc đã hỏng"* |
| Bóc tách xong nhưng tổng dưới 500 ký tự | *"Không lấy được nội dung từ file này"* |
| Insert Supabase lỗi | Giữ `RawBook` trong state, hiện nút *"Thử lại"*, không bắt chọn file lại |
| Insert `book_chapters` lỗi giữa chừng | Xoá `book_documents` vừa tạo (cascade dọn chương đã insert) rồi báo lỗi, tránh sách nhập dở |
| Nạp nội dung chương lỗi lúc đọc | Hiện thông báo trong vùng nội dung kèm nút *"Tải lại"* |

## Kiểm thử

Dùng Vitest + Testing Library đã có sẵn trong repo. Chạy bằng `npm test`.

`src/lib/book/cleanText.test.ts`:

- Nối gạch nối cuối dòng, không nối khi dòng sau viết hoa.
- Xoá header/footer lặp lại, giữ lại khi tài liệu dưới 5 trang.
- Xoá dòng chỉ có số trang ở các dạng đã liệt kê.
- Gộp dòng thành đoạn, giữ ngắt đoạn khi câu đã kết thúc.
- Chuẩn hoá NFC giữ nguyên dấu tiếng Việt.

`src/lib/book/chapters.test.ts`:

- Dò tiêu đề theo mẫu `Chương N` và `Phần N`.
- Dò tiêu đề theo cỡ chữ.
- Tách chương dài hơn 60.000 ký tự tại ranh giới đoạn.
- `char_offset` tích luỹ đúng và tổng khớp `total_chars`.
- Không dò được gì thì trả về một chương *"Toàn bộ nội dung"*.

`src/features/library/BookChapterEditor.test.tsx` (jsdom + Testing Library, đã có sẵn):

- Hiện đúng danh sách chương kèm số chữ.
- Đổi tên chương gọi callback với tiêu đề mới.
- Xoá chương gộp nội dung vào chương liền trên.
- Chương đầu tiên không có nút xoá và nút gộp lên.

Phần còn lại (bóc tách file thật, cuộn, lưu tiến độ) kiểm thử tay theo checklist, dùng
một file PDF và một file EPUB mẫu: nhập được, mục lục đúng, sửa mục lục có hiệu lực,
đọc và chuyển chương mượt, thoát rồi mở lại đúng vị trí, `book_reading_logs` có dòng
của hôm nay.
