# Book Detail View and Automatic Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bấm vào thẻ sách trong Library mở màn chi tiết có ảnh bìa, mục lục và thông tin; nhập PDF/EPUB thì tự lấy ảnh bìa.

**Architecture:** Ảnh bìa chuẩn hoá về JPEG 600px bằng canvas (`src/lib/book/cover.ts`, hàm thuần), upload lên bucket Supabase Storage `book-covers`, URL lưu ở cột mới `media_items.cover_url`. Màn chi tiết là component inline `BookDetailView` mà LibraryPage render thay danh sách, đúng pattern `LibraryAudioDetail` đã có. Mọi truy vấn Supabase của feature vẫn đi qua `src/lib/book/repository.ts`.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres + Storage), `pdfjs-dist` 4.x, `jszip`, Vitest 4 + jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-12-book-detail-cover-design.md`

---

## Ghi chú cho người thực hiện

- Chạy toàn bộ test: `npm test`. Chạy một file: `npm test -- src/lib/book/cover.test.ts`.
- Test đặt cạnh file nguồn, không có thư mục `tests/` riêng.
- Toàn bộ chữ hiển thị cho người dùng viết bằng tiếng Việt, khớp với phần còn lại của app.
- `client()` trong `repository.ts` là helper sẵn có, ném lỗi khi `supabase` chưa cấu hình. Dùng nó, đừng gọi `supabase` trực tiếp.
- jsdom **không** có canvas thật. Mọi test đụng tới canvas phải stub `HTMLCanvasElement.prototype` và `globalThis.createImageBitmap`, như Task 2 hướng dẫn.

---

## Task 1: Migration, bucket và kiểu dữ liệu

**Files:**
- Create: `supabase/migrations/20260816000000_book_covers_storage.sql`
- Modify: `DATABASE_SCHEMA.sql:247-270`

> **Đã có sẵn, đừng làm lại.** Luồng redesign Home/People chạy song song đã thêm cột
> `media_items.cover_url` trong `supabase/migrations/20260815000000_person_occasions_media_cover.sql`
> và trường `cover_url?: string | null` ở `src/types/index.ts:79`. Task này chỉ còn phần
> bucket Storage và cập nhật tài liệu schema. Migration vẫn giữ dòng
> `add column if not exists` để tự đứng độc lập được, nhưng nó sẽ là no-op.

Không có test tự động cho SQL — repo chưa có hạ tầng test migration. Kiểm chứng bằng bước 3.

- [ ] **Step 1: Viết migration**

Tạo `supabase/migrations/20260816000000_book_covers_storage.sql`:

```sql
-- migration: 20260816000000_book_covers_storage
-- Bucket chứa ảnh bìa sách do trình duyệt upload trực tiếp.
-- Cột media_items.cover_url đã được thêm ở 20260815000000; dòng dưới chỉ để migration
-- này chạy được độc lập trên một database chưa có nó.

alter table public.media_items add column if not exists cover_url text;

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

-- Đọc công khai để thẻ <img> tải được mà không cần signed URL.
do $$ begin
  create policy "public book covers read" on storage.objects
    for select using (bucket_id = 'book-covers');
exception when duplicate_object then null; end $$;

-- Ghi giới hạn trong thư mục mang tên user id. Khác bucket media-audio: bucket đó do
-- Edge Function ghi bằng service role nên không cần policy ghi, còn ảnh bìa thì
-- trình duyệt của chính người dùng upload lên.
do $$ begin
  create policy "own book covers insert" on storage.objects
    for insert with check (
      bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own book covers update" on storage.objects
    for update using (
      bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own book covers delete" on storage.objects
    for delete using (
      bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Cập nhật `DATABASE_SCHEMA.sql`**

Trong khối `create table ... public.media_items`, thêm dòng sau `book_format`:

```sql
  -- book-specific: format READ or LISTEN
  book_format    text        check (book_format in ('READ', 'LISTEN')),
  -- migration: 20260815000000_person_occasions_media_cover — URL ảnh bìa,
  -- file nằm trong bucket book-covers (20260816000000_book_covers_storage)
  cover_url      text,
  created_at     timestamptz not null default now(),
```

Rồi thêm ghi chú vào cuối file, cạnh chỗ đang mô tả bucket `media-audio`:

```sql
-- Storage bucket book-covers (public): ảnh bìa sách, đường dẫn <user_id>/<media_item_id>.jpg.
-- Trình duyệt upload trực tiếp nên bucket này có đủ policy insert/update/delete
-- giới hạn theo (storage.foldername(name))[1] = auth.uid()::text.
```

- [ ] **Step 3: Kiểm chứng TypeScript vẫn build**

Run: `npm run build`
Expected: build thành công, không có lỗi type.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260816000000_book_covers_storage.sql DATABASE_SCHEMA.sql
git commit -m "feat: add book-covers storage bucket"
```

---

## Task 2: `cover.ts` — chuẩn hoá ảnh bìa

**Files:**
- Create: `src/lib/book/cover.ts`
- Test: `src/lib/book/cover.test.ts`

Đây là module hàm thuần: không import `supabase`, không import `pdfjs`, không import React.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/book/cover.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blobToCover, COVER_MAX_WIDTH, COVER_QUALITY } from './cover'

// jsdom không có canvas thật lẫn createImageBitmap, nên test stub cả hai và khẳng định
// trên tham số được truyền vào thay vì trên nội dung ảnh.
type ToBlobCall = { width: number; height: number; type: string; quality: number }

let toBlobCalls: ToBlobCall[]
let bitmapClosed: boolean

function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width,
      height,
      close: () => {
        bitmapClosed = true
      },
    })),
  )
}

beforeEach(() => {
  toBlobCalls = []
  bitmapClosed = false

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never
  HTMLCanvasElement.prototype.toBlob = function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    toBlobCalls.push({
      width: this.width,
      height: this.height,
      type: type ?? '',
      quality: quality ?? 0,
    })
    callback(new Blob(['jpeg-bytes'], { type: type ?? 'image/jpeg' }))
  } as never
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('blobToCover', () => {
  it('thu ảnh lớn về đúng COVER_MAX_WIDTH và giữ tỉ lệ', async () => {
    stubBitmap(1200, 1800)

    const cover = await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(cover).not.toBeNull()
    expect(toBlobCalls).toHaveLength(1)
    expect(toBlobCalls[0].width).toBe(COVER_MAX_WIDTH)
    expect(toBlobCalls[0].height).toBe(900)
  })

  it('không phóng to ảnh hẹp hơn COVER_MAX_WIDTH', async () => {
    stubBitmap(400, 600)

    await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(toBlobCalls[0].width).toBe(400)
    expect(toBlobCalls[0].height).toBe(600)
  })

  it('luôn xuất JPEG với chất lượng COVER_QUALITY', async () => {
    stubBitmap(800, 1200)

    const cover = await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(toBlobCalls[0].type).toBe('image/jpeg')
    expect(toBlobCalls[0].quality).toBe(COVER_QUALITY)
    expect(cover?.type).toBe('image/jpeg')
  })

  it('giải phóng bitmap sau khi vẽ xong', async () => {
    stubBitmap(800, 1200)

    await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(bitmapClosed).toBe(true)
  })

  it('trả null khi blob không giải mã được thành ảnh', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('không phải ảnh')
      }),
    )

    const cover = await blobToCover(new Blob(['không phải ảnh'], { type: 'text/plain' }))

    expect(cover).toBeNull()
    expect(toBlobCalls).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/lib/book/cover.test.ts`
Expected: FAIL — `Failed to resolve import "./cover"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `src/lib/book/cover.ts`:

```ts
/** Chiều rộng tối đa của ảnh bìa đã chuẩn hoá. Đủ nét cho ô 120px ở màn chi tiết. */
export const COVER_MAX_WIDTH = 600
export const COVER_QUALITY = 0.8

/**
 * Xuất canvas ra JPEG. Canvas được thu về 0x0 sau khi xuất để iOS Safari nhả bộ nhớ —
 * ảnh bìa render từ PDF có thể chiếm vài chục MB backing store.
 */
export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0
        canvas.height = 0
        resolve(blob)
      },
      'image/jpeg',
      COVER_QUALITY,
    )
  })
}

