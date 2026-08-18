import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const { rowsByTable } = vi.hoisted(() => ({
  rowsByTable: {
    todos: [
      { id: 't1', title: 'Nộp báo cáo', completed: false, created_at: '2026-08-18T00:00:00Z', due_date: '2026-08-18' },
      { id: 't2', title: 'Gọi điện cho mẹ', completed: false, created_at: '2026-08-18T00:00:00Z', due_date: null },
    ],
    people: [{ id: 'p1', name: 'Mẹ' }],
    person_occasions: [
      { id: 'o1', person_id: 'p1', kind: 'BIRTHDAY', title: 'Sinh nhật', occasion_date: '2026-08-20', is_yearly: true },
    ],
    habits: [{ id: 'h1', name: 'Chạy bộ', is_active: true, category_id: null, habit_type: 'GOOD' }],
    habit_logs: [] as unknown[],
  } as Record<string, unknown[]>,
}))

/** Builder giả: mọi bộ lọc đều trả lại chính nó, await thì ra dữ liệu của bảng. */
function makeQuery(table: string) {
  const result = { data: rowsByTable[table] ?? [], error: null }
  const chain: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const method of ['select', 'eq', 'is', 'or', 'order', 'limit', 'gte', 'lte', 'update']) {
    chain[method] = () => chain
  }
  return chain
}

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => makeQuery(table),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => Promise.resolve(),
  },
}))

vi.mock('./ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn(), showSaveToast: vi.fn() }),
}))

vi.mock('./manga/mangaUpdates', () => ({
  useMangaUpdates: () => ({ updates: [], dismiss: vi.fn(), dismissAll: vi.fn() }),
  mangaPath: () => '/bl',
}))

const { NotificationCenter } = await import('./NotificationCenter')

afterEach(cleanup)

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationCenter />
    </MemoryRouter>,
  )
}

describe('NotificationCenter', () => {
  it('mở bảng thì hiện mục đầu tiên còn việc và chuyển được sang tab khác', async () => {
    renderBell()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Thông báo/ }))

    expect(await screen.findByText('Nộp báo cáo')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: /Thói quen/ }))
    expect(screen.getByText('Chạy bộ')).toBeTruthy()
  })

  it('gộp mọi nguồn vào một huy hiệu duy nhất', async () => {
    renderBell()
    // 2 việc + 1 thói quen chưa ghi (+ dịp nếu còn trong 7 ngày) — luôn ≥ 3 và chỉ một huy hiệu.
    const badge = await screen.findByRole('button', { name: /Thông báo: \d+ mục/ })
    const count = Number(badge.getAttribute('aria-label')!.match(/(\d+)/)![1])
    expect(count).toBeGreaterThanOrEqual(3)
  })
})
