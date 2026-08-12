# Habit History Type Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color every History table row by good/bad habit type in both check and numeric tables.

**Architecture:** Extract the duplicated History row/table rendering into a small presentation component that receives habits, logs, and dates. Apply semantic type classes and accessible badges there, then reuse it twice from `HabitsPage`.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, CSS

## Global Constraints

- `BAD` is red/rose; all other values are good and green/emerald.
- Row background, habit name, check mark, and numeric value use the habit type.
- Empty cells remain muted gray.
- Visible `Tốt` / `Xấu` badges supplement color.
- Existing headings, table structure, and horizontal scrolling remain.
- Do not stage unrelated working-tree changes.

---

### Task 1: History table presentation

**Files:**
- Create: `src/features/habits/HabitHistoryTable.tsx`
- Create: `src/features/habits/HabitHistoryTable.test.tsx`
- Create: `src/features/habits/HabitHistoryTable.css`

**Interfaces:**
- Consumes: `Habit[]`, `HabitLog[]`, `string[] dates`, and tracking mode `CHECK | COUNT`.
- Produces: semantic `habit-history-row-good/bad`, name/value classes, and visible type badges.

- [x] Write tests rendering good and bad CHECK habits and asserting badges/classes/check colors while empty cells stay muted.
- [x] Run `npm.cmd test -- --run src/features/habits/HabitHistoryTable.test.tsx` and confirm RED because the component does not exist.
- [x] Implement `HabitHistoryTable` and scoped CSS with emerald/rose text and translucent backgrounds.
- [x] Add COUNT assertions proving good and bad numeric values inherit the row type.
- [x] Run the focused test and confirm GREEN.

### Task 2: HabitsPage integration and verification

**Files:**
- Modify: `src/features/HabitsPage.tsx`
- Modify or create: `src/features/HabitsPage.test.tsx` only if page-level coverage is needed.

**Interfaces:**
- Consumes: `HabitHistoryTable` from Task 1.
- Produces: both existing History cards using the shared colored table.

- [x] Replace duplicated table bodies with `HabitHistoryTable` in CHECK and COUNT modes.
- [x] Run focused tests, full `npm.cmd test -- --run --exclude ".claude/**"`, and `npm.cmd run build`.
- [ ] Stage explicit Habits component/test/CSS/plan paths, confirm staged scope, commit `feat: color habit history by type`, and push `origin main`.
