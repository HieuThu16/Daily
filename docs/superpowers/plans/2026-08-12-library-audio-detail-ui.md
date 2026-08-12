# Library Audio Detail UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep all six Library categories on one mobile row and move audio playback from list cards into a focused detail view with an explicit back action.

**Architecture:** Extract focused, presentational Library audio controls into `src/features/library/LibraryAudioView.tsx`; `LibraryPage` remains the data owner and stores only the selected audio item ID. CSS classes own responsive sizing so list markup stays readable and component tests can assert user-visible navigation behavior.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest, Testing Library, jsdom, lucide-react.

## Global Constraints

- All six media-category buttons remain visible on one row without wrapping or horizontal scrolling.
- Music and YouTube list cards never embed an HTML audio player.
- Items with `audio_url` show **Nghe**; items without it show **Thêm MP3** and open the existing edit flow.
- The detail view replaces Library controls/list but keeps the application header and bottom navigation.
- Returning from detail preserves category, sub-view, status, genre, and search state.
- Supabase schema, conversion logic, and other Library item behavior remain unchanged.

---

### Task 1: Component Test Harness and Six-Category Bar

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/test/setup.ts`
- Create: `src/features/library/LibraryAudioView.tsx`
- Create: `src/features/library/LibraryAudioView.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `LibraryCategoryBar({ selectedType, categories, onSelect })`
- Category shape: `{ id: string; label: string; icon: LucideIcon; color: string; bg: string }`

- [ ] **Step 1: Install and configure the test harness**

Run:

```powershell
npm.cmd install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add scripts and Vitest config to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Add to `vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
}
```

- [ ] **Step 2: Write the failing category-bar test**

Create a six-item fixture with simple lucide icons, render `LibraryCategoryBar`, and assert:

```tsx
expect(screen.getByRole('group', { name: 'Thể loại thư viện' })).toHaveClass('library-category-bar')
expect(screen.getAllByRole('button')).toHaveLength(6)
expect(screen.getByRole('button', { name: 'Tất cả thể loại' })).toHaveAttribute('aria-pressed', 'true')
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- src/features/library/LibraryAudioView.test.tsx
```

Expected: FAIL because `LibraryCategoryBar` does not exist.

- [ ] **Step 4: Implement the minimal category component and responsive CSS**

Implement a semantic group that maps all supplied categories to icon-only buttons. Add:

```css
.library-category-bar {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}

.library-category-button {
  min-width: 0;
  min-height: 40px;
  padding: 4px 0;
}