/**
 * Giải mã một blob ảnh (lấy từ EPUB hoặc do người dùng chọn), thu về COVER_MAX_WIDTH
 * và xuất JPEG. Trả null nếu blob không phải ảnh giải mã được.
 */
export async function blobToCover(blob: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return null
  }

  try {
    // Chặn trên bằng 1: ảnh nhỏ hơn thì giữ nguyên, phóng to chỉ làm mờ và nặng thêm.
    const scale = Math.min(1, COVER_MAX_WIDTH / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await canvasToJpeg(canvas)
  } finally {
    bitmap.close?.()
  }
}
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `npm test -- src/lib/book/cover.test.ts`
Expected: PASS — 5 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/book/cover.ts src/lib/book/cover.test.ts
git commit -m "feat: normalize book cover images to 600px jpeg"
```

---

## Task 3: PDF render trang 1 làm ảnh bìa

**Files:**
- Modify: `src/lib/book/types.ts:20-28`
- Modify: `src/lib/book/pdfExtract.ts:1-6,117-175`

Không có test tự động: `extractPdf` cần pdfjs với worker thật, repo chưa có fixture PDF. Bước kiểm chứng là build + kiểm thử tay ở Task 12.

- [ ] **Step 1: Thêm `cover` vào `RawBook`**

Trong `src/lib/book/types.ts`, sửa type `RawBook`:

```ts
export type RawBook = {
  title: string
  author: string | null
  sourceFormat: BookSourceFormat
  sourceFilename: string
  /** Số trang thật, chỉ PDF mới có. */
  pageCount: number | null
  /** Ảnh bìa JPEG đã chuẩn hoá, null nếu không lấy được từ file. */
  cover: Blob | null
  chapters: RawChapter[]
}
```

- [ ] **Step 2: Chạy build để thấy chỗ nào vỡ**

Run: `npm run build`
Expected: FAIL — `extractPdf` và `extractEpub` thiếu thuộc tính `cover` trong object trả về.

- [ ] **Step 3: Thêm `renderCover` vào `pdfExtract.ts`**

Sửa dòng import ở đầu file, thêm `canvasToJpeg`:

```ts
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { cleanBookLines, linesToContent } from './cleanText'
import { splitIntoChapters } from './chapters'
import { canvasToJpeg, COVER_MAX_WIDTH } from './cover'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook, RawChapter, TextLine } from './types'
```

Thêm hàm này ngay trước `export async function extractPdf`:

```ts
/**
 * Trang 1 của một cuốn sách PDF gần như luôn là bìa hoặc trang tên sách, nên render nó
 * là đủ. Lỗi ở đây trả null chứ không ném: thiếu bìa không được làm hỏng lần nhập sách.
 */
async function renderCover(doc: PdfDocument): Promise<Blob | null> {
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1, COVER_MAX_WIDTH / base.width)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)

    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) return null

    await page.render({ canvasContext, viewport }).promise
    return await canvasToJpeg(canvas)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Gọi `renderCover` và trả về trong `RawBook`**

Trong `extractPdf`, chèn ngay sau dòng `onProgress({ phase: 'splitting', current: pageCount, total: pageCount })` và trước `const lines = cleanBookLines(...)`:

```ts
  // Render bìa sau khi đã qua bước phát hiện bản scan, để file scan không tốn công render.
  const cover = await renderCover(doc)
```

Rồi thêm `cover` vào object trả về ở cuối hàm:

```ts
  return {
    title: info.Title?.trim() || fallbackTitle,
    author: info.Author?.trim() || null,
    sourceFormat: 'PDF',
    sourceFilename: file.name,
    pageCount,
    cover,
    chapters,
  }
```

- [ ] **Step 5: Chạy build**

Run: `npm run build`
Expected: vẫn FAIL, nhưng chỉ còn một lỗi ở `epubExtract.ts` thiếu `cover`. Task 4 xử lý.

- [ ] **Step 6: Commit**

```bash
git add src/lib/book/types.ts src/lib/book/pdfExtract.ts
git commit -m "feat: render first PDF page as book cover"
```

---

## Task 4: EPUB lấy ảnh bìa từ manifest

**Files:**
- Modify: `src/lib/book/epubExtract.ts:1-5,140-175 (và cuối hàm extractEpub)`

- [ ] **Step 1: Thêm import**

Ở đầu `src/lib/book/epubExtract.ts`:

```ts
import JSZip from 'jszip'
import { cleanBookLines, linesToContent, normalizeUnicode } from './cleanText'
import { splitIntoChapters } from './chapters'
import { blobToCover } from './cover'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook, RawChapter, TextLine } from './types'
```

- [ ] **Step 2: Thêm hàm `findCover`**

Chèn ngay trước `export async function extractEpub`. Hàm dùng lại `resolvePath`, `readText`, `stripFragment` và `parseXml` đã có sẵn trong file:

```ts
const COVER_ENTRY_PATTERN = /(^|\/)cover\.(jpe?g|png|webp)$/i

/**
 * Tìm ảnh bìa trong EPUB theo bốn cách, dừng ở cách đầu tiên ra kết quả.
 * Trả blob JPEG đã chuẩn hoá, hoặc null nếu file không có ảnh bìa nào.
 */
async function findCover(zip: JSZip, opfPath: string, opf: Document): Promise<Blob | null> {
  const manifestItems = Array.from(opf.querySelectorAll('manifest > item'))
  const hrefById = new Map<string, string>()
  for (const item of manifestItems) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) hrefById.set(id, href)
  }

  const candidates: string[] = []

  // 1. <meta name="cover" content="ID"> — cách phổ biến nhất, EPUB 2 lẫn EPUB 3.
  const metaCoverId = opf.querySelector('metadata > meta[name="cover"]')?.getAttribute('content')
  const metaHref = metaCoverId ? hrefById.get(metaCoverId) : undefined
  if (metaHref) candidates.push(resolvePath(opfPath, stripFragment(metaHref)))

  // 2. properties="cover-image" — cách chuẩn của EPUB 3.
  const propertyItem = manifestItems.find((item) =>
    (item.getAttribute('properties') ?? '').split(/\s+/).includes('cover-image'),
  )
  const propertyHref = propertyItem?.getAttribute('href')
  if (propertyHref) candidates.push(resolvePath(opfPath, stripFragment(propertyHref)))

  // 3. Ảnh đầu tiên trong file spine đầu tiên — nhiều EPUB đặt bìa như một trang thường.
  const firstSpineHref = (() => {
    const itemref = opf.querySelector('spine > itemref')
    const idref = itemref?.getAttribute('idref')
    return idref ? hrefById.get(idref) : undefined
  })()
  if (firstSpineHref) {
    const firstSpinePath = resolvePath(opfPath, stripFragment(firstSpineHref))
    const source = await readText(zip, firstSpinePath)
    if (source) {
      let firstDoc: Document | null = null
      try {
        firstDoc = parseXml(source, 'application/xhtml+xml')
      } catch {
        firstDoc = new DOMParser().parseFromString(source, 'text/html')
      }
      const rawHref =
        firstDoc.querySelector('img[src]')?.getAttribute('src') ??
        firstDoc.querySelector('image')?.getAttribute('xlink:href') ??
        firstDoc.querySelector('image')?.getAttribute('href')
      if (rawHref) candidates.push(resolvePath(firstSpinePath, stripFragment(rawHref)))
    }
  }

  // 4. Bất kỳ file nào tên cover.<ext> trong zip.
  const looseEntry = Object.keys(zip.files).find((path) => COVER_ENTRY_PATTERN.test(path))
  if (looseEntry) candidates.push(looseEntry)

  for (const path of candidates) {
    const entry = zip.file(path)
    if (!entry) continue
    try {
      const cover = await blobToCover(await entry.async('blob'))
      if (cover) return cover
    } catch {
      // Thử ứng viên kế tiếp.
    }
  }

  return null
}
```

