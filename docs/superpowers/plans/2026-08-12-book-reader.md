# PDF/EPUB Book Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép chọn một file PDF hoặc EPUB trong mục Books, bóc tách thành văn bản sạch có mục lục, đọc toàn màn hình trong app, và lưu tiến độ đọc vào Supabase.

**Architecture:** Bóc tách chạy hoàn toàn trên trình duyệt. `src/lib/book/` chứa các hàm thuần (làm sạch văn bản, chia chương) và hai bộ bóc tách theo định dạng, tất cả không biết gì về React hay Supabase. `repository.ts` là nơi duy nhất gọi Supabase cho feature này. Nội dung lưu mỗi chương một dòng nên màn hình đọc chỉ tải mục lục rồi lazy-load từng chương. Toàn bộ `src/lib/book/` được nạp bằng `import()` động nên không tăng bundle lần tải đầu.

**Tech Stack:** React 18, TypeScript, Vite 6, Supabase Postgres, `pdfjs-dist`, `jszip`, Vitest 4 + jsdom + Testing Library (đã có sẵn).

**Spec:** `docs/superpowers/specs/2026-08-12-book-reader-design.md`

---

## Global Constraints

- Không đưa thêm logic vào `src/features/LibraryPage.tsx` ngoài: state mở modal, nút "Nhập sách", nút "Đọc" trên thẻ sách, và việc thay lời gọi upsert nhật ký bằng helper dùng chung.
- Mọi truy vấn Supabase của feature nằm trong `src/lib/book/repository.ts`. Component không gọi `supabase` trực tiếp.
- Tất cả chuỗi hiển thị cho người dùng bằng tiếng Việt, giọng văn khớp phần còn lại của app.
- `npm run build` phải xanh sau mỗi task. `npm test` phải xanh sau mỗi task có test.
- Lỗi khi lưu tiến độ không bao giờ chặn việc đọc.

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/lib/book/types.ts` | Kiểu dùng chung: `RawBook`, `RawChapter`, `TextLine`, `BookImportError` |
| `src/lib/book/cleanText.ts` | Hàm thuần làm sạch văn bản |
| `src/lib/book/chapters.ts` | Hàm thuần dò chương, tách chương dài, tính offset |
| `src/lib/book/pdfExtract.ts` | `File` PDF → `RawBook` |
| `src/lib/book/epubExtract.ts` | `File` EPUB → `RawBook` |
| `src/lib/book/index.ts` | `extractBook()` dispatch theo định dạng, chặn file quá lớn/sai loại |
| `src/lib/book/repository.ts` | Mọi truy vấn Supabase của feature |
| `src/features/library/BookChapterEditor.tsx` | Danh sách chương sửa được ở màn hình xem trước |
| `src/features/library/BookImportModal.tsx` | Chọn file → tiến trình → xem trước → lưu |
| `src/features/library/useBookReadingProgress.ts` | Lưu vị trí đọc, tự ghi log ngày |
| `src/features/library/BookReaderPage.tsx` | Màn hình đọc toàn màn hình |
| `supabase/migrations/20260813020000_book_documents.sql` | Hai bảng mới |

---

### Task 1: Cài thư viện và mở đường cho import `?url`

**Files:**
- Modify: `package.json`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Cài hai thư viện**

```bash
npm.cmd install pdfjs-dist@^4.10.38 jszip@^3.10.1
```

- [ ] **Step 2: Xác nhận file worker của pdfjs tồn tại đúng đường dẫn ta sẽ import**

```bash
node -e "console.log(require('fs').existsSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'))"
```

Expected: `true`. Nếu ra `false`, liệt kê `node_modules/pdfjs-dist/build/` và dùng tên file worker `.mjs` thực tế ở mọi chỗ trong Task 5.

- [ ] **Step 3: Khai báo type cho Vite client**

`src/vite-env.d.ts` hiện đang rỗng. Import dạng `?url` và `import.meta.env` cần type của Vite. Ghi đè file bằng đúng một dòng:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Xác nhận build và test vẫn xanh**

```bash
npm.cmd run build
npm.cmd test
```

Expected: build thành công, test hiện các file test có sẵn đều pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/vite-env.d.ts
git commit -m "chore: add pdfjs-dist and jszip for book import"
```

---

### Task 2: Migration hai bảng mới và kiểu TypeScript

**Files:**
- Create: `supabase/migrations/20260813020000_book_documents.sql`
- Modify: `DATABASE_SCHEMA.sql`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Viết migration**

Tạo `supabase/migrations/20260813020000_book_documents.sql`:

```sql
-- Migration: 20260813020000_book_documents
-- Sách nhập từ PDF/EPUB: nội dung đã bóc tách + tiến độ đọc
-- Hai bảng này KHÔNG có deleted_at: nội dung là dẫn xuất từ file gốc, luôn nhập lại
-- được, và soft-delete sẽ khiến unique(media_item_id) chặn lần nhập lại kế tiếp.

create table if not exists public.book_documents (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null default auth.uid() references auth.users(id),
  media_item_id     uuid        not null unique references public.media_items(id) on delete cascade,
  source_format     text        not null check (source_format in ('PDF', 'EPUB')),
  source_filename   text,
  total_chars       integer     not null default 0,
  page_count        integer,
  est_pages         integer     not null default 1,
  chapter_count     integer     not null default 0,
  last_chapter_idx  integer     not null default 0,
  last_scroll_ratio real        not null default 0 check (last_scroll_ratio >= 0 and last_scroll_ratio <= 1),
  last_char_offset  integer     not null default 0,
  percent           real        not null default 0 check (percent >= 0 and percent <= 100),
  last_read_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.book_chapters (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users(id),
  document_id  uuid        not null references public.book_documents(id) on delete cascade,
  idx          integer     not null,
  title        text        not null,
  content      text        not null,
  char_count   integer     not null default 0,
  char_offset  integer     not null default 0,
  created_at   timestamptz not null default now(),
  unique (document_id, idx)
);

create index if not exists book_documents_user_idx on public.book_documents(user_id);
create index if not exists book_chapters_document_idx on public.book_chapters(document_id, idx);

alter table public.book_documents enable row level security;
alter table public.book_chapters  enable row level security;

do $$ begin
  create policy "own book documents" on public.book_documents
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own book chapters" on public.book_chapters
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Áp migration lên Supabase**

```bash
npx.cmd supabase db push
```

Expected: báo đã áp `20260813020000_book_documents`. Nếu CLI chưa link project, chạy `npx.cmd supabase link` trước, hoặc dán nội dung file SQL vào SQL Editor trên dashboard.

- [ ] **Step 3: Ghi lại schema vào tài liệu**

Chèn nguyên văn hai lệnh `create table` ở Step 1 vào cuối `DATABASE_SCHEMA.sql`, kèm dòng chú thích `-- migration: 20260813020000_book_documents` phía trên, theo đúng cách các bảng khác trong file đó được ghi.

- [ ] **Step 4: Thêm kiểu TypeScript**

Thêm vào cuối `src/types/index.ts`:

```ts
export type BookSourceFormat = 'PDF' | 'EPUB'

export type BookDocument = {
  id: string
  media_item_id: string
  source_format: BookSourceFormat
  source_filename: string | null
  total_chars: number
  page_count: number | null
  est_pages: number
  chapter_count: number
  last_chapter_idx: number
  last_scroll_ratio: number
  last_char_offset: number
  percent: number
  last_read_at?: string | null
}

export type BookChapterMeta = {
  id: string
  idx: number
  title: string
  char_count: number
  char_offset: number
}
```

- [ ] **Step 5: Xác nhận build xanh**

```bash
npm.cmd run build
```

Expected: thành công.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260813020000_book_documents.sql DATABASE_SCHEMA.sql src/types/index.ts
git commit -m "feat: add book_documents and book_chapters tables"
```

---

### Task 3: Kiểu dùng chung và làm sạch văn bản

**Files:**
- Create: `src/lib/book/types.ts`
- Create: `src/lib/book/cleanText.ts`
- Test: `src/lib/book/cleanText.test.ts`

- [ ] **Step 1: Tạo file kiểu dùng chung**

`src/lib/book/types.ts`:

```ts
import type { BookSourceFormat } from '../../types'

export type { BookSourceFormat }

/** Một dòng văn bản đã dựng lại, kèm thông tin dùng để dò tiêu đề chương. */
export type TextLine = {
  text: string
  fontSize: number
  /** Chỉ số trang (PDF) hoặc chỉ số file trong spine (EPUB), đếm từ 0. */
  page: number
  isPageFirst: boolean
  isPageLast: boolean
}

export type RawChapter = {
  title: string
  content: string
}

export type RawBook = {
  title: string
  author: string | null
  sourceFormat: BookSourceFormat
  sourceFilename: string
  /** Số trang thật, chỉ PDF mới có. */
  pageCount: number | null
  chapters: RawChapter[]
}

export type ExtractPhase = 'reading' | 'extracting' | 'splitting'

export type ExtractProgress = {
  phase: ExtractPhase
  current: number
  total: number
}

export type ProgressCallback = (progress: ExtractProgress) => void

/** Lỗi có thông điệp đã viết sẵn cho người dùng, hiển thị thẳng lên UI. */
export class BookImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookImportError'
  }
}
```

- [ ] **Step 2: Viết test thất bại cho làm sạch văn bản**

