# Habit History Type Colors

## Goal

Make good and bad habits immediately distinguishable in both History tables: check habits and numeric habits.

## Design

- A habit with `habit_type === 'BAD'` uses the existing rose/red token.
- Every other habit, including legacy rows with no `habit_type`, is treated as good and uses the existing emerald/green token.
- Each history row receives a very light background tint matching its type.
- The habit name uses the matching type color and remains bold.
- Completed check marks and recorded numeric values use the matching type color.
- Empty cells keep the existing muted gray dash.
- Table headings retain their existing colors because each table can contain both good and bad habits.
- The behavior applies identically to the check-history table and numeric-history table.

## Accessibility

Color is supplemented by a visible `Tốt` or `Xấu` badge beside each habit name so meaning does not depend on color alone. Existing table structure and horizontal scrolling remain unchanged.

## Testing

Component tests render good and bad habits in both tracking modes and verify the visible badges and semantic type classes on rows, names, check marks, and numeric values.

## Scope

Only Habit History presentation and its tests are in scope. Unrelated Tasks, persistence, migration, and other working-tree changes must remain outside the commit.
