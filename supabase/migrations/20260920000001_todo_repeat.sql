-- Việc lặp lại: tích xong một lần thì app tự tạo lần kế tiếp theo quy tắc này.
-- Null = việc một lần, đúng như trước.
alter table public.todos
  add column if not exists repeat_rule text
  check (repeat_rule in ('DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'));