`src/lib/book/cleanText.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { TextLine } from './types'
import {
  cleanBookLines,
  dehyphenate,
  isPageNumberLine,
  joinParagraphs,
  linesToContent,
  normalizeUnicode,
  stripRunningHeads,
} from './cleanText'

function line(text: string, extra: Partial<TextLine> = {}): TextLine {
  return { text, fontSize: 12, page: 0, isPageFirst: false, isPageLast: false, ...extra }
}

describe('normalizeUnicode', () => {
  it('giữ nguyên dấu tiếng Việt và chuẩn hoá về NFC', () => {
    const decomposed = 'Tiếng Việt'

    const result = normalizeUnicode(decomposed)

    expect(result).toBe('Tiếng Việt')
    expect(result.normalize('NFC')).toBe(result)
  })

  it('gỡ ligature, ký tự vô hình và gộp khoảng trắng', () => {
    expect(normalizeUnicode('  ofﬁce​   test here  ')).toBe('office test here')
  })
})

describe('isPageNumberLine', () => {
  it('nhận ra các dạng số trang', () => {
    expect(isPageNumberLine('12')).toBe(true)
    expect(isPageNumberLine('- 12 -')).toBe(true)
    expect(isPageNumberLine('Trang 12')).toBe(true)
    expect(isPageNumberLine('Page 7')).toBe(true)
    expect(isPageNumberLine('xiv')).toBe(true)
  })

  it('không nhầm câu chữ thường thành số trang', () => {
    expect(isPageNumberLine('civil')).toBe(false)
    expect(isPageNumberLine('Chương 12')).toBe(false)
    expect(isPageNumberLine('Năm 1931 là một năm khó khăn.')).toBe(false)
  })
})

describe('stripRunningHeads', () => {
  it('xoá tiêu đề chạy lặp lại trên nhiều trang', () => {
    const lines: TextLine[] = []
    for (let page = 0; page < 10; page++) {
      lines.push(line('Đắc Nhân Tâm', { page, isPageFirst: true }))
      lines.push(line(`Nội dung trang ${page}`, { page }))
    }

    const result = stripRunningHeads(lines, 10)

    expect(result.some((l) => l.text === 'Đắc Nhân Tâm')).toBe(false)
    expect(result).toHaveLength(10)
  })

  it('giữ nguyên khi tài liệu dưới 5 trang', () => {
    const lines = [
      line('Đắc Nhân Tâm', { page: 0, isPageFirst: true }),
      line('Đắc Nhân Tâm', { page: 1, isPageFirst: true }),
    ]

    expect(stripRunningHeads(lines, 2)).toHaveLength(2)
  })
})

describe('dehyphenate', () => {
  it('nối từ bị gạch nối cuối dòng', () => {
    expect(dehyphenate(['một cuốn sách hay tuy-', 'ệt vời'])).toEqual(['một cuốn sách hay tuyệt vời'])
  })

  it('không nối khi dòng sau viết hoa', () => {
    expect(dehyphenate(['ký hiệu -', 'New York'])).toEqual(['ký hiệu -', 'New York'])
  })
})

describe('joinParagraphs', () => {
  it('gộp dòng bị ngắt thành một đoạn', () => {
    const result = joinParagraphs(['Ngày 7 tháng 5 năm 1931, cả thành phố', 'New York chứng kiến một cuộc vây bắt.'])

    expect(result).toBe('Ngày 7 tháng 5 năm 1931, cả thành phố New York chứng kiến một cuộc vây bắt.')
  })

  it('ngắt đoạn khi câu đã kết thúc hoặc gặp dòng trống', () => {
    const result = joinParagraphs(['Câu thứ nhất.', 'Câu thứ hai chưa xong', 'nên nối tiếp.', '', 'Đoạn mới.'])

    expect(result).toBe('Câu thứ nhất.\n\nCâu thứ hai chưa xong nên nối tiếp.\n\nĐoạn mới.')
  })

  it('tách đầu mục thành đoạn riêng', () => {
    expect(joinParagraphs(['Danh sách gồm', '- mục một', '- mục hai'])).toBe('Danh sách gồm\n\n- mục một\n\n- mục hai')
  })
})

describe('cleanBookLines', () => {
  it('gỡ số trang, tiêu đề chạy và dòng rỗng trong một lượt', () => {
    const lines: TextLine[] = []
    for (let page = 0; page < 8; page++) {
      lines.push(line('ĐẮC NHÂN TÂM', { page, isPageFirst: true }))
      lines.push(line(`  Nội dung trang ${page}  `, { page }))
      lines.push(line('   ', { page }))
      lines.push(line(String(page + 1), { page, isPageLast: true }))
    }

    const result = cleanBookLines(lines, 8)

    expect(result).toHaveLength(8)
    expect(result[0].text).toBe('Nội dung trang 0')
  })
})

describe('linesToContent', () => {
  it('nối gạch nối rồi gộp đoạn', () => {
    const lines = [line('Cuốn sách này rất tuy-'), line('ệt vời và đáng đọc.')]

    expect(linesToContent(lines)).toBe('Cuốn sách này rất tuyệt vời và đáng đọc.')
  })
})
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

```bash
npm.cmd test -- cleanText
```

Expected: FAIL, không resolve được `./cleanText`.

- [ ] **Step 4: Viết `cleanText.ts`**

`src/lib/book/cleanText.ts`:

```ts
import type { TextLine } from './types'

const SENTENCE_END = /[.!?…:;»"”'’)\]]$/
const BULLET_START = /^(?:[-–—•*▪·]\s|\d{1,3}[.)]\s)/
const STRICT_ROMAN = /^m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/i

/** Chuẩn hoá NFC (bắt buộc với dấu tiếng Việt), gỡ ligature và ký tự vô hình. */
export function normalizeUnicode(input: string): string {
  return input
    .normalize('NFC')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/[​-‍﻿]/g, '')
    .replace(/ /g, ' ')
    .replace(/[ --]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function isPageNumberLine(line: string): boolean {
  const text = line.trim()
  if (!text) return false
  if (/^\d{1,4}$/.test(text)) return true
  if (/^[-–—]\s*\d{1,4}\s*[-–—]$/.test(text)) return true
  if (/^(?:trang|page|tr\.?)\s*\d{1,4}$/i.test(text)) return true
  if (text.length <= 7 && STRICT_ROMAN.test(text)) return true
  return false
}

function runningHeadKey(text: string): string {
  const key = text
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return key.length >= 3 ? key : ''
}

/**
 * Xoá tiêu đề chạy: dòng đầu hoặc dòng cuối trang xuất hiện ở từ 30% số trang trở lên.
 * Bỏ qua tài liệu dưới 5 trang vì mẫu quá nhỏ để kết luận.
 */
export function stripRunningHeads(lines: TextLine[], pageCount: number): TextLine[] {
  if (pageCount < 5) return lines

  const pagesByKey = new Map<string, Set<number>>()
  for (const line of lines) {
    if (!line.isPageFirst && !line.isPageLast) continue
    const key = runningHeadKey(line.text)
    if (!key) continue
    const pages = pagesByKey.get(key) ?? new Set<number>()
    pages.add(line.page)
    pagesByKey.set(key, pages)
  }

  const threshold = Math.max(3, Math.ceil(pageCount * 0.3))
  const repeated = new Set(
    [...pagesByKey.entries()].filter(([, pages]) => pages.size >= threshold).map(([key]) => key),
  )
  if (repeated.size === 0) return lines

  return lines.filter((line) => {
    if (!line.isPageFirst && !line.isPageLast) return true
    const key = runningHeadKey(line.text)
    return !key || !repeated.has(key)
  })
}

/** Nối từ bị gạch nối cuối dòng khi dòng kế tiếp bắt đầu bằng chữ thường. */
export function dehyphenate(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const previous = out[out.length - 1]
    const breaksWord = previous !== undefined && /\p{L}[-­]$/u.test(previous)
    if (breaksWord && /^\p{Ll}/u.test(line)) {
      out[out.length - 1] = previous.replace(/[-­]$/, '') + line
      continue
    }
    out.push(line)
  }
  return out
}

/**
 * Gộp các dòng bị ngắt thành đoạn hoàn chỉnh. Cố tình không ngắt chỉ vì dòng sau
 * viết hoa: tiếng Việt đầy danh từ riêng giữa câu.
 */
export function joinParagraphs(lines: string[]): string {
  const paragraphs: string[] = []
  let current = ''

  const flush = () => {
    if (current) paragraphs.push(current)
    current = ''
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (!current) {
      current = line
      continue
    }
    if (SENTENCE_END.test(current) || BULLET_START.test(line)) {
      flush()
      current = line
      continue
    }
    current += ' ' + line
  }
  flush()

  return paragraphs.join('\n\n')
}

/** Chuẩn hoá, gỡ số trang và tiêu đề chạy, bỏ dòng rỗng. */
export function cleanBookLines(lines: TextLine[], pageCount: number): TextLine[] {
  const normalized = lines
    .map((line) => ({ ...line, text: normalizeUnicode(line.text) }))
    .filter((line) => line.text.length > 0 && !isPageNumberLine(line.text))

  return stripRunningHeads(normalized, pageCount)
}

