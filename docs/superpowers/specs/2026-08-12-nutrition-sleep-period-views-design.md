# Nutrition and Sleep Period Views

## Goal

Add period-based history directly to the existing **Ăn uống** and **Ngủ** tabs. Each tab supports `Ngày | Tuần | Tháng`; food history additionally supports `Tất cả | Sáng | Trưa | Chiều | Tối`. The existing combined Statistics tab is removed because its information moves into the two domain tabs.

## Scope

- Redesign `NutritionPage` only; reuse the existing `nutrition_logs` and `sleep_logs` tables.
- Preserve the current daily add and delete workflows.
- Add no database migration and no new third-party chart dependency.
- Keep unrelated Library, Tasks, Book Reader, database, and configuration changes outside this feature's commits.

## Navigation and state

The page keeps the top-level tabs `Ăn uống` and `Ngủ`. Each tab owns a segmented period selector:

- `Ngày`: the current single-date experience, including previous/next date navigation and add controls.
- `Tuần`: the seven calendar days ending on the selected date.
- `Tháng`: every calendar day in the selected date's month, from the first through the last day.

The selected date remains the period anchor. Previous and next controls move by one day in Day mode, seven days in Week mode, and one calendar month in Month mode. The header displays a readable range for Week and a month/year label for Month.

Food has a second segmented filter visible in Week and Month modes: `Tất cả`, `Sáng`, `Trưa`, `Chiều`, and `Tối`. Changing this filter updates every food summary, chart, and history group. Day mode continues to show all four meal sections and their add buttons.

Sleep does not add a meal-like filter. In Week and Month modes, every recorded sleep log in the selected period is included and grouped by `log_date`.

## Food period view

The food view contains:

1. A summary row with total spend, average spend per calendar day in the period, and number of recorded items.
2. A compact daily bar chart. Each bar represents the filtered spend for one date. Month mode may scroll horizontally so labels remain readable.
3. A grouped history list ordered newest date first. Each date card shows its subtotal and its matching food entries. Each entry shows food name, recorded time when available, price, meal badge, and the existing delete action.

When a single meal is selected, summary values and day subtotals include only that meal. When `Tất cả` is selected, all meal slots are included.

## Sleep period view

The sleep view contains:

1. A summary row with average duration per recorded night, total sleep duration, and count of nights meeting the existing 7h30 target.
2. A compact daily duration chart using the existing quality colors: green for at least 7h30, amber for at least 6h, and red for less than 6h.
3. A grouped history list ordered newest date first. Each sleep entry shows start time, end time, formatted duration, quality label, and the existing delete action.

Multiple sleep logs on one date remain separate in history. The chart aggregates their duration for that date, matching the existing daily total behavior.

## Data flow

`NutritionPage` computes an inclusive period range from the selected date and period mode. In Day mode it keeps the existing exact-date queries. In Week and Month modes it queries Supabase with `gte(log_date, start)` and `lte(log_date, end)`, excluding soft-deleted rows and ordering by date and creation time.

If Supabase is unavailable, Day mode retains the current local-storage fallback. Period modes collect matching local-storage day keys across the computed range so locally recorded data remains visible. Loading state is scoped to the active tab and period.

Pure helper functions calculate period boundaries, filter food logs, aggregate daily values, group history by date, and summarize sleep. These helpers are independent of React so their calendar and aggregation behavior can be tested directly.

## Empty and error states

- A period with no matching food shows `Chưa có dữ liệu ăn uống trong khoảng này` and preserves the period/filter controls.
- A period with no sleep logs shows `Chưa có dữ liệu giấc ngủ trong khoảng này`.
- Query failures fall back to local data without replacing valid data already displayed with partial remote results.
- Add and delete errors continue using the existing toast behavior.

## Responsive and accessibility requirements

- Segmented controls remain on one line and use horizontal scrolling below their minimum content width.
- Chart columns have readable minimum widths in Month mode and are contained in a horizontally scrollable chart viewport.
- Buttons expose visible labels and selected state through `aria-pressed`.
- Chart bars expose date and formatted value through accessible labels or titles; summaries and history do not rely on color alone.
- Cards use the current application tokens and remain compatible with light and dark themes.

## Testing

Automated tests cover:

- Week boundaries and full calendar-month boundaries around the selected date.
- Food summaries and daily totals for `Tất cả` and each meal filter.
- Sleep daily aggregation, average per recorded night, and target-night count.
- Switching `Ngày | Tuần | Tháng` and showing the period-specific filter and navigation controls.
- Empty period states.
- Regression coverage that daily add/delete controls remain available in Day mode.

## Acceptance criteria

- Users can inspect food data by Day, Week, or Month without leaving the Food tab.
- Week and Month food data can be filtered to all meals or exactly one meal slot.
- Users can inspect sleep data by Day, Week, or Month without leaving the Sleep tab.
- Period summaries, charts, and grouped histories update consistently with period navigation and filters.
- The combined Statistics tab no longer appears.
- Existing daily logging behavior remains intact and no schema change is required.