- [ ] **Step 3: Gọi `findCover` và trả về trong `RawBook`**

Trong `extractEpub`, sau khi `spinePaths` đã dựng xong và trước vòng lặp đọc nội dung, thêm:

```ts
  const cover = await findCover(zip, opfPath, opf)
```

Rồi thêm `cover,` vào object `return` ở cuối `extractEpub`, cạnh `pageCount: null`.

- [ ] **Step 4: Chạy build**

Run: `npm run build`
Expected: PASS — không còn lỗi type.

- [ ] **Step 5: Chạy toàn bộ test để chắc chưa vỡ gì**

Run: `npm test`
Expected: PASS — toàn bộ test cũ vẫn xanh.

- [ ] **Step 6: Commit**

```bash
git add src/lib/book/epubExtract.ts
git commit -m "feat: read cover image from EPUB manifest"
```

---

## Task 5: Upload và xoá ảnh bìa trong repository

**Files:**
- Modify: `src/lib/book/repository.ts:1-13 (imports), cuối file`

Không viết unit test cho các hàm này: chúng chỉ là lớp mỏng gọi Supabase, mock hết đi thì test chỉ còn khẳng định chính cái mock. `BookDetailView.test.tsx` ở Task 7 mock chúng và test hành vi thật của UI.

- [ ] **Step 1: Thêm ba hàm vào cuối `src/lib/book/repository.ts`**

```ts
const COVER_BUCKET = 'book-covers'

const coverPath = (userId: string, mediaItemId: string) => `${userId}/${mediaItemId}.jpg`

async function currentUserId(): Promise<string> {
  const { data } = await client().auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Chưa đăng nhập.')
  return userId
}

/**
 * Upload ảnh bìa, trả public URL kèm cache-buster.
 * Đường dẫn file cố định theo media item nên không có `?v=` thì đổi bìa xong trình duyệt
 * vẫn hiện ảnh cũ.
 */
export async function uploadCover(mediaItemId: string, blob: Blob): Promise<string> {
  const db = client()
  const path = coverPath(await currentUserId(), mediaItemId)

  const { error } = await db.storage
    .from(COVER_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(error.message)

  const { data } = db.storage.from(COVER_BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function saveCoverUrl(mediaItemId: string, url: string | null): Promise<void> {
  const { error } = await client().from('media_items').update({ cover_url: url }).eq('id', mediaItemId)
  if (error) throw new Error(error.message)
}

/** Xoá file trong bucket rồi xoá URL trong DB. */
export async function removeCover(mediaItemId: string): Promise<void> {
  const db = client()
  const path = coverPath(await currentUserId(), mediaItemId)
  await db.storage.from(COVER_BUCKET).remove([path])
  await saveCoverUrl(mediaItemId, null)
}
```

- [ ] **Step 2: Chạy build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/book/repository.ts
git commit -m "feat: upload and remove book covers in storage"
```

---

## Task 6: Component `BookCover`

**Files:**
- Create: `src/features/library/BookCover.tsx`
- Test: `src/features/library/BookCover.test.tsx`

`renderMediaRow` trong `LibraryPage` là một hàm thường, không phải component, nên không đặt hook được vào đó. Fallback khi ảnh lỗi cần state, nên tách component riêng — dùng chung cho cả thẻ danh sách lẫn ô bìa lớn.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/features/library/BookCover.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BookCover } from './BookCover'

afterEach(cleanup)

describe('BookCover', () => {
  it('hiện ảnh khi có url', () => {
    render(<BookCover url="https://example.com/bia.jpg?v=1" alt="Bìa Đắc Nhân Tâm" size="thumb" />)

    const image = screen.getByRole('img', { name: 'Bìa Đắc Nhân Tâm' })
    expect(image).toHaveAttribute('src', 'https://example.com/bia.jpg?v=1')
    expect(image).toHaveClass('book-cover-thumb')
  })

  it('hiện placeholder khi chưa có url', () => {
    const { container } = render(<BookCover url={null} alt="Bìa Đắc Nhân Tâm" size="large" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('.book-cover-placeholder')).toBeInTheDocument()
  })

  it('chuyển sang placeholder khi ảnh tải lỗi', () => {
    const { container } = render(<BookCover url="https://example.com/hong.jpg" alt="Bìa" size="thumb" />)

    fireEvent.error(screen.getByRole('img', { name: 'Bìa' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('.book-cover-placeholder')).toBeInTheDocument()
  })

  it('thử lại ảnh mới sau khi ảnh cũ lỗi', () => {
    const { rerender } = render(<BookCover url="https://example.com/hong.jpg" alt="Bìa" size="thumb" />)
    fireEvent.error(screen.getByRole('img', { name: 'Bìa' }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    rerender(<BookCover url="https://example.com/moi.jpg?v=2" alt="Bìa" size="thumb" />)

    expect(screen.getByRole('img', { name: 'Bìa' })).toHaveAttribute('src', 'https://example.com/moi.jpg?v=2')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/features/library/BookCover.test.tsx`
Expected: FAIL — `Failed to resolve import "./BookCover"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `src/features/library/BookCover.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'

type BookCoverProps = {
  url: string | null | undefined
  alt: string
  /** `thumb` cho thẻ trong danh sách, `large` cho ô bìa ở màn chi tiết. */
  size: 'thumb' | 'large'
}

export function BookCover({ url, alt, size }: BookCoverProps) {
  const [failed, setFailed] = useState(false)

  // Reset theo url để đổi bìa xong ảnh mới được thử lại, không kẹt ở placeholder.
  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url || failed) {
    return (
      <span className={`book-cover-placeholder book-cover-${size}`} aria-hidden="true">
        <BookOpen size={size === 'large' ? 34 : 19} />
      </span>
    )
  }

  return (
    <img
      className={`book-cover-img book-cover-${size}`}
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `npm test -- src/features/library/BookCover.test.tsx`
Expected: PASS — 4 test.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/BookCover.tsx src/features/library/BookCover.test.tsx
git commit -m "feat: add book cover component with fallback"
```

---

## Task 7: Màn chi tiết `BookDetailView`

**Files:**
- Create: `src/features/library/BookDetailView.tsx`
- Test: `src/features/library/BookDetailView.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/features/library/BookDetailView.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookChapterMeta, BookDocument, Media } from '../../types'
import { BookDetailView } from './BookDetailView'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

vi.mock('../../lib/book/repository', () => ({
  CHARS_PER_PAGE: 1800,
  loadBookDocument: vi.fn(),
  loadChapterList: vi.fn(),
  uploadCover: vi.fn(),
  saveCoverUrl: vi.fn(),
  removeCover: vi.fn(),
}))

vi.mock('../../lib/book/cover', () => ({ blobToCover: vi.fn() }))