/** Biến các dòng của một chương thành văn bản đã gộp đoạn. */
export function linesToContent(lines: TextLine[]): string {
  return joinParagraphs(dehyphenate(lines.map((line) => line.text)))
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

```bash
npm.cmd test -- cleanText
```

Expected: PASS, toàn bộ test trong `cleanText.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/book/types.ts src/lib/book/cleanText.ts src/lib/book/cleanText.test.ts
git commit -m "feat: add book text cleaning helpers"
```

---

### Task 4: Dò chương và tách chương dài

**Files:**
- Create: `src/lib/book/chapters.ts`
- Test: `src/lib/book/chapters.test.ts`

- [ ] **Step 1: Viết test thất bại**

`src/lib/book/chapters.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { RawChapter, TextLine } from './types'
import {
  MAX_CHAPTER_CHARS,
  bodyFontSize,
  detectHeadingIndexes,
  isChapterHeadingText,
  splitIntoChapters,
  splitLongChapters,
  withOffsets,
} from './chapters'

function line(text: string, fontSize = 12): TextLine {
  return { text, fontSize, page: 0, isPageFirst: false, isPageLast: false }
}

describe('isChapterHeadingText', () => {
  it('nhận ra tiêu đề chương tiếng Việt và tiếng Anh', () => {
    expect(isChapterHeadingText('Chương 3')).toBe(true)
    expect(isChapterHeadingText('CHƯƠNG MỘT')).toBe(true)
    expect(isChapterHeadingText('Phần II')).toBe(true)
    expect(isChapterHeadingText('Chapter 12')).toBe(true)
  })

  it('không nhận nhầm câu văn có chữ chương', () => {
    expect(isChapterHeadingText('Trong chương 3 tác giả đã nói rất rõ rằng mọi thứ đều có giá của nó.')).toBe(false)
    expect(isChapterHeadingText('Một đoạn văn bình thường.')).toBe(false)
  })
})

describe('bodyFontSize', () => {
  it('lấy cỡ chữ chiếm nhiều văn bản nhất, không phải cỡ xuất hiện nhiều dòng nhất', () => {
    const lines = [line('A', 24), line('B', 24), line('x'.repeat(400), 12)]

    expect(bodyFontSize(lines)).toBe(12)
  })
})

describe('detectHeadingIndexes', () => {
  it('dò theo mẫu chữ', () => {
    const lines = [line('Chương 1'), line('Nội dung một'), line('Chương 2'), line('Nội dung hai')]

    expect(detectHeadingIndexes(lines)).toEqual([0, 2])
  })

  it('dò theo cỡ chữ lớn hơn thân bài', () => {
    const lines = [line('Mở đầu câu chuyện', 20), line('x'.repeat(400), 12), line('Kết thúc', 20)]

    expect(detectHeadingIndexes(lines)).toEqual([0, 2])
  })
})

describe('splitIntoChapters', () => {
  it('cắt tại từng tiêu đề và bỏ dòng tiêu đề khỏi nội dung', () => {
    const lines = [line('Chương 1'), line('Nội dung một.'), line('Chương 2'), line('Nội dung hai.')]

    const chapters = splitIntoChapters(lines)

    expect(chapters).toEqual([
      { title: 'Chương 1', content: 'Nội dung một.' },
      { title: 'Chương 2', content: 'Nội dung hai.' },
    ])
  })

  it('gom phần trước tiêu đề đầu tiên thành Mở đầu khi đủ dài', () => {
    const lines = [line('x'.repeat(600) + '.'), line('Chương 1'), line('Nội dung.')]

    const chapters = splitIntoChapters(lines)

    expect(chapters[0].title).toBe('Mở đầu')
    expect(chapters[1].title).toBe('Chương 1')
  })

  it('trả về một chương duy nhất khi không dò được tiêu đề nào', () => {
    const chapters = splitIntoChapters([line('Một đoạn văn.'), line('Đoạn nữa.')])

    expect(chapters).toHaveLength(1)
    expect(chapters[0].title).toBe('Toàn bộ nội dung')
  })
})

describe('splitLongChapters', () => {
  it('tách chương dài tại ranh giới đoạn', () => {
    const paragraph = 'y'.repeat(20_000)
    const chapter: RawChapter = { title: 'Chương dài', content: [paragraph, paragraph, paragraph, paragraph].join('\n\n') }

    const parts = splitLongChapters([chapter])

    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0].title).toBe('Chương dài — Phần 1')
    expect(parts[1].title).toBe('Chương dài — Phần 2')
    expect(parts.every((part) => part.content.length <= MAX_CHAPTER_CHARS)).toBe(true)
    expect(parts.map((part) => part.content).join('\n\n')).toBe(chapter.content)
  })

  it('để nguyên chương ngắn', () => {
    const chapters: RawChapter[] = [{ title: 'Chương 1', content: 'ngắn thôi' }]

    expect(splitLongChapters(chapters)).toEqual(chapters)
  })
})

describe('withOffsets', () => {
  it('đánh số thứ tự và tính offset tích luỹ', () => {
    const rows = withOffsets([
      { title: 'A', content: '12345' },
      { title: 'B', content: '123' },
      { title: 'C', content: '1234567' },
    ])

    expect(rows.map((row) => row.idx)).toEqual([0, 1, 2])
    expect(rows.map((row) => row.charOffset)).toEqual([0, 5, 8])
    expect(rows.map((row) => row.charCount)).toEqual([5, 3, 7])
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
npm.cmd test -- chapters
```

Expected: FAIL, không resolve được `./chapters`.

- [ ] **Step 3: Viết `chapters.ts`**

`src/lib/book/chapters.ts`:

```ts
import { linesToContent } from './cleanText'
import type { RawChapter, TextLine } from './types'

export const MAX_CHAPTER_CHARS = 60_000
const MAX_HEADING_LENGTH = 80
const MIN_PREFACE_CHARS = 500
const HEADING_SIZE_RATIO = 1.2

const CHAPTER_PATTERN =
  /^(?:chương|chuong|phần|phan|chapter|part|mục|muc)\s+(?:\d{1,3}|[ivxlcdm]{1,7}|một|mot|hai|ba|bốn|bon|tư|tu|năm|nam|sáu|sau|bảy|bay|tám|tam|chín|chin|mười|muoi)\b/i

export function isChapterHeadingText(line: string): boolean {
  const text = line.trim()
  if (!text || text.length > MAX_HEADING_LENGTH) return false
  return CHAPTER_PATTERN.test(text)
}

/** Cỡ chữ chiếm nhiều ký tự nhất — coi là cỡ chữ thân bài. */
export function bodyFontSize(lines: TextLine[]): number {
  const charsBySize = new Map<number, number>()
  for (const line of lines) {
    const size = Math.round(line.fontSize * 2) / 2
    charsBySize.set(size, (charsBySize.get(size) ?? 0) + line.text.length)
  }

  let best = 0
  let bestChars = -1
  for (const [size, chars] of charsBySize) {
    if (chars > bestChars) {
      best = size
      bestChars = chars
    }
  }
  return best
}

export function detectHeadingIndexes(lines: TextLine[]): number[] {
  const body = bodyFontSize(lines)
  const indexes: number[] = []

  lines.forEach((line, index) => {
    const text = line.text.trim()
    if (!text) return
    if (isChapterHeadingText(text)) {
      indexes.push(index)
      return
    }
    if (body > 0 && line.fontSize >= body * HEADING_SIZE_RATIO && text.length <= MAX_HEADING_LENGTH) {
      indexes.push(index)
    }
  })

  return indexes
}

export function splitIntoChapters(lines: TextLine[]): RawChapter[] {
  const headings = detectHeadingIndexes(lines)
  const wholeBook = (): RawChapter[] => [{ title: 'Toàn bộ nội dung', content: linesToContent(lines) }]

  if (headings.length === 0) return wholeBook()

  const chapters: RawChapter[] = []

  const prefaceContent = linesToContent(lines.slice(0, headings[0]))
  if (prefaceContent.length >= MIN_PREFACE_CHARS) {
    chapters.push({ title: 'Mở đầu', content: prefaceContent })
  }

  headings.forEach((start, position) => {
    const end = headings[position + 1] ?? lines.length
    const content = linesToContent(lines.slice(start + 1, end))
    if (!content) return
    chapters.push({ title: lines[start].text.trim(), content })
  })

  return chapters.length > 0 ? chapters : wholeBook()
}

/**
 * Tách chương dài hơn `maxChars` tại ranh giới đoạn để trang đọc không phải render
 * DOM quá lớn. Một đoạn đơn lẻ dài hơn `maxChars` vẫn giữ nguyên thành một phần.
 */
export function splitLongChapters(chapters: RawChapter[], maxChars = MAX_CHAPTER_CHARS): RawChapter[] {
  const out: RawChapter[] = []

  for (const chapter of chapters) {
    if (chapter.content.length <= maxChars) {
      out.push(chapter)
      continue
    }

    const parts: string[] = []
    let buffer = ''
    for (const paragraph of chapter.content.split('\n\n')) {
      if (buffer && buffer.length + paragraph.length + 2 > maxChars) {
        parts.push(buffer)
        buffer = paragraph
        continue
      }
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    }
    if (buffer) parts.push(buffer)

    parts.forEach((content, index) => {
      out.push({ title: `${chapter.title} — Phần ${index + 1}`, content })
    })
  }

  return out
}

export type ChapterWithOffset = RawChapter & {
  idx: number
  charCount: number
  charOffset: number
}

export function withOffsets(chapters: RawChapter[]): ChapterWithOffset[] {
  let offset = 0
  return chapters.map((chapter, idx) => {
    const charCount = chapter.content.length
    const row = { ...chapter, idx, charCount, charOffset: offset }
    offset += charCount
    return row
  })
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
npm.cmd test -- chapters
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/book/chapters.ts src/lib/book/chapters.test.ts
git commit -m "feat: add book chapter detection and splitting"
```

---

### Task 5: Bóc tách PDF

**Files:**
- Create: `src/lib/book/pdfExtract.ts`

Không có unit test tự động cho task này: nó cần một file PDF thật và một worker của pdfjs, cả hai đều không chạy trong jsdom. Kiểm thử ở Task 14 bằng file mẫu.

- [ ] **Step 1: Viết `pdfExtract.ts`**

`src/lib/book/pdfExtract.ts`:

```ts
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { linesToContent, cleanBookLines } from './cleanText'
import { splitIntoChapters } from './chapters'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook, RawChapter, TextLine } from './types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const SCAN_SAMPLE_PAGES = 5
const SCAN_MIN_CHARS_PER_PAGE = 100
const YIELD_EVERY_PAGES = 5
const SAME_LINE_TOLERANCE = 2
const MIN_CHAPTERS_BEFORE_RETRY = 3
const LONG_BOOK_CHARS = 100_000

type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Dựng lại các dòng của một trang từ toạ độ của từng mảnh chữ. */
async function readPageLines(page: PdfPage, pageIndex: number): Promise<TextLine[]> {
  const content = await page.getTextContent()

  type Row = { y: number; size: number; parts: { x: number; width: number; str: string }[] }
  const rows: Row[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue
    const x = item.transform[4] as number
    const y = item.transform[5] as number
    const size = Math.abs(item.transform[3] as number) || item.height || 10

    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= SAME_LINE_TOLERANCE)
    if (!row) {
      row = { y, size, parts: [] }
      rows.push(row)
    }
    row.size = Math.max(row.size, size)
    row.parts.push({ x, width: item.width, str: item.str })
  }

  rows.sort((a, b) => b.y - a.y)

  const lines: TextLine[] = []
  for (const row of rows) {
    row.parts.sort((a, b) => a.x - b.x)
    let text = ''
    let previousEnd: number | null = null
    for (const part of row.parts) {
      if (previousEnd !== null && part.x - previousEnd > row.size * 0.25) text += ' '
      text += part.str
      previousEnd = part.x + part.width
    }
    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (trimmed) {
      lines.push({ text: trimmed, fontSize: row.size, page: pageIndex, isPageFirst: false, isPageLast: false })
    }
  }

  if (lines.length > 0) {
    lines[0].isPageFirst = true
    lines[lines.length - 1].isPageLast = true
  }
  return lines
}

async function resolvePageIndex(doc: PdfDocument, dest: unknown): Promise<number | null> {
  try {
    const resolved = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    if (!Array.isArray(resolved) || !resolved[0]) return null
    return await doc.getPageIndex(resolved[0])
  } catch {
    return null
  }
}

/** Chia chương theo bookmark của PDF. Trả về null khi không dùng được. */
async function chaptersFromOutline(doc: PdfDocument, lines: TextLine[]): Promise<RawChapter[] | null> {
  let outline: Awaited<ReturnType<PdfDocument['getOutline']>>
  try {
    outline = await doc.getOutline()
  } catch {
    return null
  }
  if (!outline || outline.length === 0) return null

  const marks: { title: string; page: number }[] = []
  for (const item of outline) {
    const page = await resolvePageIndex(doc, item.dest)
    if (page === null) continue
    marks.push({ title: (item.title ?? '').trim() || `Mục ${marks.length + 1}`, page })
  }
  if (marks.length < 2) return null

  marks.sort((a, b) => a.page - b.page)

  const chapters: RawChapter[] = []
  marks.forEach((mark, position) => {
    const end = marks[position + 1]?.page ?? Number.POSITIVE_INFINITY
    let slice = lines.filter((line) => line.page >= mark.page && line.page < end)
    // Bookmark trỏ đúng vào dòng tiêu đề, bỏ đi để không lặp lại trong nội dung.
    if (slice[0] && slice[0].text.trim().toLowerCase() === mark.title.toLowerCase()) slice = slice.slice(1)
    const content = linesToContent(slice)
    if (content) chapters.push({ title: mark.title, content })
  })

  return chapters.length >= 2 ? chapters : null
}

function totalChars(chapters: RawChapter[]): number {
  return chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)
}

export async function extractPdf(file: File, onProgress: ProgressCallback): Promise<RawBook> {
  onProgress({ phase: 'reading', current: 0, total: 1 })
  const data = new Uint8Array(await file.arrayBuffer())

  let doc: PdfDocument
  try {
    doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
  } catch (error) {
    if ((error as Error).name === 'PasswordException') {
      throw new BookImportError('PDF này có mật khẩu, không mở được.')
    }
    throw new BookImportError('Không mở được file PDF này.')
  }

  const pageCount = doc.numPages
  const rawLines: TextLine[] = []
  let sampleChars = 0

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const pageLines = await readPageLines(page, pageNumber - 1)
    rawLines.push(...pageLines)

    if (pageNumber <= SCAN_SAMPLE_PAGES) {
      sampleChars += pageLines.reduce((sum, line) => sum + line.text.length, 0)
      if (pageNumber === Math.min(SCAN_SAMPLE_PAGES, pageCount) && sampleChars / pageNumber < SCAN_MIN_CHARS_PER_PAGE) {
        throw new BookImportError(
          'File này là bản scan (ảnh chụp), chưa hỗ trợ. Hãy dùng PDF có lớp văn bản hoặc file EPUB.',
        )
      }
    }

    onProgress({ phase: 'extracting', current: pageNumber, total: pageCount })
    if (pageNumber % YIELD_EVERY_PAGES === 0) await yieldToUi()
  }

  onProgress({ phase: 'splitting', current: pageCount, total: pageCount })
  const lines = cleanBookLines(rawLines, pageCount)

  let chapters = (await chaptersFromOutline(doc, lines)) ?? splitIntoChapters(lines)
  if (chapters.length < MIN_CHAPTERS_BEFORE_RETRY && totalChars(chapters) > LONG_BOOK_CHARS) {
    const heuristic = splitIntoChapters(lines)
    if (heuristic.length > chapters.length) chapters = heuristic
  }

  const metadata = await doc.getMetadata().catch(() => null)
  const info = (metadata?.info ?? {}) as { Title?: string; Author?: string }
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '')

  return {
    title: info.Title?.trim() || fallbackTitle,
    author: info.Author?.trim() || null,
    sourceFormat: 'PDF',
    sourceFilename: file.name,
    pageCount,
    chapters,
  }
}
```

- [ ] **Step 2: Xác nhận TypeScript chấp nhận**

```bash
npm.cmd run build
```

Expected: thành công. Nếu `pdf.worker.min.mjs?url` báo lỗi module, kiểm tra lại `src/vite-env.d.ts` có dòng `/// <reference types="vite/client" />` từ Task 1.

- [ ] **Step 3: Commit**

```bash
git add src/lib/book/pdfExtract.ts
git commit -m "feat: extract clean text and chapters from PDF"
```

---

### Task 6: Bóc tách EPUB

**Files:**
- Create: `src/lib/book/epubExtract.ts`

- [ ] **Step 1: Viết `epubExtract.ts`**

`src/lib/book/epubExtract.ts`:

```ts
import JSZip from 'jszip'
import { cleanBookLines, linesToContent, normalizeUnicode } from './cleanText'
import { splitIntoChapters } from './chapters'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook, RawChapter, TextLine } from './types'

const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/'
const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,dd,dt'
const BODY_FONT_SIZE = 12
const HEADING_FONT_SIZE: Record<string, number> = { h1: 20, h2: 18, h3: 16, h4: 15, h5: 14, h6: 13 }
const YIELD_EVERY_FILES = 5
const MIN_CHAPTERS_BEFORE_RETRY = 3
const LONG_BOOK_CHARS = 100_000

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const invalidEpub = () => new BookImportError('File EPUB không hợp lệ hoặc đã hỏng.')

function parseXml(source: string, mimeType: DOMParserSupportedType): Document {
  const doc = new DOMParser().parseFromString(source, mimeType)
  if (doc.querySelector('parsererror')) throw invalidEpub()
  return doc
}

/** Gộp đường dẫn tương đối trong EPUB (luôn dùng dấu `/`, không phải đường dẫn hệ thống). */
function resolvePath(basePath: string, relative: string): string {
  const stack = basePath.split('/').slice(0, -1)
  for (const segment of decodeURIComponent(relative).split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return stack.join('/')
}

const stripFragment = (href: string) => href.split('#')[0]

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path)
  return entry ? entry.async('string') : null
}

/** Lấy các dòng văn bản từ một file XHTML, giữ cấp tiêu đề dưới dạng cỡ chữ. */
function xhtmlToLines(source: string, fileIndex: number): TextLine[] {
  let doc: Document
  try {
    doc = parseXml(source, 'application/xhtml+xml')
  } catch {
    doc = new DOMParser().parseFromString(source, 'text/html')
  }

  const root = doc.body ?? doc.documentElement
  if (!root) return []

  root.querySelectorAll('script, style, nav, header, footer, svg, figure, table').forEach((node) => node.remove())
  root.querySelectorAll('br').forEach((br) => br.replaceWith(doc.createTextNode('\n')))

  const lines: TextLine[] = []
  const push = (text: string, fontSize: number) => {
    for (const piece of text.split('\n')) {
      const normalized = normalizeUnicode(piece)
      if (normalized) {
        lines.push({ text: normalized, fontSize, page: fileIndex, isPageFirst: false, isPageLast: false })
      }
    }
  }

  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
  if (blocks.length === 0) {
    push(root.textContent ?? '', BODY_FONT_SIZE)
    return lines
  }

  for (const block of blocks) {
    // Bỏ qua khối lồng khối để không lấy trùng nội dung.
    if (block.querySelector(BLOCK_SELECTOR)) continue
    const tag = block.tagName.toLowerCase()
    push(block.textContent ?? '', HEADING_FONT_SIZE[tag] ?? BODY_FONT_SIZE)
  }

  return lines
}

/** Đọc mục lục: ưu tiên nav của EPUB 3, lùi về toc.ncx của EPUB 2. Khoá là đường dẫn file. */
async function readToc(zip: JSZip, opfPath: string, opf: Document): Promise<Map<string, string>> {
  const titles = new Map<string, string>()

  const navItem = Array.from(opf.querySelectorAll('manifest > item')).find(
    (item) => (item.getAttribute('properties') ?? '').split(/\s+/).includes('nav'),
  )
  if (navItem) {
    const navPath = resolvePath(opfPath, navItem.getAttribute('href') ?? '')
    const navSource = await readText(zip, navPath)
    if (navSource) {
      const navDoc = new DOMParser().parseFromString(navSource, 'text/html')
      const navs = Array.from(navDoc.querySelectorAll('nav'))
      const tocNav = navs.find((nav) => (nav.getAttribute('epub:type') ?? '').includes('toc')) ?? navs[0]
      for (const anchor of Array.from(tocNav?.querySelectorAll('a') ?? [])) {
        const href = anchor.getAttribute('href')
        const label = normalizeUnicode(anchor.textContent ?? '')
        if (!href || !label) continue
        const target = resolvePath(navPath, stripFragment(href))
        if (!titles.has(target)) titles.set(target, label)
      }
    }
  }

  if (titles.size > 0) return titles

  const ncxItem = Array.from(opf.querySelectorAll('manifest > item')).find(
    (item) => (item.getAttribute('media-type') ?? '') === 'application/x-dtbncx+xml',
  )
  if (!ncxItem) return titles

  const ncxPath = resolvePath(opfPath, ncxItem.getAttribute('href') ?? '')
  const ncxSource = await readText(zip, ncxPath)
  if (!ncxSource) return titles

  const ncxDoc = parseXml(ncxSource, 'application/xml')
  for (const point of Array.from(ncxDoc.querySelectorAll('navPoint'))) {
    const href = point.querySelector('content')?.getAttribute('src')
    const label = normalizeUnicode(point.querySelector('navLabel > text')?.textContent ?? '')
    if (!href || !label) continue
    const target = resolvePath(ncxPath, stripFragment(href))
    if (!titles.has(target)) titles.set(target, label)
  }

  return titles
}

function firstHeadingTitle(lines: TextLine[]): string | null {
  const heading = lines.find((line) => line.fontSize > BODY_FONT_SIZE && line.text.length <= 80)
  return heading?.text ?? null
}

export async function extractEpub(file: File, onProgress: ProgressCallback): Promise<RawBook> {
  onProgress({ phase: 'reading', current: 0, total: 1 })

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw invalidEpub()
  }

  const containerSource = await readText(zip, 'META-INF/container.xml')
  if (!containerSource) throw invalidEpub()
  const opfPath = parseXml(containerSource, 'application/xml')
    .querySelector('rootfile')
    ?.getAttribute('full-path')
  if (!opfPath) throw invalidEpub()

  const opfSource = await readText(zip, opfPath)
  if (!opfSource) throw invalidEpub()
  const opf = parseXml(opfSource, 'application/xml')

  const hrefById = new Map<string, string>()
  for (const item of Array.from(opf.querySelectorAll('manifest > item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) hrefById.set(id, href)
  }

  const spinePaths: string[] = []
  for (const itemref of Array.from(opf.querySelectorAll('spine > itemref'))) {
    const href = hrefById.get(itemref.getAttribute('idref') ?? '')
    if (href) spinePaths.push(resolvePath(opfPath, href))
  }
  if (spinePaths.length === 0) throw invalidEpub()

  const toc = await readToc(zip, opfPath, opf)

  const documents: { path: string; lines: TextLine[] }[] = []
  for (const [index, path] of spinePaths.entries()) {
    const source = await readText(zip, path)
    if (source) documents.push({ path, lines: xhtmlToLines(source, index) })
    onProgress({ phase: 'extracting', current: index + 1, total: spinePaths.length })
    if ((index + 1) % YIELD_EVERY_FILES === 0) await yieldToUi()
  }

  onProgress({ phase: 'splitting', current: spinePaths.length, total: spinePaths.length })

  const allLines = cleanBookLines(documents.flatMap((doc) => doc.lines), 0)

  let chapters: RawChapter[] = []
  for (const doc of documents) {
    const lines = cleanBookLines(doc.lines, 0)
    const tocTitle = toc.get(doc.path)
    const body = lines[0] && tocTitle && lines[0].text === tocTitle ? lines.slice(1) : lines
    const content = linesToContent(body)
    if (!content) continue

    if (tocTitle === undefined && chapters.length > 0) {
      chapters[chapters.length - 1].content += '\n\n' + content
      continue
    }
    chapters.push({
      title: tocTitle ?? firstHeadingTitle(lines) ?? `Phần ${chapters.length + 1}`,
      content,
    })
  }

  const total = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)
  if (chapters.length < MIN_CHAPTERS_BEFORE_RETRY && total > LONG_BOOK_CHARS) {
    const heuristic = splitIntoChapters(allLines)
    if (heuristic.length > chapters.length) chapters = heuristic
  }
  if (chapters.length === 0) chapters = splitIntoChapters(allLines)

  const title = opf.getElementsByTagNameNS(DC_NAMESPACE, 'title')[0]?.textContent?.trim()
  const author = opf.getElementsByTagNameNS(DC_NAMESPACE, 'creator')[0]?.textContent?.trim()

  return {
    title: title || file.name.replace(/\.[^.]+$/, ''),
    author: author || null,
    sourceFormat: 'EPUB',
    sourceFilename: file.name,
    pageCount: null,
    chapters,
  }
}
```

- [ ] **Step 2: Xác nhận build xanh**

```bash
npm.cmd run build
```

Expected: thành công.

- [ ] **Step 3: Commit**

```bash
git add src/lib/book/epubExtract.ts
git commit -m "feat: extract clean text and chapters from EPUB"
```

---

### Task 7: Điểm vào `extractBook`

**Files:**
- Create: `src/lib/book/index.ts`

- [ ] **Step 1: Viết `index.ts`**

`src/lib/book/index.ts`:

```ts
import { extractEpub } from './epubExtract'
import { extractPdf } from './pdfExtract'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook } from './types'

export const MAX_FILE_BYTES = 60 * 1024 * 1024
const MIN_TOTAL_CHARS = 500

export { BookImportError }
export type { ExtractProgress, ProgressCallback, RawBook, RawChapter } from './types'

export async function extractBook(file: File, onProgress: ProgressCallback): Promise<RawBook> {
  if (file.size > MAX_FILE_BYTES) {
    throw new BookImportError('File quá lớn (tối đa 60MB).')
  }

  const name = file.name.toLowerCase()
  const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
  const isEpub = name.endsWith('.epub') || file.type === 'application/epub+zip'

  if (!isPdf && !isEpub) {
    throw new BookImportError('Chỉ hỗ trợ file PDF và EPUB.')
  }

  const book = isPdf ? await extractPdf(file, onProgress) : await extractEpub(file, onProgress)

  const totalChars = book.chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)
  if (totalChars < MIN_TOTAL_CHARS) {
    throw new BookImportError('Không lấy được nội dung từ file này.')
  }

  return book
}
```

- [ ] **Step 2: Xác nhận build xanh**

```bash
npm.cmd run build
```

Expected: thành công.

- [ ] **Step 3: Commit**

```bash
git add src/lib/book/index.ts
git commit -m "feat: add extractBook entry point with format and size guards"
```

---

### Task 8: Lớp truy cập Supabase và sửa lỗi upsert nhật ký đọc

**Files:**
- Create: `src/lib/book/repository.ts`
- Modify: `src/features/LibraryPage.tsx` (chỉ hàm `saveBookReadingLog`)

`LibraryPage.tsx` đang gọi `upsert(logData, { onConflict: 'media_item_id,log_date' })` nhưng bảng `book_reading_logs` không có unique constraint trên cặp cột đó, nên upsert luôn lỗi và nhánh insert dự phòng tạo dòng trùng. Feature này ghi vào cùng bảng nên sửa luôn, dùng chung một hàm.

- [ ] **Step 1: Viết `repository.ts`**

`src/lib/book/repository.ts`:

```ts
import { supabase } from '../supabase'
import { localDate } from '../date'
import type { BookChapterMeta, BookDocument, BookReadingLog } from '../../types'
import { splitLongChapters, withOffsets } from './chapters'
import type { RawBook } from './types'

export const CHARS_PER_PAGE = 1800
const CHAPTER_INSERT_BATCH = 20

function client() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  return supabase
}

/** Số trang ước tính tại một vị trí trong sách. */
export function estimatePage(charOffset: number, totalChars: number, pageCount: number | null): number {
  if (pageCount && totalChars > 0) {
    return Math.max(1, Math.min(pageCount, Math.round((charOffset / totalChars) * pageCount)))
  }
  return Math.max(1, Math.round(charOffset / CHARS_PER_PAGE) + 1)
}

/** Lưu sách đã bóc tách. Xoá tài liệu cũ của cùng media item trước khi ghi bản mới. */
export async function saveBook(mediaItemId: string, book: RawBook): Promise<BookDocument> {
  const db = client()
  const chapters = withOffsets(splitLongChapters(book.chapters))
  const totalChars = chapters.reduce((sum, chapter) => sum + chapter.charCount, 0)
  const estPages = book.pageCount ?? Math.max(1, Math.round(totalChars / CHARS_PER_PAGE))

  await db.from('book_documents').delete().eq('media_item_id', mediaItemId)

  const { data: document, error } = await db
    .from('book_documents')
    .insert({
      media_item_id: mediaItemId,
      source_format: book.sourceFormat,
      source_filename: book.sourceFilename,
      total_chars: totalChars,
      page_count: book.pageCount,
      est_pages: estPages,
      chapter_count: chapters.length,
    })
    .select()
    .single()

  if (error || !document) throw new Error(error?.message ?? 'Không lưu được sách.')

  const rows = chapters.map((chapter) => ({
    document_id: document.id,
    idx: chapter.idx,
    title: chapter.title,
    content: chapter.content,
    char_count: chapter.charCount,
    char_offset: chapter.charOffset,
  }))

  for (let start = 0; start < rows.length; start += CHAPTER_INSERT_BATCH) {
    const { error: chapterError } = await db.from('book_chapters').insert(rows.slice(start, start + CHAPTER_INSERT_BATCH))
    if (chapterError) {
      // Dọn tài liệu dở dang; cascade xoá luôn các chương đã ghi.
      await db.from('book_documents').delete().eq('id', document.id)
      throw new Error(chapterError.message)
    }
  }

  return document as BookDocument
}

export async function loadBookDocument(mediaItemId: string): Promise<BookDocument | null> {
  const { data } = await client().from('book_documents').select('*').eq('media_item_id', mediaItemId).maybeSingle()
  return (data as BookDocument | null) ?? null
}

export async function loadChapterList(documentId: string): Promise<BookChapterMeta[]> {
  const { data, error } = await client()
    .from('book_chapters')
    .select('id, idx, title, char_count, char_offset')
    .eq('document_id', documentId)
    .order('idx', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as BookChapterMeta[]
}

export async function loadChapterContent(chapterId: string): Promise<string> {
  const { data, error } = await client().from('book_chapters').select('content').eq('id', chapterId).single()
  if (error || !data) throw new Error(error?.message ?? 'Không tải được nội dung chương.')
  return (data as { content: string }).content
}

export type ProgressPatch = {
  last_chapter_idx: number
  last_scroll_ratio: number
  last_char_offset: number
  percent: number
}

export async function saveProgress(documentId: string, patch: ProgressPatch): Promise<void> {
  await client()
    .from('book_documents')
    .update({ ...patch, last_read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', documentId)
}

/** Danh sách media item đã có sách nhập, để Library biết thẻ nào hiện nút Đọc. */
export async function loadImportedMediaItemIds(): Promise<Set<string>> {
  if (!supabase) return new Set()
  const { data } = await supabase.from('book_documents').select('media_item_id')
  return new Set(((data ?? []) as { media_item_id: string }[]).map((row) => row.media_item_id))
}

export type ReadingLogInput = {
  media_item_id: string
  log_date: string
  page?: number | null
  listen_hours?: number
  listen_minutes?: number
  note?: string | null
}

/**
 * Ghi nhật ký đọc cho một ngày: có dòng thì update, chưa có thì insert.
 * Không dùng upsert vì bảng không có unique constraint trên (media_item_id, log_date),
 * và thêm constraint sẽ đụng với các dòng đã soft-delete.
 */
export async function saveReadingLogEntry(input: ReadingLogInput): Promise<BookReadingLog | null> {
  const db = client()
  const payload = {
    media_item_id: input.media_item_id,
    log_date: input.log_date,
    page: input.page ?? null,
    listen_hours: input.listen_hours ?? 0,
    listen_minutes: input.listen_minutes ?? 0,
    note: input.note ?? null,
  }

  const { data: existing } = await db
    .from('book_reading_logs')
    .select('id')
    .eq('media_item_id', input.media_item_id)
    .eq('log_date', input.log_date)
    .is('deleted_at', null)
    .maybeSingle()

  const query = existing
    ? db.from('book_reading_logs').update(payload).eq('id', (existing as { id: string }).id)
    : db.from('book_reading_logs').insert(payload)

  const { data, error } = await query.select().single()
  if (error) return null
  return data as BookReadingLog
}

/** Ghi trang đã đọc của hôm nay. Chỉ tăng, không bao giờ ghi đè bằng số nhỏ hơn. */
export async function reportPagesRead(mediaItemId: string, page: number): Promise<void> {
  const db = client()
  const today = localDate()

  const { data: existing } = await db
    .from('book_reading_logs')
    .select('id, page')
    .eq('media_item_id', mediaItemId)
    .eq('log_date', today)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    const row = existing as { id: string; page: number | null }
    if ((row.page ?? 0) >= page) return
    await db.from('book_reading_logs').update({ page }).eq('id', row.id)
    return
  }

  await db.from('book_reading_logs').insert({ media_item_id: mediaItemId, log_date: today, page })
}
```

- [ ] **Step 2: Thay phần upsert trong `LibraryPage.tsx`**

Thêm import ở đầu file, ngay dưới dòng `import { supabase } from '../lib/supabase'`:

```ts
import { saveReadingLogEntry } from '../lib/book/repository'
```

Thay toàn bộ thân hàm `saveBookReadingLog` (từ dòng khai báo `const logData = {` đến hết khối `if (!error && data) { ... } else { ... }`) bằng:

```ts
    const saved = await saveReadingLogEntry({
      media_item_id: item.id,
      log_date: logProgressDate,
      page: fmt === 'READ' ? parseInt(logPage) || null : null,
      listen_hours: fmt === 'LISTEN' ? parseInt(logListenHours) || 0 : 0,
      listen_minutes: fmt === 'LISTEN' ? parseInt(logListenMinutes) || 0 : 0,
      note: logNote.trim() || null,
    })

    if (saved) {
      bookReadingLogsQuery.setItems((prev) => [
        ...prev.filter((l) => !(l.media_item_id === item.id && l.log_date === logProgressDate)),
        saved,
      ])
      showToast('📖 Đã ghi lại tiến độ!')
    } else {
      showToast('❌ Không thể lưu tiến độ, thử lại sau', 'delete')
    }
```

Giữ nguyên phần reset state phía dưới (`setBookLogModal(null)` và các `setLog…`).

- [ ] **Step 3: Xác nhận build và test xanh**

```bash
npm.cmd run build
npm.cmd test
```

Expected: cả hai thành công.

- [ ] **Step 4: Commit**

```bash
git add src/lib/book/repository.ts src/features/LibraryPage.tsx
git commit -m "feat: add book repository and fix duplicate reading log rows"
```

---

### Task 9: Danh sách chương sửa được

**Files:**
- Create: `src/features/library/BookChapterEditor.tsx`
- Test: `src/features/library/BookChapterEditor.test.tsx`

- [ ] **Step 1: Viết test thất bại**

`src/features/library/BookChapterEditor.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RawChapter } from '../../lib/book/types'
import { BookChapterEditor } from './BookChapterEditor'

afterEach(cleanup)

const chapters: RawChapter[] = [
  { title: 'Chương 1', content: 'Nội dung một.' },
  { title: 'Chương 2', content: 'Nội dung hai.' },
  { title: 'Chương 3', content: 'Nội dung ba.' },
]

describe('BookChapterEditor', () => {
  it('hiện mọi chương kèm số chữ', () => {
    render(<BookChapterEditor chapters={chapters} onChange={vi.fn()} />)

    expect(screen.getByDisplayValue('Chương 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Chương 3')).toBeInTheDocument()
    expect(screen.getAllByText(/ký tự/)).toHaveLength(3)
  })

  it('đổi tên chương trả về danh sách đã cập nhật', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BookChapterEditor chapters={chapters} onChange={onChange} />)

    await user.type(screen.getByDisplayValue('Chương 2'), '!')

    expect(onChange).toHaveBeenLastCalledWith([
      chapters[0],
      { title: 'Chương 2!', content: 'Nội dung hai.' },
      chapters[2],
    ])
  })

  it('xoá chương gộp nội dung vào chương liền trên', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BookChapterEditor chapters={chapters} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Xoá chương Chương 2' }))

    expect(onChange).toHaveBeenCalledWith([
      { title: 'Chương 1', content: 'Nội dung một.\n\nNội dung hai.' },
      chapters[2],
    ])
  })

  it('gộp chương vào chương liền trên và giữ tiêu đề chương trên', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BookChapterEditor chapters={chapters} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Gộp Chương 3 vào chương trên' }))

    expect(onChange).toHaveBeenCalledWith([
      chapters[0],
      { title: 'Chương 2', content: 'Nội dung hai.\n\nChương 3\n\nNội dung ba.' },
    ])
  })

  it('chương đầu tiên không có nút xoá hay gộp', () => {
    render(<BookChapterEditor chapters={chapters} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Xoá chương Chương 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gộp Chương 1 vào chương trên' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
npm.cmd test -- BookChapterEditor
```

Expected: FAIL, không resolve được `./BookChapterEditor`.

- [ ] **Step 3: Viết component**

`src/features/library/BookChapterEditor.tsx`:

```tsx
import { ArrowUpToLine, Trash2 } from 'lucide-react'
import type { RawChapter } from '../../lib/book/types'

type Props = {
  chapters: RawChapter[]
  onChange: (chapters: RawChapter[]) => void
}

export function BookChapterEditor({ chapters, onChange }: Props) {
  const rename = (index: number, title: string) => {
    onChange(chapters.map((chapter, i) => (i === index ? { ...chapter, title } : chapter)))
  }

  /** Xoá chương: nội dung chuyển lên chương trên, tiêu đề bỏ đi. */
  const remove = (index: number) => {
    const next = chapters.slice()
    const [removed] = next.splice(index, 1)
    next[index - 1] = {
      ...next[index - 1],
      content: `${next[index - 1].content}\n\n${removed.content}`,
    }
    onChange(next)
  }

  /** Gộp lên: giữ cả tiêu đề của chương bị gộp như một dòng trong nội dung. */
  const mergeUp = (index: number) => {
    const next = chapters.slice()
    const [merged] = next.splice(index, 1)
    next[index - 1] = {
      ...next[index - 1],
      content: `${next[index - 1].content}\n\n${merged.title}\n\n${merged.content}`,
    }
    onChange(next)
  }

  return (
    <ul className="book-chapter-editor" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
      {chapters.map((chapter, index) => (
        <li
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 10,
            border: '1px solid var(--card-border)',
            background: 'var(--card-bg)',
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 22 }}>
            {index + 1}
          </span>
          <input
            aria-label={`Tên chương ${index + 1}`}
            value={chapter.title}
            onChange={(event) => rename(index, event.target.value)}
            style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: 600 }}
          />
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {chapter.content.length.toLocaleString('vi-VN')} ký tự
          </span>
          {index > 0 && (
            <>
              <button
                className="icon small"
                aria-label={`Gộp ${chapter.title} vào chương trên`}
                title="Gộp vào chương trên"
                onClick={() => mergeUp(index)}
                style={{ padding: 3 }}
              >
                <ArrowUpToLine size={13} />
              </button>
              <button
                className="icon small danger"
                aria-label={`Xoá chương ${chapter.title}`}
                title="Xoá chương, giữ nội dung"
                onClick={() => remove(index)}
                style={{ padding: 3 }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
npm.cmd test -- BookChapterEditor
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/BookChapterEditor.tsx src/features/library/BookChapterEditor.test.tsx
git commit -m "feat: add editable chapter list for book import"
```

---

### Task 10: Modal nhập sách

**Files:**
- Create: `src/features/library/BookImportModal.tsx`

- [ ] **Step 1: Viết component**

`src/features/library/BookImportModal.tsx`:

```tsx
import { useRef, useState } from 'react'
import { BookOpen, FileUp, Loader2 } from 'lucide-react'
import { Modal } from '../shared'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { saveBook } from '../../lib/book/repository'
import type { Media } from '../../types'
import type { ExtractProgress, RawBook, RawChapter } from '../../lib/book/types'
import { BookChapterEditor } from './BookChapterEditor'

type Stage = 'pick' | 'working' | 'preview' | 'saving'

type Props = {
  /** Sách BOOK đã có trong thư viện nhưng chưa nhập nội dung. */
  attachableBooks: Media[]
  onClose: () => void
  onImported: (mediaItemId: string, createdItem: Media | null) => void
}

const PHASE_LABEL: Record<ExtractProgress['phase'], string> = {
  reading: 'Đang đọc file',
  extracting: 'Đang bóc tách',
  splitting: 'Đang chia chương',
}

export function BookImportModal({ attachableBooks, onClose, onImported }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('pick')
  const [progress, setProgress] = useState<ExtractProgress | null>(null)
  const [error, setError] = useState('')
  const [book, setBook] = useState<RawBook | null>(null)
  const [chapters, setChapters] = useState<RawChapter[]>([])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [target, setTarget] = useState('NEW')

  const totalChars = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)

  const handleFile = async (file: File) => {
    setError('')
    setStage('working')
    setProgress({ phase: 'reading', current: 0, total: 1 })
    try {
      // Nạp động: pdfjs và jszip chỉ tải khi người dùng thực sự nhập sách.
      const { extractBook } = await import('../../lib/book')
      const result = await extractBook(file, setProgress)
      setBook(result)
      setChapters(result.chapters)
      setTitle(result.title)
      setAuthor(result.author ?? '')
      setStage('preview')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không xử lý được file này.')
      setStage('pick')
    }
  }

  const save = async () => {
    if (!book || !supabase) return
    setError('')
    setStage('saving')
    try {
      let mediaItemId = target
      let createdItem: Media | null = null

      if (target === 'NEW') {
        const { data, error: insertError } = await supabase
          .from('media_items')
          .insert({
            type: 'BOOK',
            name: title.trim() || book.title,
            author: author.trim() || null,
            status: 'IN_PROGRESS',
            is_favorite: false,
            book_format: 'READ',
            start_date: localDate(),
            log_date: localDate(),
          })
          .select()
          .single()
        if (insertError || !data) throw new Error(insertError?.message ?? 'Không tạo được mục sách.')
        createdItem = data as Media
        mediaItemId = createdItem.id
      }

      await saveBook(mediaItemId, { ...book, title: title.trim() || book.title, chapters })
      onImported(mediaItemId, createdItem)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được sách.')
      setStage('preview')
    }
  }

  return (
    <Modal title="📥 Nhập sách từ PDF / EPUB" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        {error && (
          <p
            style={{
              margin: 0,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--rose-bg)',
              color: 'var(--rose)',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}

        {stage === 'pick' && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void handleFile(file)
              }}
            />
            <button
              className="primary"
              onClick={() => fileInput.current?.click()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 }}
            >
              <FileUp size={18} /> Chọn file PDF hoặc EPUB
            </button>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              File được xử lý ngay trên máy bạn, chỉ phần văn bản đã bóc tách mới được lưu lên Supabase.
              Tối đa 60MB. PDF bản scan (ảnh chụp trang sách) chưa hỗ trợ.
            </p>
          </>
        )}

        {stage === 'working' && progress && (
          <div style={{ display: 'grid', gap: 8, padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.84rem' }}>
              <Loader2 size={16} className="spin" />
              {PHASE_LABEL[progress.phase]}
              {progress.total > 1 && ` ${progress.current}/${progress.total}`}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-main)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%`,
                  background: 'var(--primary)',
                  transition: 'width 0.2s',
                }}
              />
            </div>
          </div>
        )}

        {(stage === 'preview' || stage === 'saving') && book && (
          <>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tên sách</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tác giả</span>
              <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Chưa rõ" />
            </label>

            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {book.sourceFormat} · {chapters.length} chương · {totalChars.toLocaleString('vi-VN')} ký tự ·{' '}
              {book.pageCount ? `${book.pageCount} trang` : `~${Math.max(1, Math.round(totalChars / 1800))} trang ước tính`}
            </p>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Lưu vào</span>
              <select value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="NEW">➕ Tạo sách mới trong thư viện</option>
                {attachableBooks.map((item) => (
                  <option key={item.id} value={item.id}>
                    📖 {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Mục lục — sửa lại nếu chia chưa đúng
              </p>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <BookChapterEditor chapters={chapters} onChange={setChapters} />
              </div>
            </div>

            <button
              className="primary"
              disabled={stage === 'saving' || chapters.length === 0}
              onClick={() => void save()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }}
            >
              {stage === 'saving' ? <Loader2 size={16} className="spin" /> : <BookOpen size={16} />}
              {stage === 'saving' ? 'Đang lưu…' : 'Lưu và đọc ngay'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Thêm animation cho biểu tượng đang tải**

Thêm vào cuối `src/styles.css`:

```css
@keyframes bookSpin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: bookSpin 1s linear infinite;
}
```

- [ ] **Step 3: Xác nhận build và test xanh**

```bash
npm.cmd run build
npm.cmd test
```

Expected: cả hai thành công.

- [ ] **Step 4: Commit**

```bash
git add src/features/library/BookImportModal.tsx src/styles.css
git commit -m "feat: add book import modal with progress and preview"
```

---

### Task 11: Gắn vào Library

**Files:**
- Modify: `src/features/LibraryPage.tsx`

- [ ] **Step 1: Thêm import và state**

Thêm vào các dòng import ở đầu file:

```ts
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp } from 'lucide-react'
import { loadImportedMediaItemIds } from '../lib/book/repository'
import { BookImportModal } from './library/BookImportModal'
```

`useEffect` gộp vào dòng `import { useMemo, useState } from 'react'` đã có; `FileUp` gộp vào danh sách icon của `lucide-react` đã có.

Thêm vào ngay dưới các khai báo state của `LibraryPage`:

```ts
  const nav = useNavigate()
  const [importOpen, setImportOpen] = useState(false)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void loadImportedMediaItemIds().then(setImportedIds)
  }, [])
```

- [ ] **Step 2: Thêm nút "Nhập sách" vào thanh sub-tab**

Trong khối `<div className="habit-sub-tabs">`, chèn ngay **trước** nút `+ Thêm`:

```tsx
        {(selectedType === 'ALL' || selectedType === 'BOOK') && (
          <button
            onClick={() => setImportOpen(true)}
            title="Nhập sách từ file PDF hoặc EPUB"
            style={{ background: 'var(--purple)', color: 'white', fontWeight: 700, padding: '5px 4px', fontSize: '0.74rem', gap: 2 }}
          >
            <FileUp size={13} /> Nhập sách
          </button>
        )}
```

- [ ] **Step 3: Thêm nút "Đọc" lên thẻ sách**

Trong khối `{isBook && (item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') && (` có hai nút "Ghi trang" và "Lịch sử", đổi điều kiện ngoài cùng thành `{isBook && (` và chèn nút Đọc làm phần tử đầu tiên trong `<div>`, đồng thời bọc hai nút cũ bằng điều kiện trạng thái:

```tsx
        {isBook && (
          <div style={{ display: 'flex', gap: 4, paddingLeft: 28 }}>
            {importedIds.has(item.id) && (
              <button
                onClick={() => nav(`/read/${item.id}`)}
                style={{
                  fontSize: '0.64rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                  border: '1px solid var(--primary)', background: 'var(--primary)', color: 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                <BookOpen size={10} /> Đọc
              </button>
            )}
            {(item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') && (
              <>
                {/* hai nút "Ghi trang/Ghi giờ" và "Lịch sử" đang có, giữ nguyên nội dung */}
              </>
            )}
          </div>
        )}
```

Giữ nguyên toàn bộ mã của hai nút cũ, chỉ chuyển chúng vào trong `<>…</>`.

- [ ] **Step 4: Render modal nhập sách**

Chèn ngay trước thẻ đóng `</section>` cuối cùng của `LibraryPage`:

```tsx
      {importOpen && (
        <BookImportModal
          attachableBooks={items.filter((item) => item.type === 'BOOK' && !importedIds.has(item.id))}
          onClose={() => setImportOpen(false)}
          onImported={(mediaItemId, createdItem) => {
            if (createdItem) setItems((prev) => [createdItem, ...prev])
            setImportedIds((prev) => new Set(prev).add(mediaItemId))
            setImportOpen(false)
            showToast('📚 Đã nhập sách vào thư viện!')
            nav(`/read/${mediaItemId}`)
          }}
        />
      )}
```

- [ ] **Step 5: Xác nhận build và test xanh**

```bash
npm.cmd run build
npm.cmd test
```

Expected: cả hai thành công. Route `/read/:mediaItemId` chưa tồn tại nên bấm Đọc lúc này sẽ về Home — Task 13 thêm route.

- [ ] **Step 6: Commit**

```bash
git add src/features/LibraryPage.tsx
git commit -m "feat: add book import and read entry points to library"
```

---

### Task 12: Hook lưu tiến độ đọc

**Files:**
- Create: `src/features/library/useBookReadingProgress.ts`

- [ ] **Step 1: Viết hook**

`src/features/library/useBookReadingProgress.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react'
import { estimatePage, reportPagesRead, saveProgress } from '../../lib/book/repository'

const SAVE_DEBOUNCE_MS = 2000
const MIN_SAVE_INTERVAL_MS = 10_000
const READING_TICK_MS = 5000
const MIN_SECONDS_BEFORE_LOG = 60

export type ReadingPosition = {
  chapterIdx: number
  charOffset: number
  charCount: number
  ratio: number
}

type Options = {
  documentId: string | null
  mediaItemId: string
  totalChars: number
  pageCount: number | null
}

/**
 * Giữ vị trí đọc mới nhất, ghi xuống Supabase khi người dùng ngừng cuộn hoặc rời màn
 * hình, và tự ghi nhật ký đọc của hôm nay sau khi đọc đủ 60 giây.
 * Lỗi khi lưu không bao giờ chặn việc đọc.
 */
export function useBookReadingProgress({ documentId, mediaItemId, totalChars, pageCount }: Options) {
  const position = useRef<ReadingPosition | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedAt = useRef(0)
  const secondsRead = useRef(0)
  const loggedToday = useRef(false)

  const absoluteOffset = (spot: ReadingPosition) => spot.charOffset + spot.ratio * spot.charCount

  const flush = useCallback(async () => {
    const spot = position.current
    if (!documentId || !spot) return

    if (debounce.current) {
      clearTimeout(debounce.current)
      debounce.current = null
    }
    lastSavedAt.current = Date.now()

    const offset = absoluteOffset(spot)
    const percent = totalChars > 0 ? Math.min(100, Math.max(0, (offset / totalChars) * 100)) : 0

    try {
      await saveProgress(documentId, {
        last_chapter_idx: spot.chapterIdx,
        last_scroll_ratio: Math.min(1, Math.max(0, spot.ratio)),
        last_char_offset: Math.round(offset),
        percent,
      })
      if (loggedToday.current) {
        await reportPagesRead(mediaItemId, estimatePage(offset, totalChars, pageCount))
      }
    } catch (error) {
      // Không chặn việc đọc; lần lưu kế tiếp sẽ thử lại.
      console.warn('Không lưu được tiến độ đọc', error)
    }
  }, [documentId, mediaItemId, pageCount, totalChars])

  const report = useCallback(
    (spot: ReadingPosition) => {
      position.current = spot
      if (!documentId) return

      if (debounce.current) clearTimeout(debounce.current)
      const sinceLastSave = Date.now() - lastSavedAt.current
      const delay = Math.max(SAVE_DEBOUNCE_MS, MIN_SAVE_INTERVAL_MS - sinceLastSave)
      debounce.current = setTimeout(() => void flush(), delay)
    },
    [documentId, flush],
  )

  // Đếm thời gian đọc thực tế, chỉ khi tab đang hiển thị.
  useEffect(() => {
    if (!documentId) return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      secondsRead.current += READING_TICK_MS / 1000
      if (loggedToday.current || secondsRead.current < MIN_SECONDS_BEFORE_LOG) return

      loggedToday.current = true
      const spot = position.current
      const offset = spot ? absoluteOffset(spot) : 0
      void reportPagesRead(mediaItemId, estimatePage(offset, totalChars, pageCount)).catch((error) => {
        loggedToday.current = false
        console.warn('Không ghi được nhật ký đọc', error)
      })
    }, READING_TICK_MS)

    return () => clearInterval(timer)
  }, [documentId, mediaItemId, pageCount, totalChars])

  // Ghi ngay khi ẩn tab, và một lần cuối khi rời màn hình.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      void flush()
    }
  }, [flush])

  return { report, flush }
}
```

- [ ] **Step 2: Xác nhận build xanh**

```bash
npm.cmd run build
```

Expected: thành công.

- [ ] **Step 3: Commit**

```bash
git add src/features/library/useBookReadingProgress.ts
git commit -m "feat: add reading progress hook with auto daily log"
```

---

### Task 13: Màn hình đọc và route

**Files:**
- Create: `src/features/library/BookReaderPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Thêm CSS cho màn hình đọc**

Thêm vào cuối `src/styles.css`:

```css
/* ---------- Book reader ---------- */
.book-reader {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--reader-bg);
  color: var(--reader-text);
}
.book-reader[data-reader-theme='light'] { --reader-bg: #ffffff; --reader-text: #1f2937; --reader-muted: #6b7280; --reader-line: #e5e7eb; }
.book-reader[data-reader-theme='sepia'] { --reader-bg: #f6efe1; --reader-text: #43382a; --reader-muted: #8a7a63; --reader-line: #e0d4bd; }
.book-reader[data-reader-theme='dark']  { --reader-bg: #14171c; --reader-text: #d8dbe0; --reader-muted: #8b93a1; --reader-line: #2a2f38; }

.book-reader-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--reader-line);
  background: var(--reader-bg);
  transition: transform 0.2s ease;
}
.book-reader-bar[data-hidden='true'] { transform: translateY(-100%); position: absolute; width: 100%; }
.book-reader-bar button { background: transparent; border: 0; color: var(--reader-text); cursor: pointer; padding: 4px; display: flex; }
.book-reader-title { flex: 1; min-width: 0; font-weight: 700; font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.book-reader-progress { height: 3px; background: var(--reader-line); }
.book-reader-progress > div { height: 100%; background: var(--primary); transition: width 0.2s; }

.book-reader-content { flex: 1; overflow-y: auto; padding: 20px 18px 64px; }
.book-reader-page { max-width: 68ch; margin: 0 auto; }
.book-reader-page h1 { font-size: 1.15rem; margin: 0 0 18px; line-height: 1.4; }
.book-reader-page p { margin: 0 0 1em; text-align: justify; overflow-wrap: break-word; }

.book-reader-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 28px; }
.book-reader-nav button { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--reader-line); background: transparent; color: var(--reader-text); font-weight: 600; font-size: 0.78rem; cursor: pointer; }
.book-reader-nav button:disabled { opacity: 0.4; cursor: default; }
.book-reader-nav span { font-size: 0.72rem; color: var(--reader-muted); white-space: nowrap; }

.book-reader-drawer { position: absolute; inset: 0; z-index: 2; display: flex; }
.book-reader-drawer > nav { width: min(300px, 82%); background: var(--reader-bg); border-right: 1px solid var(--reader-line); overflow-y: auto; padding: 12px; }
.book-reader-drawer > button { flex: 1; border: 0; background: rgba(0, 0, 0, 0.4); cursor: pointer; }
.book-reader-toc-item { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--reader-text); font-size: 0.78rem; cursor: pointer; }
.book-reader-toc-item[aria-current='true'] { background: var(--primary-light); color: var(--primary); font-weight: 700; }

.book-reader-settings { position: absolute; top: 46px; right: 10px; z-index: 3; width: 240px; padding: 12px; border-radius: 12px; border: 1px solid var(--reader-line); background: var(--reader-bg); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18); display: grid; gap: 10px; }
.book-reader-settings label { font-size: 0.72rem; font-weight: 700; color: var(--reader-muted); display: grid; gap: 4px; }
.book-reader-settings .book-reader-choices { display: flex; gap: 4px; }
.book-reader-settings .book-reader-choices button { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid var(--reader-line); background: transparent; color: var(--reader-text); font-size: 0.72rem; font-weight: 600; cursor: pointer; }
.book-reader-settings .book-reader-choices button[aria-pressed='true'] { border-color: var(--primary); color: var(--primary); font-weight: 700; }
```

- [ ] **Step 2: Viết màn hình đọc**

`src/features/library/BookReaderPage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, List, Type } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { loadLocal, saveLocal } from '../../lib/persistence'
import {
  loadBookDocument,
  loadChapterList,
  loadChapterContent,
} from '../../lib/book/repository'
import type { BookChapterMeta, BookDocument } from '../../types'
import { useBookReadingProgress } from './useBookReadingProgress'

type ReaderTheme = 'light' | 'sepia' | 'dark'
type ReaderFont = 'sans' | 'serif'

type ReaderSettings = {
  fontSize: number
  lineHeight: number
  font: ReaderFont
  theme: ReaderTheme
}

const SETTINGS_KEY = 'book-reader-settings'
const DEFAULT_SETTINGS: ReaderSettings = { fontSize: 17, lineHeight: 1.8, font: 'serif', theme: 'light' }

export function BookReaderPage() {
  const { mediaItemId = '' } = useParams()
  const nav = useNavigate()
  const scroller = useRef<HTMLDivElement>(null)
  const pendingRatio = useRef<number | null>(null)

  const [document_, setDocument_] = useState<BookDocument | null>(null)
  const [chapters, setChapters] = useState<BookChapterMeta[]>([])
  const [bookName, setBookName] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [contentByIdx, setContentByIdx] = useState<Record<number, string>>({})
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [percent, setPercent] = useState(0)
  const [tocOpen, setTocOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [barHidden, setBarHidden] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>(() => loadLocal(SETTINGS_KEY, DEFAULT_SETTINGS))

  const activeChapter = chapters[activeIdx]
  const content = contentByIdx[activeIdx]

  const { report, flush } = useBookReadingProgress({
    documentId: document_?.id ?? null,
    mediaItemId,
    totalChars: document_?.total_chars ?? 0,
    pageCount: document_?.page_count ?? null,
  })

  useEffect(() => saveLocal(SETTINGS_KEY, settings), [settings])

  // Nạp tài liệu, mục lục và tên sách.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!supabase || !mediaItemId) {
        setStatus('missing')
        return
      }
      try {
        const doc = await loadBookDocument(mediaItemId)
        if (!doc) {
          if (!cancelled) setStatus('missing')
          return
        }
        const list = await loadChapterList(doc.id)
        const { data: item } = await supabase.from('media_items').select('name, status').eq('id', mediaItemId).single()
        if (cancelled) return

        setDocument_(doc)
        setChapters(list)
        setBookName((item as { name?: string } | null)?.name ?? 'Đang đọc')
        setActiveIdx(Math.min(doc.last_chapter_idx, Math.max(0, list.length - 1)))
        setPercent(doc.percent)
        pendingRatio.current = doc.last_scroll_ratio
        setStatus('ready')

        if ((item as { status?: string } | null)?.status === 'PLANNED') {
          void supabase.from('media_items').update({ status: 'IN_PROGRESS' }).eq('id', mediaItemId)
        }
      } catch {
        if (!cancelled) setStatus('missing')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [mediaItemId])

  // Nạp nội dung chương đang đọc.
  const fetchChapter = useCallback(
    async (idx: number) => {
      const chapter = chapters[idx]
      if (!chapter) return
      setLoadError('')
      try {
        const text = await loadChapterContent(chapter.id)
        setContentByIdx((prev) => ({ ...prev, [idx]: text }))
      } catch {
        setLoadError('Không tải được nội dung chương này.')
      }
    },
    [chapters],
  )

  useEffect(() => {
    if (chapters.length > 0 && contentByIdx[activeIdx] === undefined) void fetchChapter(activeIdx)
  }, [activeIdx, chapters, contentByIdx, fetchChapter])

  // Khôi phục vị trí cuộn sau khi nội dung chương đã render.
  useEffect(() => {
    const ratio = pendingRatio.current
    const node = scroller.current
    if (ratio === null || content === undefined || !node) return
    pendingRatio.current = null
    requestAnimationFrame(() => {
      node.scrollTop = ratio * Math.max(0, node.scrollHeight - node.clientHeight)
    })
  }, [content])

  const lastScrollTop = useRef(0)
  const onScroll = () => {
    const node = scroller.current
    if (!node || !activeChapter || !document_) return

    const scrollable = Math.max(1, node.scrollHeight - node.clientHeight)
    const ratio = Math.min(1, Math.max(0, node.scrollTop / scrollable))

    setBarHidden(node.scrollTop > lastScrollTop.current && node.scrollTop > 80)
    lastScrollTop.current = node.scrollTop

    const offset = activeChapter.char_offset + ratio * activeChapter.char_count
    const next = document_.total_chars > 0 ? Math.min(100, (offset / document_.total_chars) * 100) : 0
    setPercent(next)
    setCompleted(activeIdx === chapters.length - 1 && ratio > 0.98)

    report({ chapterIdx: activeIdx, charOffset: activeChapter.char_offset, charCount: activeChapter.char_count, ratio })
  }

  const goToChapter = (idx: number) => {
    if (idx < 0 || idx >= chapters.length) return
    void flush()
    setActiveIdx(idx)
    setTocOpen(false)
    setCompleted(false)
    lastScrollTop.current = 0
    setBarHidden(false)
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0 }))
  }

  const markCompleted = async () => {
    if (!supabase) return
    await supabase.from('media_items').update({ status: 'COMPLETED' }).eq('id', mediaItemId)
    nav('/library')
  }

  const paragraphs = useMemo(() => (content ? content.split('\n\n') : []), [content])

  if (status === 'loading') return <div className="center">Đang mở sách…</div>

  if (status === 'missing') {
    return (
      <div className="center" style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
        <p style={{ margin: 0 }}>Sách này chưa có nội dung đã nhập.</p>
        <button className="primary" onClick={() => nav('/library')}>
          Quay lại thư viện
        </button>
      </div>
    )
  }

  return (
    <div className="book-reader" data-reader-theme={settings.theme}>
      <div className="book-reader-bar" data-hidden={barHidden}>
        <button
          aria-label="Quay lại thư viện"
          onClick={() => {
            void flush()
            nav('/library')
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <span className="book-reader-title">{bookName}</span>
        <button aria-label="Mục lục" onClick={() => setTocOpen(true)}>
          <List size={20} />
        </button>
        <button aria-label="Cỡ chữ và giao diện" onClick={() => setSettingsOpen((open) => !open)}>
          <Type size={20} />
        </button>
      </div>

      <div className="book-reader-progress">
        <div style={{ width: `${percent.toFixed(1)}%` }} />
      </div>

      {settingsOpen && (
        <div className="book-reader-settings">
          <label>
            Cỡ chữ — {settings.fontSize}px
            <input
              type="range"
              min={14}
              max={24}
              step={1}
              value={settings.fontSize}
              onChange={(event) => setSettings({ ...settings, fontSize: Number(event.target.value) })}
            />
          </label>
          <label>
            Giãn dòng — {settings.lineHeight.toFixed(1)}
            <input
              type="range"
              min={1.5}
              max={2.1}
              step={0.1}
              value={settings.lineHeight}
              onChange={(event) => setSettings({ ...settings, lineHeight: Number(event.target.value) })}
            />
          </label>
          <label>
            Kiểu chữ
            <span className="book-reader-choices">
              {(['sans', 'serif'] as ReaderFont[]).map((font) => (
                <button
                  key={font}
                  aria-pressed={settings.font === font}
                  onClick={() => setSettings({ ...settings, font })}
                >
                  {font === 'sans' ? 'Sans' : 'Serif'}
                </button>
              ))}
            </span>
          </label>
          <label>
            Nền
            <span className="book-reader-choices">
              {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((theme) => (
                <button
                  key={theme}
                  aria-pressed={settings.theme === theme}
                  onClick={() => setSettings({ ...settings, theme })}
                >
                  {theme === 'light' ? 'Sáng' : theme === 'sepia' ? 'Sepia' : 'Tối'}
                </button>
              ))}
            </span>
          </label>
        </div>
      )}

      {tocOpen && (
        <div className="book-reader-drawer">
          <nav aria-label="Mục lục">
            {chapters.map((chapter, idx) => (
              <button
                key={chapter.id}
                className="book-reader-toc-item"
                aria-current={idx === activeIdx}
                onClick={() => goToChapter(idx)}
              >
                {idx + 1}. {chapter.title}
              </button>
            ))}
          </nav>
          <button aria-label="Đóng mục lục" onClick={() => setTocOpen(false)} />
        </div>
      )}

      <div
        className="book-reader-content"
        ref={scroller}
        onScroll={onScroll}
        style={{
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
          fontFamily: settings.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'inherit',
        }}
      >
        <article className="book-reader-page">
          <h1>{activeChapter?.title}</h1>

          {loadError && (
            <p style={{ color: 'var(--rose)' }}>
              {loadError}{' '}
              <button onClick={() => void fetchChapter(activeIdx)} style={{ textDecoration: 'underline' }}>
                Tải lại
              </button>
            </p>
          )}

          {content === undefined && !loadError && <p style={{ opacity: 0.6 }}>Đang tải chương…</p>}

          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}

          {completed && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--reader-line)',
                display: 'grid',
                gap: 10,
                textAlign: 'center',
              }}
            >
              <strong>🎉 Bạn đã đọc hết cuốn sách này</strong>
              <button
                className="primary"
                onClick={() => void markCompleted()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <CheckCircle2 size={16} /> Đánh dấu đã đọc xong
              </button>
            </div>
          )}

          <div className="book-reader-nav">
            <button disabled={activeIdx === 0} onClick={() => goToChapter(activeIdx - 1)}>
              ‹ Chương trước
            </button>
            <span>
              {activeIdx + 1}/{chapters.length}
            </span>
            <button disabled={activeIdx >= chapters.length - 1} onClick={() => goToChapter(activeIdx + 1)}>
              Chương sau ›
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Đăng ký route ngoài `Shell`**

