# People, Reliable MP3, and Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-persisted YouTube MP3 conversion, explicit local/Supabase save status, and a People area with shared daily notes, interests, and `@` mentions.

**Architecture:** Supabase remains the primary store. Browser writes optimistically to localStorage when Supabase is unavailable and labels the source. An Edge Function calls an external converter API using a server secret, uploads the returned MP3 to Supabase Storage, and returns a durable URL. People and daily notes use dedicated tables and foreign keys; Daily mentions link to people and share the same note records.

**Tech Stack:** React 18, TypeScript, Vite, Supabase Postgres/Storage/Edge Functions, external converter API.

## Global Constraints

- Never expose the converter API key in browser code.
- A Supabase success message is shown only after the database/Storage operation succeeds.
- Local fallback must be clearly labeled `Local`; remote success must be labeled `Supabase`.
- Existing screens and migrations must remain backward compatible.

### Task 1: Persistence status utilities and task save feedback

**Files:**
- Create: `src/lib/persistence.ts`
- Modify: `src/features/TasksPage.tsx`
- Modify: `src/features/shared.tsx`
- Test: `npm.cmd run build`

- [ ] Add typed `SaveSource = 'local' | 'supabase'` and helpers for localStorage JSON records.
- [ ] Wrap task insert/update/delete operations so Supabase errors write the same item to localStorage and return `{ source, error }`.
- [ ] Display a toast/badge with `Đã lưu Supabase` or `Đã lưu Local` after every task mutation.
- [ ] Run `npm.cmd run build` and confirm TypeScript/Vite succeeds.
- [ ] Commit `feat: report task persistence source`.

### Task 2: People schema and types

**Files:**
- Create: `supabase/migrations/20260813000000_people_and_shared_logs.sql`
- Modify: `src/types/index.ts`
- Modify: `DATABASE_SCHEMA.sql`

- [ ] Create `people`, `person_interests`, `daily_logs`, and `daily_log_people` tables with UUID ids, timestamps, soft-delete fields, and indexes on person/date.
- [ ] Add RLS policies matching the app's current authenticated/public access model.
- [ ] Add TypeScript types `Person`, `PersonInterest`, `DailyLog`, and `DailyLogPerson`.
- [ ] Run the build and inspect generated SQL for idempotency.
- [ ] Commit `feat: add people and shared daily log schema`.

### Task 3: People tab and profile screen

**Files:**
- Create: `src/features/PeoplePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] Add a People navigation tab and route/state entry.
- [ ] Implement add/edit/archive person with Supabase-first persistence and local fallback status.
- [ ] Implement selected-person screen with name, optional avatar URL, notes, interests list, add/edit/delete interest, and per-day log editor.
- [ ] Add loading, empty, and error states without breaking anonymous/local mode.
- [ ] Run the production build.
- [ ] Commit `feat: add people profiles and interests`.

### Task 4: Daily shared notes and @ mentions

**Files:**
- Modify: `src/features/DailyPage.tsx`
- Modify: `src/features/PeoplePage.tsx`
- Modify: `src/types/index.ts`

- [ ] Add a daily log editor backed by `daily_logs` with local fallback.
- [ ] Detect `@` followed by a partial name and show a selectable people list.
- [ ] Insert a stable mention token and persist links in `daily_log_people`.
- [ ] Render linked people in both Daily and the selected person's profile; editing either view updates the same `daily_logs` row.
- [ ] Add conflict-safe `updated_at` handling and a visible source badge.
- [ ] Run the production build.
- [ ] Commit `feat: link daily logs to people mentions`.

### Task 5: MP3 Edge Function and Storage persistence

**Files:**
- Create: `supabase/functions/youtube-to-mp3/index.ts`
- Create: `supabase/migrations/20260813010000_media_audio_storage.sql`
- Modify: `src/features/LibraryPage.tsx`
- Modify: `.env.example`

- [ ] Add an Edge Function request contract `{ youtubeUrl: string }` and response `{ audioUrl: string, storagePath: string }`.
- [ ] Validate YouTube URLs server-side, call the configured converter API with `CONVERTER_API_KEY`, download the returned audio, and upload it to `media-audio` with a deterministic user/video path.
- [ ] Add bucket policy and metadata columns needed for durable audio URLs.
- [ ] Replace browser-side Piped/proxy calls with `supabase.functions.invoke('youtube-to-mp3')`.
- [ ] Only set `audio_url` after the Storage upload succeeds; otherwise preserve the YouTube URL and show an actionable error.
- [ ] Add `.env.example` entries for converter endpoint/key without real secrets.
- [ ] Run the production build and lint the Edge Function TypeScript.
- [ ] Commit `feat: persist converted youtube audio in storage`.

### Task 6: Verification and deployment handoff

**Files:**
- Modify: `README.md`

- [ ] Document required Supabase secrets, bucket setup, migration order, and converter API response contract.
- [ ] Run `npm.cmd run build` from a clean working tree.
- [ ] Inspect `git diff --check` and migration names.
- [ ] Report any external setup still required before deployment.
- [ ] Commit `docs: document mp3 and people setup`.
