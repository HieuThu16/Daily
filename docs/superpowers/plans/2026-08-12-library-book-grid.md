# Library Book Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mục Books trong Library đổi từ danh sách dòng chật chội sang lưới bìa sách, chữ nhỏ, chỉ giữ những gì cần khi lướt.

**Architecture:** Component mới `BookGrid` không giữ state và không query gì — `LibraryPage` truyền dữ liệu và hai callback xuống. `BookCover` sẵn có được thêm một cỡ. Vì dropdown trạng thái bị bỏ khỏi thẻ, `BookDetailView` nhận thêm dropdown đó để không mất thao tác nhanh.

**Tech Stack:** React 18 + TypeScript + Vite, `lucide-react`, Vitest 4 + jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-12-library-book-grid-design.md`

---

## Ghi chú cho người thực hiện

- Chạy toàn bộ test: `npm test`. Một file: `npm test -- <đường dẫn>`.
- Test đặt cạnh file nguồn. Chữ hiển thị và comment viết bằng tiếng Việt.
- Worktree có một file lạ chưa track: `src/features/HomePage.tsx`. Đừng add, đừng xoá, đừng đụng vào.
- Luôn `git add` đường dẫn tường minh. Không dùng `git add -A` hay `git add .`.
- Trạng thái xuất phát: 17 file test, 131 test, build xanh.

---

## Task 1: `BookCover` thêm cỡ `grid`

**Files:**
- Modify: `src/features/library/BookCover.tsx`
- Test: `src/features/library/BookCover.test.tsx`

- [ ] **Step 1: Thêm test cho cỡ mới**

Thêm vào cuối `describe('BookCover', …)` trong `src/features/library/BookCover.test.tsx`:

```tsx
  it('dùng được cỡ grid cho ô bìa trong lưới', () => {
    const { container, rerender } = render(
      <BookCover url="https://example.com/bia.jpg" alt="Bìa" size="grid" />,
    )
    expect(screen.getByRole('img', { name: 'Bìa' })).toHaveClass('book-cover-grid')

    rerender(<BookCover url={null} alt="Bìa" size="grid" />)
    expect(container.querySelector('.book-cover-placeholder')).toHaveClass('book-cover-grid')
  })
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/features/library/BookCover.test.tsx`
Expected: FAIL — TypeScript từ chối `size="grid"` vì union chưa có giá trị đó.

- [ ] **Step 3: Thêm `grid` vào union và bảng cỡ icon**

Trong `src/features/library/BookCover.tsx`, sửa type và phần placeholder:

```tsx
/** Cỡ icon của placeholder theo từng ô. Ô càng lớn thì icon càng lớn cho cân. */
const PLACEHOLDER_ICON: Record<BookCoverProps['size'], number> = {
  thumb: 19,
  grid: 28,
  large: 34,
}

