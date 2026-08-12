# Nutrition and Sleep Period Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Day, Week, and Month history views directly to Food and Sleep, including per-meal food filtering, period summaries, charts, and grouped history.

**Architecture:** Extract pure period and aggregation logic into a focused module, then render reusable period controls and history views from a separate React module. `NutritionPage` remains responsible for Supabase/local-storage IO and daily add/delete flows, but delegates period presentation and calculations.

**Tech Stack:** React 18, TypeScript, Supabase JS, Lucide React, Vitest, Testing Library, Vite

## Global Constraints

- Reuse `nutrition_logs` and `sleep_logs`; add no migration.
- Keep existing daily add and delete workflows.
- Remove the combined Statistics tab after equivalent information exists inside Food and Sleep.
- Week contains seven days ending on the selected date; Month contains the full selected calendar month.
- Food period filters are exactly `Tất cả | Sáng | Trưa | Chiều | Tối`.
- Do not stage unrelated Library, Tasks, Book Reader, database, or configuration changes.

---

### Task 1: Period and aggregation domain module

**Files:**
- Create: `src/features/nutrition/periodData.ts`
- Create: `src/features/nutrition/periodData.test.ts`

**Interfaces:**
- Produces: `PeriodMode`, `MealSlot`, `NutritionLog`, `SleepLog`, `getPeriodRange(anchor, mode)`, `filterFoodLogs(logs, slot)`, `groupLogsByDate(logs)`, `summarizeFood(logs, days)`, `summarizeSleep(logs)`, and `aggregateSleepByDate(logs, days)`.
- Consumes: ISO local date strings (`YYYY-MM-DD`) and existing Nutrition/Sleep row shapes.

- [ ] **Step 1: Write failing calendar boundary tests**

Use literal expectations: `getPeriodRange('2026-08-12', 'week')` returns start `2026-08-06`, end `2026-08-12`, and seven dates; `getPeriodRange('2026-02-15', 'month')` returns all 28 dates from `2026-02-01` through `2026-02-28`.

- [ ] **Step 2: Run RED**

Run: `npm.cmd test -- --run src/features/nutrition/periodData.test.ts`

Expected: FAIL because `periodData.ts` does not exist.

- [ ] **Step 3: Implement local-calendar period calculation**

Parse ISO dates at local noon, format using local year/month/day fields, subtract six days for Week, and calculate the last calendar day for Month.

- [ ] **Step 4: Write failing aggregation tests**

Use hand-checked fixtures proving a lunch filter excludes morning/evening totals, daily food totals include zero-value dates, two sleep logs on one date aggregate for the chart, sleep average divides by recorded dates, and target count uses 450 minutes.

- [ ] **Step 5: Run RED, implement aggregators, and run GREEN**

Run: `npm.cmd test -- --run src/features/nutrition/periodData.test.ts`

Expected after implementation: all domain tests pass.

### Task 2: Period selector and history views

**Files:**
- Create: `src/features/nutrition/NutritionPeriodViews.tsx`
- Create: `src/features/nutrition/NutritionPeriodViews.css`
- Create: `src/features/nutrition/NutritionPeriodViews.test.tsx`

**Interfaces:**
- Consumes: `PeriodMode`, period dates, filtered `NutritionLog[]`, `SleepLog[]`, meal selection, and callbacks for period/meal/date/delete changes.
- Produces: `PeriodSelector`, `FoodPeriodView`, and `SleepPeriodView`.

- [ ] **Step 1: Write failing interaction tests**

Render `PeriodSelector` and assert visible `Ngày`, `Tuần`, `Tháng` buttons use `aria-pressed`; clicking `Tuần` calls `onChange('week')`. Render `FoodPeriodView` and assert meal buttons, filtered totals, chart labels, and newest-date-first groups. Render `SleepPeriodView` and assert average, total, target-night count, and grouped sleep rows.

- [ ] **Step 2: Run RED**

Run: `npm.cmd test -- --run src/features/nutrition/NutritionPeriodViews.test.tsx`

Expected: FAIL because the component module does not exist.

- [ ] **Step 3: Implement accessible components and scoped CSS**

Use existing design tokens, horizontal overflow for segmented controls/month charts, descriptive titles on chart bars, visible summary labels, and existing quality thresholds. Do not add a chart dependency.

- [ ] **Step 4: Run GREEN**

Run: `npm.cmd test -- --run src/features/nutrition/NutritionPeriodViews.test.tsx`

Expected: all view tests pass.

### Task 3: Integrate period modes into NutritionPage

**Files:**
- Modify: `src/features/NutritionPage.tsx`
- Create: `src/features/NutritionPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 range helpers and Task 2 selectors/views.
- Produces: Food and Sleep tabs with Day/Week/Month modes, selected-date navigation, remote period queries, local fallback, and no Statistics tab.

- [ ] **Step 1: Write failing page-level tests**

Mock only the Supabase boundary and render the real page. Assert the top-level tabs are `Ăn uống` and `Ngủ` with no `Thống kê`; Week mode exposes food meal filters; Sleep Week mode exposes sleep summary/history; Day mode retains add controls.

- [ ] **Step 2: Run RED**

Run: `npm.cmd test -- --run src/features/NutritionPage.test.tsx`

Expected: FAIL because the existing page still has Statistics and no inline period selector.

- [ ] **Step 3: Replace Statistics state with shared period state**

Add `periodMode`, `mealFilter`, and period-loading/data state. Keep exact-date fetches for Day; use `gte`/`lte` queries and local-storage range collection for Week/Month.

- [ ] **Step 4: Integrate the period UI**

Render `PeriodSelector` in Food and Sleep; render the existing daily content only for Day and the matching `FoodPeriodView` or `SleepPeriodView` for Week/Month. Change previous/next navigation by day, seven days, or month. Remove the Statistics tab and old statistics JSX.

- [ ] **Step 5: Keep mutations synchronized**

After add/delete, refresh the active tab's daily or period data so summary, chart, and history remain consistent.

- [ ] **Step 6: Run GREEN**

Run: `npm.cmd test -- --run src/features/NutritionPage.test.tsx src/features/nutrition/periodData.test.ts src/features/nutrition/NutritionPeriodViews.test.tsx`

Expected: all feature tests pass.

### Task 4: Full verification, scoped commit, push, and deploy

**Files:**
- Verify and stage only the files created or modified by Tasks 1-3 plus this plan.

**Interfaces:**
- Consumes: completed feature implementation.
- Produces: one implementation commit on `main`, pushed remote state, and a clean Vercel preview URL built from the exact commit.

- [ ] **Step 1: Run complete verification**

Run `npm.cmd test -- --run`, then `npm.cmd run build`, then `git diff --check` restricted to the feature paths. Both npm commands must exit 0.

- [ ] **Step 2: Review staged scope**

Stage explicit Nutrition feature/test/plan paths only. Confirm `git diff --cached --name-only` contains no unrelated files.

- [ ] **Step 3: Commit and push**

Commit as `feat: add nutrition and sleep period views`, push `origin main`, and verify local `HEAD` equals `origin/main`.

- [ ] **Step 4: Deploy exact commit snapshot**

Create a temporary archive from the new commit, copy only `.vercel/project.json` into it, run `vercel.cmd deploy <snapshot> -y`, and report the returned Preview URL. Do not deploy the dirty main workspace directly.
