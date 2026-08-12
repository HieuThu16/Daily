# Library Music Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished mobile Library list where audio actions are icon-only and date/time appear only after entering the listening detail.

**Architecture:** Keep navigation state in `LibraryPage` and keep reusable audio controls in `LibraryAudioView`. Move visual layout responsibility to named CSS classes in `styles.css`, while tests assert the user-visible information boundary between list and detail.

**Tech Stack:** React 19, TypeScript, Lucide React, Vitest, Testing Library, Vite

## Global Constraints

- All six category controls remain in one non-wrapping row.
- Outer media cards never render `log_date` or `log_time`.
- Date and time render in `LibraryAudioDetail` after the user presses play.
- Existing unrelated worktree changes are never staged or modified.

---

### Task 1: Lock the list/detail information boundary

**Files:**
- Modify: `src/features/LibraryPage.test.tsx`
- Modify: `src/features/library/LibraryAudioView.test.tsx`

**Interfaces:**
- Consumes: `LibraryPage`, `LibraryAudioDetail`, `LibraryAudioAction`
- Produces: regression coverage for hidden list timestamps, visible detail timestamps, and icon-only audio controls

- [ ] **Step 1: Write the failing tests**

Add assertions that `2026-08-12` and `10:04` are absent before pressing `Nghe Hẹn một mai`, visible afterward, and that the audio action has no visible `Nghe` or `Thêm MP3` text.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --run src/features/LibraryPage.test.tsx src/features/library/LibraryAudioView.test.tsx`

Expected: FAIL because the outer row currently renders date/time and both audio controls currently contain visible text.

- [ ] **Step 3: Preserve the failure evidence before production edits**

Confirm the failure names identify date/time leakage or visible action labels, not setup or import errors.

### Task 2: Implement the redesigned audio controls and list card

**Files:**
- Modify: `src/features/library/LibraryAudioView.tsx`
- Modify: `src/features/LibraryPage.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `Media`, `onListen(item)`, `onAddMp3(item)`, existing status/favorite/edit callbacks
- Produces: icon-only `LibraryAudioAction` and class-based `library-media-card` presentation

- [ ] **Step 1: Make audio actions icon-only**

Render only `Play` for stored audio and an upload/music icon for missing audio. Preserve descriptive `aria-label` and add matching `title` attributes.

- [ ] **Step 2: Remove date/time from the outer row**

Delete the list-only date/time badge from `renderMediaRow`; keep `getItemDateTime` for form initialization and keep `item.log_date` / `item.log_time` in `LibraryAudioDetail`.

- [ ] **Step 3: Apply the card layout**

Replace outer-row inline sizing with named classes for the rounded card, identity block, metadata badges, and action cluster. Add responsive CSS that keeps controls inside the card and keeps category buttons in six equal columns.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `npm test -- --run src/features/LibraryPage.test.tsx src/features/library/LibraryAudioView.test.tsx`

Expected: all focused tests pass.

### Task 3: Verify and publish only the Library change

**Files:**
- Verify: `src/features/LibraryPage.tsx`
- Verify: `src/features/library/LibraryAudioView.tsx`
- Verify: `src/styles.css`
- Verify: Library test files and these two documents

**Interfaces:**
- Consumes: completed Tasks 1 and 2
- Produces: tested production build and one scoped commit on `main`

- [ ] **Step 1: Run the complete test suite**

Run: `npm test -- --run`

Expected: zero failing tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vite exits with code 0.

- [ ] **Step 3: Review the exact diff and staged scope**

Run: `git diff -- src/features/LibraryPage.tsx src/features/library/LibraryAudioView.tsx src/styles.css src/features/LibraryPage.test.tsx src/features/library/LibraryAudioView.test.tsx docs/superpowers/specs/2026-08-12-library-music-card-redesign-design.md docs/superpowers/plans/2026-08-12-library-music-card-redesign.md`

Stage only those paths. Confirm `git diff --cached --name-only` contains no Tasks, database, migration, or dependency files.

- [ ] **Step 4: Commit and push main**

Run: `git commit -m "feat: redesign library music cards"` followed by `git push origin main`.

Expected: the remote `main` advances to the new commit.