type BookCoverProps = {
  url: string | null | undefined
  alt: string
  /** `thumb` cho thẻ dạng dòng, `grid` cho ô trong lưới sách, `large` cho màn chi tiết. */
  size: 'thumb' | 'grid' | 'large'
}
```

Khai báo `type BookCoverProps` **trước** `PLACEHOLDER_ICON` để `Record<BookCoverProps['size'], number>` phân giải được.

Rồi thay dòng icon:

```tsx
        <BookOpen size={PLACEHOLDER_ICON[size]} />
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `npm test -- src/features/library/BookCover.test.tsx`
Expected: PASS — 5 test.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/BookCover.tsx src/features/library/BookCover.test.tsx
git commit -m "feat: add grid size to book cover"
```

---

## Task 2: Component `BookGrid`

**Files:**
- Create: `src/features/library/BookGrid.tsx`
- Test: `src/features/library/BookGrid.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/features/library/BookGrid.test.tsx`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Media } from '../../types'
import { BookGrid } from './BookGrid'

afterEach(cleanup)

const book = (overrides: Partial<Media> & Pick<Media, 'id' | 'name'>): Media => ({
  type: 'BOOK',
  description: null,
  status: 'IN_PROGRESS',
  is_favorite: false,
  book_format: 'READ',
  ...overrides,
})

const items: Media[] = [
  book({ id: 'b1', name: 'Đắc Nhân Tâm', author: 'Dale Carnegie', cover_url: 'https://e.com/1.jpg' }),
  book({ id: 'b2', name: 'Nhà Giả Kim', author: 'Paulo Coelho', status: 'COMPLETED', is_favorite: true }),
  book({ id: 'b3', name: 'Sách nói', status: 'PLANNED', book_format: 'LISTEN' }),
]

describe('BookGrid', () => {
  it('vẽ một ô cho mỗi sách', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
  })

  it('ghép trạng thái bằng chữ vào nhãn nút bìa, không chỉ dựa vào màu chấm', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm, đang đọc' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem chi tiết Nhà Giả Kim, đã đọc' })).toBeInTheDocument()
  })

  it('dùng nhãn nghe cho sách định dạng LISTEN', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Xem chi tiết Sách nói, sẽ nghe' })).toBeInTheDocument()
  })

  it('bấm ô bìa mở đúng sách', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<BookGrid items={items} onOpen={onOpen} onToggleFavorite={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Nhà Giả Kim, đã đọc' }))

    expect(onOpen).toHaveBeenCalledWith(items[1])
  })

  it('bấm tim không mở màn chi tiết', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onToggleFavorite = vi.fn()
    render(<BookGrid items={items} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />)

    await user.click(screen.getByRole('button', { name: 'Yêu thích Đắc Nhân Tâm' }))

    expect(onToggleFavorite).toHaveBeenCalledWith(items[0])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('nút tim phản ánh trạng thái yêu thích', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Yêu thích Đắc Nhân Tâm' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Bỏ yêu thích Nhà Giả Kim' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sách chưa có tác giả vẫn hiện một dòng thay chỗ', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByText('Chưa rõ tác giả')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/features/library/BookGrid.test.tsx`
Expected: FAIL — `Failed to resolve import "./BookGrid"`.

- [ ] **Step 3: Viết implementation**

Tạo `src/features/library/BookGrid.tsx`:

```tsx
import { Heart } from 'lucide-react'
import type { Media } from '../../types'
import { BookCover } from './BookCover'

type BookGridProps = {
  items: Media[]
  onOpen: (item: Media) => void
  onToggleFavorite: (item: Media) => void
}

/** Nhãn chữ của trạng thái, cặp [đọc, nghe] theo `book_format`. */
const STATUS_LABEL: Record<Media['status'], [string, string]> = {
  PLANNED: ['sẽ đọc', 'sẽ nghe'],
  IN_PROGRESS: ['đang đọc', 'đang nghe'],
  COMPLETED: ['đã đọc', 'đã nghe'],
}

export function BookGrid({ items, onOpen, onToggleFavorite }: BookGridProps) {
  return (
    <ul className="book-grid">
      {items.map((item) => {
        const statusLabel = STATUS_LABEL[item.status][item.book_format === 'LISTEN' ? 1 : 0]
        const favoriteLabel = `${item.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'} ${item.name}`

        return (
          <li key={item.id} className="book-grid-cell">
            {/* Nút bìa và nút tim là anh em, không lồng nhau: nút trong nút là HTML không
                hợp lệ và làm screen reader không tới được nút bên trong. */}
            <button
              type="button"
              className="book-grid-cover"
              aria-label={`Xem chi tiết ${item.name}, ${statusLabel}`}
              onClick={() => onOpen(item)}
            >
              {/* alt rỗng vì tên sách đã nằm trong aria-label của nút, để alt nữa thì đọc hai lần. */}
              <BookCover url={item.cover_url} alt="" size="grid" />
            </button>

            <button
              type="button"
              className={'book-grid-fav' + (item.is_favorite ? ' on' : '')}
              aria-label={favoriteLabel}
              aria-pressed={item.is_favorite}
              onClick={() => onToggleFavorite(item)}
            >
              <Heart size={14} fill={item.is_favorite ? 'currentColor' : 'none'} />
            </button>

            <p className="book-grid-title">
              {/* Chấm màu là thông tin truyền bằng màu sắc, nên ẩn khỏi screen reader —
                  nhãn chữ tương ứng đã có trong aria-label của nút bìa. */}
              <span className="book-grid-dot" data-status={item.status} aria-hidden="true" />
              {item.name}
            </p>
            <p className="book-grid-author">{item.author || 'Chưa rõ tác giả'}</p>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `npm test -- src/features/library/BookGrid.test.tsx`
Expected: PASS — 7 test.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/BookGrid.tsx src/features/library/BookGrid.test.tsx
git commit -m "feat: add book cover grid component"
```

---

## Task 3: Dropdown trạng thái ở màn chi tiết

**Files:**
- Modify: `src/features/library/BookDetailView.tsx`
- Test: `src/features/library/BookDetailView.test.tsx`

Bỏ dropdown khỏi thẻ thì phải bù lại ở đây, nếu không muốn đổi trạng thái phải mở thêm modal Sửa.

- [ ] **Step 1: Viết test thất bại**

Trong `src/features/library/BookDetailView.test.tsx`, mọi lời gọi `render(<BookDetailView … />)` hiện thiếu prop mới. Thêm một `describe` vào cuối file:

```tsx
describe('BookDetailView đổi trạng thái', () => {
  it('chọn trạng thái mới gọi onStatusChange', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    render(
      <BookDetailView
        item={item}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onCoverChange={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'COMPLETED')

    expect(onStatusChange).toHaveBeenCalledWith(item, 'COMPLETED')
  })

  it('sách định dạng LISTEN dùng nhãn nghe', async () => {
    render(
      <BookDetailView
        item={{ ...item, book_format: 'LISTEN' }}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onCoverChange={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    expect(screen.getByRole('option', { name: 'Đang nghe' })).toBeInTheDocument()
  })
})
```

Đồng thời thêm `onStatusChange={vi.fn()}` vào **mọi** lời gọi `render(<BookDetailView … />)` đã có trong file, nếu không TypeScript sẽ báo thiếu prop.

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/features/library/BookDetailView.test.tsx`
Expected: FAIL — không tìm thấy phần tử có nhãn `Trạng thái`.

- [ ] **Step 3: Thêm prop và dropdown**

Trong `src/features/library/BookDetailView.tsx`, thêm vào type props:

```tsx
  onStatusChange: (item: Media, status: Media['status']) => void
```

và vào tham số huỷ cấu trúc của component: `{ item, onBack, onEdit, onCoverChange, onStatusChange }`.

Bảng nhãn `STATUS_LABEL` đã có sẵn trong file với dạng `Record<Media['status'], [string, string]>`. Thay khối badges:

```tsx
            <div className="library-book-badges">
              <span>{listen ? '🎧 Nghe' : '📖 Đọc'}</span>
              <span>{statusLabel}</span>
              {item.is_favorite && <span>♥ Yêu thích</span>}
            </div>
```

bằng:

```tsx
            <div className="library-book-badges">
              <span>{listen ? '🎧 Nghe' : '📖 Đọc'}</span>
              {item.is_favorite && <span>♥ Yêu thích</span>}
              {/* Thẻ sách trong lưới không còn dropdown trạng thái, nên nó nằm ở đây —
                  không thì muốn đánh dấu đã đọc phải mở thêm modal Sửa. */}
              <select
                className="library-book-status"
                aria-label="Trạng thái"
                value={item.status}
                onChange={(event) => onStatusChange(item, event.target.value as Media['status'])}
              >
                {(['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status][listen ? 1 : 0]}
                  </option>
                ))}
              </select>
            </div>
```

`STATUS_LABEL` trong file này đã viết hoa chữ đầu (`['Sẽ đọc', 'Sẽ nghe']`, `['Đang đọc', 'Đang nghe']`, `['Đã đọc', 'Đã nghe']`), khớp với test khẳng định `'Đang nghe'`. Dùng lại nguyên bảng đó, đừng khai bảng mới. Biến `statusLabel` sẵn có vẫn được `aria-label` và các chỗ khác dùng, giữ nguyên.

Lưu ý `BookGrid` có bảng nhãn riêng viết thường (`'đang đọc'`) vì nó ghép vào giữa câu `aria-label`. Hai bảng khác nhau về cách viết hoa là có chủ đích, đừng gộp.

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `npm test -- src/features/library/BookDetailView.test.tsx`
Expected: PASS — 14 test.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/BookDetailView.tsx src/features/library/BookDetailView.test.tsx
git commit -m "feat: change book status from the detail view"
```

---

## Task 4: Nối lưới vào LibraryPage

**Files:**
- Modify: `src/features/LibraryPage.tsx`
- Test: `src/features/LibraryPage.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe('LibraryPage book navigation', …)` trong `src/features/LibraryPage.test.tsx`:

```tsx
  it('mục Books hiện lưới bìa thay cho danh sách dòng', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    // Tab "Tất cả" mặc định: sách vẫn là thẻ dạng dòng.
    expect(document.querySelector('.book-grid')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Books' }))

    expect(document.querySelector('.book-grid')).toBeInTheDocument()
    expect(document.querySelector('.library-media-card')).not.toBeInTheDocument()
  })

  it('bấm ô bìa trong lưới mở màn chi tiết', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Books' }))
    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm, đang đọc' }))

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

Run: `npm test -- src/features/LibraryPage.test.tsx`
Expected: FAIL — không tìm thấy `.book-grid` sau khi chọn mục Books.

- [ ] **Step 3: Thêm import**

Cạnh các import `./library/...` đã có trong `src/features/LibraryPage.tsx`:

```tsx
import { BookGrid } from './library/BookGrid'
```

- [ ] **Step 4: Render lưới ở hai sub-tab**

`filteredOverviewItems.map(renderMediaRow)` (khoảng dòng 1046) đổi thành:

```tsx
              {selectedType === 'BOOK' ? (
                <BookGrid
                  items={filteredOverviewItems}
                  onOpen={(item) => setSelectedBookItemId(item.id)}
                  onToggleFavorite={(item) =>
                    patchStatusOrFavorite(item.id, { is_favorite: !item.is_favorite })
                  }
                />
              ) : (
                filteredOverviewItems.map(renderMediaRow)
              )}
```

`favoriteItems.map(renderMediaRow)` (khoảng dòng 1071) đổi tương tự, thay `filteredOverviewItems` bằng `favoriteItems`.

- [ ] **Step 5: Truyền `onStatusChange` xuống màn chi tiết**

Trong nhánh `if (selectedBookItem) { return <BookDetailView … /> }`, thêm prop:

```tsx
        onStatusChange={(item, status) => patchStatusOrFavorite(item.id, { status })}
```

- [ ] **Step 6: Chạy test**

Run: `npm test -- src/features/LibraryPage.test.tsx`
Expected: PASS — 8 test.

- [ ] **Step 7: Build và toàn bộ test**

Run: `npm run build` rồi `npm test`
Expected: cả hai PASS. Tổng: 18 file, 143 test (131 + 1 ở Task 1 + 7 ở Task 2 + 2 ở Task 3 + 2 ở Task 4).

- [ ] **Step 8: Commit**

```bash
git add src/features/LibraryPage.tsx src/features/LibraryPage.test.tsx
git commit -m "feat: show books as a cover grid in the library"
```

---

## Task 5: CSS cho lưới

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Thêm cỡ `grid` cho `BookCover`**

Chèn ngay sau khối `.book-cover-large` đã có:

```css
.book-cover-grid {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}
```

- [ ] **Step 2: Thêm style cho lưới**

Chèn sau khối `.library-book-toc-pages` đã có:

```css
.book-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* auto-fill cho 3 cột trên điện thoại hẹp và tự giãn trên màn rộng, không cần media query. */
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 14px 10px;
}

.book-grid-cell {
  position: relative;
  min-width: 0;
}

.book-grid-cover {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  padding: 0;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--card-bg);
  cursor: pointer;
  touch-action: manipulation;
}

.book-grid-cover:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.book-grid-fav {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  cursor: pointer;
}

.book-grid-fav.on {
  color: var(--rose);
}

.book-grid-title {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 6px 0 0;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text-main);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.book-grid-dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--text-muted);
}

.book-grid-dot[data-status='IN_PROGRESS'] {
  background: var(--purple);
}

.book-grid-dot[data-status='COMPLETED'] {
  background: var(--emerald);
}

.book-grid-author {
  margin: 1px 0 0;
  font-size: 0.68rem;
  color: var(--text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-book-status {
  padding: 2px 9px;
  border: 1px solid var(--card-border);
  border-radius: 20px;
  background: var(--card-bg);
  color: var(--purple);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}
```

Lưu ý `.book-grid-title` khai `display` hai lần là cố ý — `flex` là bản dự phòng cho trình duyệt không hiểu `-webkit-box`, và `-webkit-box` ghi đè để cắt hai dòng hoạt động. Giữ đúng thứ tự này.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "style: add book grid styles"
```

---

## Task 6: Kiểm chứng cuối

- [ ] **Step 1: Toàn bộ test**

Run: `npm test`
Expected: PASS — 18 file, 143 test.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS, không lỗi type.

- [ ] **Step 3: Kiểm thử tay**

Run: `npm run dev`

Checklist:

1. Vào mục Books → thấy lưới bìa, không còn thẻ dạng dòng.
2. Thu cửa sổ về 360px → 3 cột, không có thanh cuộn ngang.
3. Sách chưa có ảnh bìa → ô placeholder 📖 vẫn đúng tỉ lệ 2:3, nhìn cân với ô có bìa.
4. Bấm ô bìa → mở màn chi tiết đúng sách.
5. Bấm tim trên ô bìa → đổi trạng thái yêu thích, **không** mở màn chi tiết.
6. Sub-tab "Yêu thích" khi đang ở mục Books → cũng là lưới.
7. Tab "Tất cả thể loại" → sách vẫn dạng dòng, các loại khác không đổi.
8. Trong màn chi tiết, đổi dropdown trạng thái → quay lại lưới thấy chấm màu đã đổi.
9. Tab qua bàn phím: tới được cả nút bìa lẫn nút tim của từng ô.

---

## Tự soát kế hoạch

| Mục spec | Task |
|---|---|
| `BookCover` cỡ `grid` | 1 |
| Lưới, ô bìa, nút tim không lồng trong nút bìa | 2 |
| Nhãn trạng thái bằng chữ trong `aria-label`, chấm màu `aria-hidden` | 2 |
| Nhãn đọc/nghe theo `book_format` | 2, 3 |
| Dropdown trạng thái ở màn chi tiết | 3 |
| Lưới ở cả "Tổng thể" và "Yêu thích", chỉ khi `selectedType === 'BOOK'` | 4 |
| `renderMediaRow` không đổi, tab "Tất cả" giữ dạng dòng | 4 (test khẳng định) |
| CSS `.book-grid-*`, `.book-cover-grid`, `.library-book-status` | 5 |
| Sách không có bìa / ảnh lỗi | Đã có sẵn trong `BookCover`, checklist tay mục 3 |
| Toàn bộ mục Kiểm thử trong spec | 1, 2, 3, 4, 6 |