Trong `src/App.tsx`, thêm import:

```ts
import { BookReaderPage } from './features/library/BookReaderPage'
```

Thay khối `return (...)` của hàm `Protected` bằng:

```tsx
  return (
    <ToastProvider>
      <Routes>
        {/* Màn hình đọc chiếm trọn màn hình, nằm ngoài Shell để không bị header và bottom nav che. */}
        <Route path="/read/:mediaItemId" element={<BookReaderPage />} />
        <Route
          path="*"
          element={
            <Shell>
              <Routes>
                <Route path="/home" element={<HomePage />} />
                <Route path="/habit" element={<HabitsPage />} />
                <Route path="/daily" element={<DailyPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/playtogether" element={<PlayTogetherPage />} />
                <Route path="/nutrition" element={<NutritionPage />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </Shell>
          }
        />
      </Routes>
    </ToastProvider>
  )
```

- [ ] **Step 4: Xác nhận build và test xanh**

```bash
npm.cmd run build
npm.cmd test
```

Expected: cả hai thành công.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/BookReaderPage.tsx src/App.tsx src/styles.css
git commit -m "feat: add full-screen book reader with toc and settings"
```

---

### Task 14: Kiểm thử tay và chốt tài liệu

**Files:**
- Modify: `docs/superpowers/plans/2026-08-12-book-reader.md` (tick checklist)

- [ ] **Step 1: Chạy toàn bộ kiểm tra tự động**

```bash
npm.cmd test
npm.cmd run build
```

Expected: mọi test pass, build thành công.

- [ ] **Step 2: Chạy app và kiểm thử tay**

```bash
npm.cmd run dev
```

Mở `http://localhost:5173/library`, chọn mục Books, rồi lần lượt xác nhận:

- [ ] Nút "Nhập sách" hiện khi đang ở Books và ở "Tất cả thể loại", ẩn khi chọn Movies.
- [ ] Chọn một file `.txt` → báo "Chỉ hỗ trợ file PDF và EPUB."
- [ ] Chọn một PDF có lớp văn bản → thanh tiến trình chạy, giao diện không đơ.
- [ ] Màn hình xem trước hiện đúng tên sách, tác giả, số chương, số chữ, số trang.
- [ ] Đổi tên một chương, xoá một chương, gộp một chương — danh sách cập nhật đúng.
- [ ] Bấm "Lưu và đọc ngay" → sách xuất hiện trong thư viện và app nhảy vào màn hình đọc.
- [ ] Trong màn hình đọc: mục lục mở được, bấm chương nhảy đúng và cuộn lên đầu.
- [ ] Đổi cỡ chữ, giãn dòng, kiểu chữ, và cả ba nền — nội dung đọc được ở cả ba nền.
- [ ] Cuộn xuống → thanh trên tự ẩn; cuộn lên → hiện lại; thanh phần trăm tăng dần.
- [ ] Thoát ra Library rồi bấm "Đọc" lại → về đúng chương và đúng vị trí cuộn, không nhảy về đầu.
- [ ] Đọc liên tục hơn 60 giây, quay lại Library, mở "Lịch sử" của sách đó → có dòng của hôm nay với số trang hợp lý.
- [ ] Ghi tiến độ tay hai lần cho cùng một ngày → "Lịch sử" chỉ có một dòng cho ngày đó, không bị trùng.
- [ ] Nhập một file EPUB → mục lục lấy đúng từ TOC của sách.
- [ ] Nhập một PDF bản scan → báo "File này là bản scan (ảnh chụp), chưa hỗ trợ."