import { blobToCover } from '../../lib/book/cover'
import { loadBookDocument, loadChapterList, removeCover, saveCoverUrl, uploadCover } from '../../lib/book/repository'

const item: Media = {
  id: 'book-1',
  type: 'BOOK',
  name: 'Đắc Nhân Tâm',
  description: null,
  status: 'IN_PROGRESS',
  is_favorite: false,
  author: 'Dale Carnegie',
  book_format: 'READ',
  cover_url: 'https://example.com/bia.jpg?v=1',
  start_date: '2026-07-12',
}

const document_: BookDocument = {
  id: 'doc-1',
  media_item_id: 'book-1',
  source_format: 'PDF',
  source_filename: 'dac-nhan-tam.pdf',
  total_chars: 400_000,
  page_count: 210,
  est_pages: 210,
  chapter_count: 3,
  last_chapter_idx: 1,
  last_scroll_ratio: 0.4,
  last_char_offset: 150_000,
  percent: 42,
  last_read_at: '2026-08-12T14:30:00.000Z',
}

const chapters: BookChapterMeta[] = [
  { id: 'c0', idx: 0, title: 'Lời nói đầu', char_count: 20_000, char_offset: 0 },
  { id: 'c1', idx: 1, title: 'Chương 1 · Nếu muốn lấy mật', char_count: 180_000, char_offset: 20_000 },
  { id: 'c2', idx: 2, title: 'Chương 2 · Bí mật lớn nhất', char_count: 200_000, char_offset: 200_000 },
]

beforeEach(() => {
  vi.mocked(loadBookDocument).mockResolvedValue(document_)
  vi.mocked(loadChapterList).mockResolvedValue(chapters)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BookDetailView với sách đã nhập file', () => {
  it('hiện thông tin sách và mục lục đầy đủ', async () => {
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
    expect(screen.getByText('Dale Carnegie')).toBeInTheDocument()
    expect(screen.getByText(/PDF/)).toBeInTheDocument()
    expect(screen.getByText('dac-nhan-tam.pdf', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()

    // Tên khả truy cập của nút chương gồm cả số thứ tự và số trang ("2 Chương 1 · … 92 tr"),
    // nên đếm qua chính thẻ <ol> thay vì khớp tên.
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(3)
  })

  it('đánh dấu chương đang đọc', async () => {
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    const current = await screen.findByRole('button', { name: /Nếu muốn lấy mật/ })
    expect(current).toHaveAttribute('aria-current', 'true')
  })

  it('bấm một chương thì mở màn đọc đúng chương đó', async () => {
    const user = userEvent.setup()
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /Bí mật lớn nhất/ }))

    expect(navigate).toHaveBeenCalledWith('/read/book-1?chapter=2')
  })

  it('nút Đọc tiếp mở màn đọc ở vị trí đã lưu', async () => {
    const user = userEvent.setup()
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /Đọc tiếp/ }))

    expect(navigate).toHaveBeenCalledWith('/read/book-1')
  })

  it('quay lại thư viện', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<BookDetailView item={item} onBack={onBack} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Quay lại thư viện' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('BookDetailView với sách chưa nhập file', () => {
  it('hiện empty state và ẩn nút Đọc tiếp', async () => {
    vi.mocked(loadBookDocument).mockResolvedValue(null)

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    expect(await screen.findByText(/Chưa nhập file cho sách này/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đọc tiếp/ })).not.toBeInTheDocument()
    expect(loadChapterList).not.toHaveBeenCalled()
  })
})