@media (max-width: 420px) {
  .library-category-bar { gap: 4px; }
  .library-category-button .icon-box { width: 24px; height: 24px; }
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run the focused test again and expect all assertions to pass.

- [ ] **Step 6: Commit the isolated category bar**

```powershell
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/features/library/LibraryAudioView.tsx src/features/library/LibraryAudioView.test.tsx src/styles.css
git commit -m "test: add library audio UI harness"
```

### Task 2: Audio Action and Focused Detail View

**Files:**
- Modify: `src/features/library/LibraryAudioView.tsx`
- Modify: `src/features/library/LibraryAudioView.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `LibraryAudioAction({ item, onListen, onAddMp3 })`
- Produces: `LibraryAudioDetail({ item, onBack, onEdit })`
- Consumes: `Media` from `src/types/index.ts`

- [ ] **Step 1: Write failing action/detail tests**

Use literal Music fixtures and verify these behaviors:

```tsx
render(<LibraryAudioAction item={withAudio} onListen={onListen} onAddMp3={onAddMp3} />)
await user.click(screen.getByRole('button', { name: /nghe/i }))
expect(onListen).toHaveBeenCalledWith(withAudio)

render(<LibraryAudioAction item={withoutAudio} onListen={onListen} onAddMp3={onAddMp3} />)
await user.click(screen.getByRole('button', { name: /thêm mp3/i }))
expect(onAddMp3).toHaveBeenCalledWith(withoutAudio)
```

Render `LibraryAudioDetail` and assert exactly one audio element, visible metadata, an optional YouTube link, and that **Quay lại** invokes `onBack`.

- [ ] **Step 2: Run the focused test and verify RED**

Expected: FAIL because the action and detail exports do not exist.

- [ ] **Step 3: Implement the minimal components**

`LibraryAudioAction` returns `null` for non-Music/non-YouTube items. For audio items it chooses one button from `Boolean(item.audio_url)`.

`LibraryAudioDetail` renders:

```tsx
<section className="library-audio-detail" aria-labelledby="library-audio-title">
  <button onClick={onBack} aria-label="Quay lại thư viện">← Quay lại</button>
  <h2 id="library-audio-title" tabIndex={-1}>{item.name}</h2>
  <audio controls src={item.audio_url!} preload="metadata" />
</section>
```

Add metadata, edit, YouTube link, focus-on-open, and inline `onError` state without changing stored data.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the component test file; expect all action and detail tests to pass.

- [ ] **Step 5: Commit the focused audio UI**

```powershell
git add src/features/library/LibraryAudioView.tsx src/features/library/LibraryAudioView.test.tsx src/styles.css
git commit -m "feat: add focused library audio view"
```

### Task 3: Integrate the New UI into LibraryPage

**Files:**
- Modify: `src/features/LibraryPage.tsx`
- Modify: `src/features/library/LibraryAudioView.test.tsx`

**Interfaces:**
- Consumes: `LibraryCategoryBar`, `LibraryAudioAction`, and `LibraryAudioDetail`
- State: `selectedAudioItemId: string | null`

- [ ] **Step 1: Write a failing navigation harness test**

Create a small test harness using the extracted components. Store `selectedAudioItemId`, render a list action initially, and render `LibraryAudioDetail` after **Nghe**. Assert:

```tsx
expect(screen.queryByRole('heading', { name: withAudio.name })).not.toBeInTheDocument()
await user.click(screen.getByRole('button', { name: /nghe/i }))
expect(screen.getByRole('heading', { name: withAudio.name })).toBeInTheDocument()
expect(document.querySelectorAll('audio')).toHaveLength(1)
await user.click(screen.getByRole('button', { name: /quay lại/i }))
expect(screen.getByRole('button', { name: /nghe/i })).toBeInTheDocument()
```

- [ ] **Step 2: Run the test and verify RED**

Expected: FAIL until the harness and exported interaction contract are complete.

- [ ] **Step 3: Replace inline category and list audio markup**

In `LibraryPage`:

```ts
const [selectedAudioItemId, setSelectedAudioItemId] = useState<string | null>(null)
const selectedAudioItem = items.find((item) => item.id === selectedAudioItemId) ?? null
```

- Replace the five-column inline selector with `LibraryCategoryBar`, passing the All entry plus the existing five categories.
- Delete the inline `<audio>`/YouTube playback block inside `renderMediaRow`.
- Add `LibraryAudioAction` to the card action group.
- `onListen` sets the selected ID.
- `onAddMp3` calls `openEdit(item)`.
- Before rendering normal Library controls, return `LibraryAudioDetail` when `selectedAudioItem` exists.
- `onBack` clears the selected ID; `onEdit` clears detail state and calls `openEdit(item)`.
- If the selected ID no longer resolves, render the normal list.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `npm.cmd test -- src/features/library/LibraryAudioView.test.tsx`; expect all tests to pass and no list-level audio element.

- [ ] **Step 5: Run full verification**

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all tests pass and Vite production build exits 0.

- [ ] **Step 6: Perform mobile visual verification**

At a viewport close to 393×852, verify:

- six category buttons are visible in one row;
- list cards contain no embedded audio control;
- **Nghe** opens a focused detail screen with one player;
- **Quay lại** restores the same filter/search selections;
- no horizontal page overflow appears.

- [ ] **Step 7: Commit the integration**

```powershell
git add src/features/LibraryPage.tsx src/features/library/LibraryAudioView.test.tsx
git commit -m "feat: redesign library audio playback"
```