Với mỗi mục không đạt: sửa, chạy lại `npm.cmd test` và `npm.cmd run build`, rồi commit riêng.

- [ ] **Step 3: Commit kết quả kiểm thử**

```bash
git add docs/superpowers/plans/2026-08-12-book-reader.md
git commit -m "docs: record book reader manual test results"
```

---

## Self-Review

**Spec coverage:** Mục tiêu và phạm vi → Task 1–13. Hai bảng DB → Task 2. Bóc tách PDF, phát hiện bản scan, dò chương theo bookmark → Task 5. EPUB và TOC → Task 6. Làm sạch văn bản → Task 3. Chia chương và tách chương dài → Task 4. Chặn file lớn/sai định dạng/nội dung rỗng → Task 7. Lưu theo lô 20 chương và dọn dẹp khi lỗi giữa chừng → Task 8. Sửa lỗi upsert nhật ký → Task 8. Sửa mục lục → Task 9. Luồng nhập và chọn đích lưu → Task 10. Nút Nhập sách và nút Đọc → Task 11. Lưu vị trí, chặn ghi dày, auto-log 60 giây → Task 12. Màn hình đọc, mục lục, cài đặt, khôi phục vị trí, thẻ đọc xong, route ngoài Shell → Task 13. Kiểm thử → Task 3, 4, 9, 14.

**Ngoài phạm vi có chủ ý:** OCR, lưu file gốc, highlight/ghi chú, đọc offline, định dạng khác — đúng như spec đã ghi.