describe('BookDetailView đổi ảnh bìa', () => {
  // Input chọn ảnh bị ẩn (display:none) và có accept="image/*". `userEvent.upload` lọc
  // file theo accept nên không gửi được file .txt, còn fireEvent.change thì luôn gửi —
  // đúng thứ cần cho ca "file không phải ảnh".
  const pickFile = (file: File) =>
    fireEvent.change(screen.getByLabelText('Chọn ảnh bìa mới'), { target: { files: [file] } })

  it('lưu bìa mới và báo lên Library', async () => {
    const onCoverChange = vi.fn()
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
    vi.mocked(blobToCover).mockResolvedValue(jpeg)
    vi.mocked(uploadCover).mockResolvedValue('https://example.com/bia.jpg?v=2')

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    pickFile(new File(['anh'], 'bia.png', { type: 'image/png' }))

    await waitFor(() => expect(onCoverChange).toHaveBeenCalledWith('book-1', 'https://example.com/bia.jpg?v=2'))
    expect(uploadCover).toHaveBeenCalledWith('book-1', jpeg)
    expect(saveCoverUrl).toHaveBeenCalledWith('book-1', 'https://example.com/bia.jpg?v=2')
  })

  it('báo lỗi và giữ bìa cũ khi file không phải ảnh', async () => {
    const onCoverChange = vi.fn()
    vi.mocked(blobToCover).mockResolvedValue(null)

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    pickFile(new File(['van ban'], 'ghi-chu.txt', { type: 'text/plain' }))

    expect(await screen.findByText('File này không phải ảnh hợp lệ.')).toBeInTheDocument()
    expect(onCoverChange).not.toHaveBeenCalled()
    expect(uploadCover).not.toHaveBeenCalled()
  })

  it('chặn ảnh lớn hơn 15MB trước khi giải mã', async () => {
    const onCoverChange = vi.fn()

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    const huge = new File(['x'], 'to.png', { type: 'image/png' })
    Object.defineProperty(huge, 'size', { value: 16 * 1024 * 1024 })
    pickFile(huge)

    expect(await screen.findByText('Ảnh quá lớn (tối đa 15MB).')).toBeInTheDocument()
    expect(blobToCover).not.toHaveBeenCalled()
    expect(onCoverChange).not.toHaveBeenCalled()
  })

  it('xoá bìa', async () => {
    const user = userEvent.setup()
    const onCoverChange = vi.fn()
    vi.mocked(blobToCover).mockResolvedValue(null)
    vi.mocked(removeCover).mockResolvedValue(undefined)

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    await user.click(screen.getByRole('button', { name: 'Xoá ảnh bìa' }))

    await waitFor(() => expect(onCoverChange).toHaveBeenCalledWith('book-1', null))
    expect(removeCover).toHaveBeenCalledWith('book-1')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/features/library/BookDetailView.test.tsx`
Expected: FAIL — `Failed to resolve import "./BookDetailView"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/features/library/BookDetailView.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { blobToCover } from '../../lib/book/cover'
import {
  CHARS_PER_PAGE,
  loadBookDocument,
  loadChapterList,
  removeCover,
  saveCoverUrl,
  uploadCover,
} from '../../lib/book/repository'
import type { BookChapterMeta, BookDocument, Media } from '../../types'
import { BookCover } from './BookCover'

/** Ảnh lớn hơn mức này bị chặn trước khi giải mã, tránh treo tab trên điện thoại. */
const MAX_COVER_BYTES = 15 * 1024 * 1024

type BookDetailViewProps = {
  item: Media
  onBack: () => void
  onEdit: (item: Media) => void
  onCoverChange: (mediaItemId: string, coverUrl: string | null) => void
}

type Status = 'loading' | 'ready' | 'no-document'

const STATUS_LABEL: Record<Media['status'], [string, string]> = {
  PLANNED: ['Sẽ đọc', 'Sẽ nghe'],
  IN_PROGRESS: ['Đang đọc', 'Đang nghe'],
  COMPLETED: ['Đã đọc', 'Đã nghe'],
}

function chapterPages(chapter: BookChapterMeta, document: BookDocument): number {
  if (document.page_count && document.total_chars > 0) {
    return Math.max(1, Math.round((chapter.char_count / document.total_chars) * document.page_count))
  }
  return Math.max(1, Math.round(chapter.char_count / CHARS_PER_PAGE))
}

function formatDay(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatMoment(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function BookDetailView({ item, onBack, onEdit, onCoverChange }: BookDetailViewProps) {
  const nav = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<Status>('loading')
  const [document_, setDocument] = useState<BookDocument | null>(null)
  const [chapters, setChapters] = useState<BookChapterMeta[]>([])
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState('')

  const listen = item.book_format === 'LISTEN'
  const statusLabel = STATUS_LABEL[item.status][listen ? 1 : 0]

  useEffect(() => {
    headingRef.current?.focus()
  }, [item.id])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError('')

    const run = async () => {
      try {
        const found = await loadBookDocument(item.id)
        if (cancelled) return
        if (!found) {
          setDocument(null)
          setChapters([])
          setStatus('no-document')
          return
        }
        const list = await loadChapterList(found.id)
        if (cancelled) return
        setDocument(found)
        setChapters(list)
        setStatus('ready')
      } catch (caught) {
        if (cancelled) return
        // Phân biệt với sách thật sự chưa nhập file bằng dòng lỗi và nút Thử lại.
        setLoadError(caught instanceof Error ? caught.message : 'Không tải được thông tin sách.')
        setStatus('no-document')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [item.id, reloadKey])

  const handleCoverFile = async (file: File) => {
    setCoverError('')
    if (file.size > MAX_COVER_BYTES) {
      setCoverError('Ảnh quá lớn (tối đa 15MB).')
      return
    }

    setCoverBusy(true)
    try {
      const cover = await blobToCover(file)
      if (!cover) throw new Error('File này không phải ảnh hợp lệ.')
      const url = await uploadCover(item.id, cover)
      await saveCoverUrl(item.id, url)
      onCoverChange(item.id, url)
    } catch (caught) {
      setCoverError(caught instanceof Error ? caught.message : 'Không lưu được ảnh bìa, thử lại sau.')
    } finally {
      setCoverBusy(false)
    }
  }

  const handleCoverRemove = async () => {
    setCoverError('')
    setCoverBusy(true)
    try {
      await removeCover(item.id)
      onCoverChange(item.id, null)
    } catch {
      setCoverError('Không xoá được ảnh bìa, thử lại sau.')
    } finally {
      setCoverBusy(false)
    }
  }

  return (
    <section className="library-book-detail" aria-labelledby="library-book-title">
      <button type="button" className="library-audio-back" aria-label="Quay lại thư viện" onClick={onBack}>
        <ArrowLeft size={17} />
        Quay lại
      </button>

      <div className="library-book-detail-card">
        <div className="library-book-header">
          <BookCover url={item.cover_url} alt={`Bìa ${item.name}`} size="large" />

          <div className="library-book-heading">
            <h2 id="library-book-title" ref={headingRef} tabIndex={-1}>
              {item.name}
            </h2>
            <p>{item.author || 'Chưa cập nhật tác giả'}</p>
            <div className="library-book-badges">
              <span>{listen ? '🎧 Nghe' : '📖 Đọc'}</span>
              <span>{statusLabel}</span>
              {item.is_favorite && <span>♥ Yêu thích</span>}
            </div>

            <div className="library-book-cover-actions">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                aria-label="Chọn ảnh bìa mới"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void handleCoverFile(file)
                }}
              />
              <button type="button" disabled={coverBusy} onClick={() => fileInput.current?.click()}>
                {coverBusy ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />}
                {coverBusy ? 'Đang lưu…' : 'Đổi ảnh bìa'}
              </button>
              {item.cover_url && (
                <button type="button" disabled={coverBusy} aria-label="Xoá ảnh bìa" onClick={() => void handleCoverRemove()}>
                  <Trash2 size={13} />
                  Xoá bìa
                </button>
              )}
            </div>
            {coverError && <p className="library-book-error" role="alert">{coverError}</p>}
          </div>
        </div>

        {status === 'ready' && document_ && (
          <div className="library-book-progress">
            <div className="library-book-bar">
              <div style={{ width: `${Math.min(100, Math.max(0, document_.percent))}%` }} />
            </div>
            <span>{Math.round(document_.percent)}%</span>
            <span>
              Chương {Math.min(document_.last_chapter_idx + 1, chapters.length)}/{chapters.length}
            </span>
          </div>
        )}

        <div className="library-book-detail-actions">
          {status === 'ready' && (
            <button type="button" className="primary" onClick={() => nav(`/read/${item.id}`)}>
              <BookOpen size={14} />
              Đọc tiếp
            </button>
          )}
          <button type="button" onClick={() => onEdit(item)}>
            <Pencil size={14} />
            Chỉnh sửa
          </button>
        </div>

        <div className="library-book-section">
          <h3>Thông tin</h3>
          <dl className="library-book-info">
            {status === 'ready' && document_ && (
              <>
                <div>
                  <dt>Nguồn</dt>
                  <dd>
                    {document_.source_format}
                    {document_.source_filename ? ` · ${document_.source_filename}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Số chương</dt>
                  <dd>{document_.chapter_count}</dd>
                </div>
                <div>
                  <dt>Số chữ</dt>
                  <dd>{document_.total_chars.toLocaleString('vi-VN')}</dd>
                </div>
                <div>
                  <dt>Số trang</dt>
                  <dd>
                    {document_.page_count
                      ? `${document_.page_count} trang`
                      : `~${document_.est_pages} trang ước tính`}
                  </dd>
                </div>
              </>
            )}
            {item.author && (
              <div>
                <dt>Tác giả</dt>
                <dd>{item.author}</dd>
              </div>
            )}
            {item.start_date && (
              <div>
                <dt>Bắt đầu</dt>
                <dd>{formatDay(item.start_date)}</dd>
              </div>
            )}
            {item.end_date && (
              <div>
                <dt>Kết thúc</dt>
                <dd>{formatDay(item.end_date)}</dd>
              </div>
            )}
            {item.current_chapter != null && (
              <div>
                <dt>Chương ghi tay</dt>
                <dd>{item.current_chapter}</dd>
              </div>
            )}
            {document_?.last_read_at && (
              <div>
                <dt>Đọc lần cuối</dt>
                <dd>{formatMoment(document_.last_read_at)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="library-book-section">
          <h3>{status === 'ready' ? `Mục lục (${chapters.length})` : 'Mục lục'}</h3>

          {status === 'loading' && <p className="library-book-muted">Đang tải…</p>}

          {status === 'no-document' && (
            <div className="library-book-empty">
              <p>Chưa nhập file cho sách này. Dùng nút Nhập sách ở Library để đọc ngay trong app.</p>
              {loadError && (
                <>
                  <p className="library-book-error" role="alert">{loadError}</p>
                  <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                    Thử lại
                  </button>
                </>
              )}
            </div>
          )}

          {status === 'ready' && document_ && (
            <ol className="library-book-toc">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <button
                    type="button"
                    aria-current={chapter.idx === document_.last_chapter_idx ? 'true' : undefined}
                    onClick={() => nav(`/read/${item.id}?chapter=${chapter.idx}`)}
                  >
                    <span className="library-book-toc-index">{chapter.idx + 1}</span>
                    <span className="library-book-toc-title">{chapter.title}</span>
                    <span className="library-book-toc-pages">{chapterPages(chapter, document_)} tr</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `npm test -- src/features/library/BookDetailView.test.tsx`
Expected: PASS — 10 test.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/BookDetailView.tsx src/features/library/BookDetailView.test.tsx
git commit -m "feat: add book detail view with cover, info and chapter list"
```

---

## Task 8: Màn đọc nhận tham số `?chapter=`

**Files:**
- Modify: `src/features/library/BookReaderPage.tsx:2,26,60-104`

Không thêm test tự động: `BookReaderPage` phụ thuộc Supabase, IntersectionObserver và đo cuộn, repo chưa có harness cho nó. Kiểm chứng ở checklist tay Task 12.

- [ ] **Step 1: Import `useSearchParams`**

Sửa dòng 2 của `src/features/library/BookReaderPage.tsx`:

```ts
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
```

- [ ] **Step 2: Lấy tham số**

Ngay sau dòng `const { mediaItemId = '' } = useParams()` (dòng 26), thêm:

```ts
  const [searchParams] = useSearchParams()
  const requestedChapter = searchParams.get('chapter')
```

- [ ] **Step 3: Ưu tiên chương được yêu cầu khi mở màn hình**

Trong `useEffect` nạp dữ liệu, thay hai dòng:

```ts
        setActiveIdx(Math.min(doc.last_chapter_idx, Math.max(0, list.length - 1)))
        setPercent(doc.percent)
        pendingRatio.current = doc.last_scroll_ratio
```

bằng:

```ts
        // Mục lục ở màn chi tiết truyền ?chapter=. Người dùng chủ động chọn chương thì
        // phải vào đầu chương, không phải cuộn tới vị trí đã lưu của chương trước đó.
        const parsed = Number(requestedChapter)
        const jumping = requestedChapter !== null && Number.isInteger(parsed) && parsed >= 0
        const startIdx = jumping ? parsed : doc.last_chapter_idx
        setActiveIdx(Math.min(startIdx, Math.max(0, list.length - 1)))
        setPercent(doc.percent)
        pendingRatio.current = jumping ? 0 : doc.last_scroll_ratio
```

- [ ] **Step 4: Thêm `requestedChapter` vào mảng phụ thuộc**

Đổi dòng cuối của `useEffect` đó từ `}, [mediaItemId])` thành:

```ts
  }, [mediaItemId, requestedChapter])
```

- [ ] **Step 5: Chạy build và toàn bộ test**

Run: `npm run build && npm test`
Expected: build PASS, test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/library/BookReaderPage.tsx
git commit -m "feat: open reader at chapter from query param"
```

---

## Task 9: Modal nhập sách xem trước và lưu ảnh bìa

**Files:**
- Modify: `src/features/library/BookImportModal.tsx:1-18,40-94,137-153`

- [ ] **Step 1: Thêm import và đổi kiểu `onImported`**

Sửa phần đầu file `src/features/library/BookImportModal.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileUp, Loader2 } from 'lucide-react'
import { Modal } from '../shared'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { saveBook, saveCoverUrl, uploadCover } from '../../lib/book/repository'
import type { Media } from '../../types'
import type { ExtractProgress, RawBook, RawChapter } from '../../lib/book/types'
import { BookChapterEditor } from './BookChapterEditor'

type Stage = 'pick' | 'working' | 'preview' | 'saving'

/** Kết quả một lần nhập sách, gói thành object để không phải nhớ thứ tự bốn tham số. */
export type ImportResult = {
  mediaItemId: string
  createdItem: Media | null
  coverUrl: string | null
  coverFailed: boolean
}

type Props = {
  /** Sách BOOK đã có trong thư viện nhưng chưa nhập nội dung. */
  attachableBooks: Media[]
  onClose: () => void
  onImported: (result: ImportResult) => void
}
```

- [ ] **Step 2: Thêm state xem trước bìa**

Ngay sau `const [target, setTarget] = useState('NEW')`:

```tsx
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  // Object URL của bìa phải được thu hồi, nếu không mỗi lần chọn file lại rò một blob.
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])
```

- [ ] **Step 3: Dựng URL xem trước sau khi bóc tách**

Trong `handleFile`, sau `setBook(result)`, thêm:

```tsx
      setCoverPreview(result.cover ? URL.createObjectURL(result.cover) : null)
```

- [ ] **Step 4: Upload bìa sau khi lưu sách**

Trong `save`, thay đoạn:

```tsx
      await saveBook(mediaItemId, { ...book, title: title.trim() || book.title, chapters })
      onImported(mediaItemId, createdItem)
```

bằng:

```tsx
      await saveBook(mediaItemId, { ...book, title: title.trim() || book.title, chapters })

      // Bìa lưu sau cùng và lỗi ở đây không huỷ lần nhập: sách đã vào thư viện rồi,
      // người dùng đổi bìa tay ở màn chi tiết được.
      let coverUrl: string | null = null
      let coverFailed = false
      if (book.cover) {
        try {
          coverUrl = await uploadCover(mediaItemId, book.cover)
          await saveCoverUrl(mediaItemId, coverUrl)
        } catch {
          coverUrl = null
          coverFailed = true
        }
      }

      onImported({
        mediaItemId,
        createdItem: createdItem ? { ...createdItem, cover_url: coverUrl } : null,
        coverUrl,
        coverFailed,
      })
```

- [ ] **Step 5: Hiện bìa ở màn xem trước**

Trong khối `{(stage === 'preview' || stage === 'saving') && book && (`, chèn ngay sau `<>` và trước `<label className="book-import-field">` đầu tiên:

```tsx
            <div className="book-import-cover">
              {coverPreview ? (
                <img src={coverPreview} alt="Ảnh bìa lấy từ file" />
              ) : (
                <div className="book-import-cover-empty">
                  <p>Không tìm thấy ảnh bìa trong file</p>
                  <p>Đổi được ở màn chi tiết sách</p>
                </div>
              )}
            </div>
```

- [ ] **Step 6: Chạy build để thấy LibraryPage cần cập nhật**

Run: `npm run build`
Expected: FAIL — `LibraryPage.tsx` truyền callback `onImported` sai chữ ký. Task 10 sửa.

- [ ] **Step 7: Commit**

```bash
git add src/features/library/BookImportModal.tsx
git commit -m "feat: preview and upload cover during book import"
```

---

## Task 10: Nối vào LibraryPage

**Files:**
- Modify: `src/features/LibraryPage.tsx` (imports, state, `renderMediaRow`, nhánh render, `onImported`)
- Test: `src/features/LibraryPage.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Thêm sách vào `mediaItems` trong `src/features/LibraryPage.test.tsx` — sửa khối `vi.hoisted`:

```tsx
const { mediaItems } = vi.hoisted(() => ({
  mediaItems: [
    {
      id: 'music-1',
      type: 'MUSIC',
      name: 'Hẹn một mai',
      description: null,
      status: 'COMPLETED',
      is_favorite: true,
      artist: 'Bùi Anh Tuấn',
      music_genre: 'Ballad',
      log_date: '2026-08-12',
      log_time: '10:04',
      audio_url: 'https://example.com/hen-mot-mai.mp3',
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    {
      id: 'book-1',
      type: 'BOOK',
      name: 'Đắc Nhân Tâm',
      description: null,
      status: 'IN_PROGRESS',
      is_favorite: false,
      author: 'Dale Carnegie',
      book_format: 'READ',
      cover_url: 'https://example.com/bia.jpg?v=1',
    },
  ],
}))
```

Thêm mock cho repository ngay dưới mock `./ToastContext` — `BookDetailView` gọi Supabase qua repository, và `LibraryPage` gọi `loadImportedMediaItemIds` lúc mount:

```tsx
// Phải khai đủ mọi export mà LibraryPage dùng trực tiếp (loadImportedMediaItemIds,
// saveReadingLogEntry) lẫn gián tiếp qua BookImportModal (saveBook) và BookDetailView.
vi.mock('../lib/book/repository', () => ({
  CHARS_PER_PAGE: 1800,
  loadImportedMediaItemIds: vi.fn(async () => new Set<string>()),
  saveReadingLogEntry: vi.fn(async () => null),
  saveBook: vi.fn(),
  loadBookDocument: vi.fn(async () => null),
  loadChapterList: vi.fn(async () => []),
  uploadCover: vi.fn(),
  saveCoverUrl: vi.fn(),
  removeCover: vi.fn(),
}))
```

Thêm describe mới vào cuối file:

```tsx
describe('LibraryPage book navigation', () => {
  it('mở màn chi tiết khi bấm vào thẻ sách', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm' }))

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quay lại thư viện' })).toBeInTheDocument()
  })

  it('mở màn chi tiết bằng phím Enter', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm' }).focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
  })

  it('bấm nút Chỉnh sửa trên thẻ không mở màn chi tiết', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await user.click(screen.getAllByRole('button', { name: 'Edit item' })[1])

    expect(screen.queryByRole('button', { name: 'Quay lại thư viện' })).not.toBeInTheDocument()
  })

  it('hiện ảnh bìa thay icon trên thẻ sách', () => {
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Bìa Đắc Nhân Tâm' })).toHaveAttribute(
      'src',
      'https://example.com/bia.jpg?v=1',
    )
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/features/LibraryPage.test.tsx`
Expected: FAIL — không tìm thấy button `Xem chi tiết Đắc Nhân Tâm`.

- [ ] **Step 3: Thêm import và state vào `LibraryPage.tsx`**

Thêm hai import cạnh các import `./library/...` đã có:

```tsx
import { BookCover } from './library/BookCover'
import { BookDetailView } from './library/BookDetailView'
```

Và sửa import `BookImportModal` để lấy thêm kiểu kết quả:

```tsx
import { BookImportModal, type ImportResult } from './library/BookImportModal'
```

Thêm state ngay dưới dòng `const [importedIds, setImportedIds] = useState<Set<string>>(new Set())`:

```tsx
  const [selectedBookItemId, setSelectedBookItemId] = useState<string | null>(null)
```

- [ ] **Step 4: Biến thân thẻ sách thành vùng bấm được**

Trong `renderMediaRow`, thay khối `<div className="library-media-main">` bằng:

```tsx
        <div
          className="library-media-main"
          {...(isBook
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': `Xem chi tiết ${item.name}`,
                onClick: () => setSelectedBookItemId(item.id),
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setSelectedBookItemId(item.id)
                },
              }
            : {})}
        >
```

Rồi sửa `<div className="library-media-actions">` thành — một `stopPropagation` ở đây là đủ cho mọi nút và select bên trong, không cần rải lên từng cái:

```tsx
          <div className="library-media-actions" onClick={(event) => event.stopPropagation()}>
```

- [ ] **Step 5: Đổi icon thẻ sách thành ảnh bìa**

Trong `renderMediaRow`, thay khối icon:

```tsx
            <div className="icon-box library-media-icon" style={{ background: cat.bg, color: cat.color }}>
              <Icon size={19} />
            </div>
```

bằng:

```tsx
            <div className="icon-box library-media-icon" style={{ background: cat.bg, color: cat.color }}>
              {isBook ? <BookCover url={item.cover_url} alt={`Bìa ${item.name}`} size="thumb" /> : <Icon size={19} />}
            </div>
```

- [ ] **Step 6: Thêm nhánh render màn chi tiết**

Ngay sau khối `if (selectedAudioItem) { return <LibraryAudioDetail … /> }`, thêm:

```tsx
  const selectedBookItem = items.find((item) => item.id === selectedBookItemId) ?? null

  if (selectedBookItem) {
    return (
      <BookDetailView
        item={selectedBookItem}
        onBack={() => setSelectedBookItemId(null)}
        onEdit={(item) => {
          setSelectedBookItemId(null)
          openEdit(item)
        }}
        onCoverChange={(mediaItemId, coverUrl) => {
          setItems((prev) => prev.map((row) => (row.id === mediaItemId ? { ...row, cover_url: coverUrl } : row)))
        }}
      />
    )
  }
```

- [ ] **Step 7: Cập nhật callback `onImported`**

Thay khối `<BookImportModal … />` ở cuối file:

```tsx
      {importOpen && (
        <BookImportModal
          attachableBooks={items.filter((item) => item.type === 'BOOK' && !importedIds.has(item.id))}
          onClose={() => setImportOpen(false)}
          onImported={({ mediaItemId, createdItem, coverUrl, coverFailed }: ImportResult) => {
            if (createdItem) setItems((prev) => [createdItem, ...prev])
            else if (coverUrl) {
              setItems((prev) => prev.map((row) => (row.id === mediaItemId ? { ...row, cover_url: coverUrl } : row)))
            }
            setImportedIds((prev) => new Set(prev).add(mediaItemId))
            setImportOpen(false)
            showToast(
              coverFailed ? '📚 Đã nhập sách nhưng chưa lưu được ảnh bìa' : '📚 Đã nhập sách vào thư viện!',
            )
            nav(`/read/${mediaItemId}`)
          }}
        />
      )}
```

- [ ] **Step 8: Chạy test để xác nhận nó pass**

Run: `npm test -- src/features/LibraryPage.test.tsx`
Expected: PASS — 5 test (1 cũ + 4 mới).

- [ ] **Step 9: Chạy build và toàn bộ test**

Run: `npm run build && npm test`
Expected: cả hai PASS.

- [ ] **Step 10: Commit**

```bash
git add src/features/LibraryPage.tsx src/features/LibraryPage.test.tsx
git commit -m "feat: open book detail from library card"
```

---

## Task 11: CSS

**Files:**
- Modify: `src/styles.css` (thêm vào cuối cụm `.library-*`, cạnh `.library-audio-detail*`)

- [ ] **Step 1: Thêm style cho ảnh bìa và thẻ bấm được**

Chèn sau khối `.library-media-icon` (khoảng dòng 1199):

```css
/* Thẻ sách bấm được. touch-action chặn double-tap-to-zoom của trình duyệt trên thẻ,
   vì app không khoá zoom toàn trang. */
.library-media-main[role='button'] {
  cursor: pointer;
  touch-action: manipulation;
}

.library-media-main[role='button']:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 10px;
}

.book-cover-img,
.book-cover-placeholder {
  display: block;
  object-fit: cover;
}

.book-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--purple-bg);
  color: var(--purple);
}

.book-cover-thumb {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.book-cover-large {
  width: 120px;
  height: 180px;
  flex: 0 0 120px;
  border-radius: 12px;
}
```

- [ ] **Step 2: Thêm style cho màn chi tiết**

Chèn sau khối `.library-audio-detail-actions` (khoảng dòng 1500):

```css
.library-book-detail {
  max-width: 800px;
  margin: 0 auto;
}

.library-book-detail-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--card-border);
  border-radius: 16px;
  background: var(--card-bg);
}

.library-book-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.library-book-heading {
  flex: 1 1 auto;
  min-width: 0;
}

.library-book-heading h2 {
  margin: 0 0 2px;
  font-size: 1.14rem;
  font-weight: 800;
  color: var(--text-main);
}

.library-book-heading h2:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.library-book-heading p {
  margin: 0 0 8px;
  font-size: 0.84rem;
  color: var(--text-soft);
}

.library-book-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.library-book-badges span {
  padding: 2px 9px;
  border-radius: 20px;
  background: var(--purple-bg);
  color: var(--purple);
  font-size: 0.72rem;
  font-weight: 700;
}

.library-book-cover-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.library-book-cover-actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--card-border);
  border-radius: 20px;
  background: var(--card-bg);
  color: var(--text-soft);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.library-book-cover-actions button:disabled {
  opacity: 0.6;
  cursor: default;
}

.library-book-error {
  margin: 6px 0 0;
  color: var(--rose);
  font-size: 0.76rem;
}

.library-book-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-soft);
}

.library-book-bar {
  flex: 1 1 auto;
  height: 6px;
  border-radius: 999px;
  background: var(--purple-bg);
  overflow: hidden;
}

.library-book-bar > div {
  height: 100%;
  border-radius: 999px;
  background: var(--purple);
}

.library-book-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.library-book-detail-actions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--card-bg);
  color: var(--text-main);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.library-book-detail-actions button.primary {
  border-color: transparent;
  background: var(--purple);
  color: #fff;
}

.library-book-section h3 {
  margin: 0 0 8px;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-main);
}

.library-book-info {
  display: grid;
  gap: 6px;
  margin: 0;
}

.library-book-info > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.79rem;
}

.library-book-info dt {
  color: var(--text-soft);
}

.library-book-info dd {
  margin: 0;
  color: var(--text-main);
  font-weight: 600;
  text-align: right;
  word-break: break-word;
}

.library-book-muted {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.79rem;
}

.library-book-empty {
  padding: 14px;
  border: 1px dashed var(--card-border);
  border-radius: 12px;
  color: var(--text-soft);
  font-size: 0.79rem;
}

.library-book-empty p {
  margin: 0 0 6px;
}

.library-book-toc {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.library-book-toc button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-main);
  font-size: 0.79rem;
  text-align: left;
  cursor: pointer;
}

.library-book-toc button:hover {
  background: var(--purple-bg);
}

.library-book-toc button[aria-current='true'] {
  border-color: var(--purple);
  background: var(--purple-bg);
  color: var(--purple);
  font-weight: 700;
}

.library-book-toc-index {
  flex: 0 0 22px;
  color: var(--text-soft);
  font-weight: 700;
}

.library-book-toc-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-book-toc-pages {
  flex: 0 0 auto;
  color: var(--text-soft);
  font-size: 0.72rem;
}

.book-import-cover {
  display: flex;
  justify-content: center;
}

.book-import-cover img {
  width: 110px;
  height: 165px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--card-border);
}

.book-import-cover-empty {
  padding: 12px;
  border: 1px dashed var(--card-border);
  border-radius: 10px;
  text-align: center;
  color: var(--text-soft);
  font-size: 0.74rem;
}

.book-import-cover-empty p {
  margin: 0;
}
```

- [ ] **Step 3: Thu ô bìa lớn trên màn hẹp**

Trong media query đã có ở khoảng dòng 1327 (`@media` chứa `.library-book-actions`), thêm:

```css
  .book-cover-large {
    width: 96px;
    height: 144px;
    flex-basis: 96px;
  }
```

- [ ] **Step 4: Chạy build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "style: add book detail and cover styles"
```

---

## Task 12: Kiểm chứng cuối

**Files:** không sửa file nào trừ khi phát hiện lỗi.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS — toàn bộ file test xanh, bao gồm `cover.test.ts` (5), `BookCover.test.tsx` (4), `BookDetailView.test.tsx` (10), `LibraryPage.test.tsx` (5).

- [ ] **Step 2: Chạy build**

Run: `npm run build`
Expected: PASS, không có lỗi type và không có cảnh báo mới.

- [ ] **Step 3: Chạy lint nếu repo có**

Run: `npm run lint`
Expected: PASS. Nếu script không tồn tại thì bỏ qua bước này.

- [ ] **Step 4: Áp migration lên Supabase**

Chạy migration `supabase/migrations/20260816000000_book_covers_storage.sql` trên project Supabase đang dùng (qua Supabase CLI hoặc dán vào SQL Editor). Không làm bước này thì mọi thao tác ảnh bìa sẽ lỗi vì thiếu bucket.

Nếu migration `20260815000000_person_occasions_media_cover.sql` của luồng Home/People chưa chạy thì chạy nó trước — đó là chỗ thêm cột `cover_url`.

Xác nhận: bảng `media_items` có cột `cover_url`, và bucket `book-covers` xuất hiện ở mục Storage với trạng thái public.

- [ ] **Step 5: Kiểm thử tay**

Run: `npm run dev`

Checklist:

1. Nhập một file PDF thật → màn xem trước hiện ảnh bìa là trang 1.
2. Lưu → thẻ sách trong Library hiện ảnh bìa nhỏ thay icon 📖.
3. Bấm vào thân thẻ sách → vào màn chi tiết, thấy bìa lớn, phần trăm, thông tin, mục lục.
4. Bấm một chương ở giữa mục lục → màn đọc mở đúng chương đó, ở đầu chương.
5. Quay lại Library → bấm nút Chỉnh sửa trên thẻ sách, xác nhận modal sửa mở ra và **không** vào màn chi tiết.
6. Nhập một file EPUB thật → bìa lấy từ trong file, không phải trang trắng.
7. Ở màn chi tiết, bấm Đổi ảnh bìa và chọn một ảnh từ máy → bìa đổi ngay ở cả màn chi tiết lẫn thẻ danh sách sau khi quay lại.
8. Bấm Xoá bìa → về placeholder 📖.
9. Mở màn chi tiết của một sách nhập tay (chưa có file) → hiện empty state mục lục, không có nút Đọc tiếp, vẫn đổi bìa được.
10. Trên điện thoại: bấm hai lần nhanh vào thẻ sách không làm trang bị zoom.

- [ ] **Step 6: Commit nếu có sửa gì trong lúc kiểm chứng**

```bash
git add -A
git commit -m "fix: address issues found during book detail verification"
```

---

## Tự soát kế hoạch

Đối chiếu với spec `docs/superpowers/specs/2026-08-12-book-detail-cover-design.md`:

| Mục spec | Task |
|---|---|
| Bucket `book-covers` + 4 policy | 1 |
| `DATABASE_SCHEMA.sql` | 1 |
| `cover_url` trên `media_items` và `src/types/index.ts` | đã có sẵn từ luồng Home/People |
| `cover.ts` — `canvasToJpeg`, `blobToCover`, 600px / JPEG 0.8 | 2 |
| `RawBook.cover` | 3 |
| PDF render trang 1, lỗi trả null | 3 |
| EPUB `findCover` bốn cách | 4 |
| `uploadCover` / `saveCoverUrl` / `removeCover`, cache-buster `?v=` | 5 |
| `BookCover.tsx` hai cỡ, fallback khi lỗi | 6 |
| Màn chi tiết: header, tiến độ, thông tin, mục lục, ba trạng thái | 7 |
| Đổi / xoá ảnh bìa, chặn 15MB | 7 |
| `chapterPages` theo `page_count` hoặc `CHARS_PER_PAGE` | 7 |
| Màn đọc nhận `?chapter=`, bỏ qua `last_scroll_ratio` | 8 |
| Modal nhập sách: xem trước bìa, upload sau khi lưu, lỗi không huỷ nhập | 9 |
| LibraryPage: state, vùng bấm, `stopPropagation`, bìa trên thẻ, `onCoverChange` | 10 |
| CSS `.library-book-detail*`, `.book-cover*`, `touch-action` | 11 |
| Bảng xử lý lỗi trong spec | 3, 4, 7, 9 |
| Toàn bộ mục Kiểm thử trong spec | 2, 6, 7, 10, 12 |
