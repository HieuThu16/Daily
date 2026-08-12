import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localDate } from '../lib/date'
import { TasksPage } from './TasksPage'

const { seedTodos, calls, toastCalls, dbState } = vi.hoisted(() => ({
  toastCalls: [] as string[],
  dbState: { updateError: null as { message: string } | null },
  seedTodos: [] as any[],
  calls: { updates: [] as { table: string; payload: any }[], inserts: [] as { table: string; payload: any }[] },
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      update: (payload: any) => {
        calls.updates.push({ table, payload })
        return { eq: async () => ({ error: dbState.updateError }) }
      },
      insert: (payload: any) => {
        calls.inserts.push({ table, payload })
        return {
          select: () => ({ single: async () => ({ data: { id: 'postpone-1', created_at: '2026-08-14T10:00:00.000Z', ...payload }, error: null }) }),
        }
      },
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}))

vi.mock('./shared', async () => {
  const actual = await vi.importActual<any>('./shared')
  const { useState } = await import('react')
  return {
    ...actual,
    useQuery: (table: string) => {
      const [items, setItems] = useState<any[]>(table === 'todos' ? seedTodos : [])
      return { items, setItems, loading: false, error: '', reload: vi.fn() }
    },
  }
})

vi.mock('./ToastContext', () => ({
  useToast: () => ({
    showToast: (message: string) => {
      toastCalls.push(message)
    },
    showSaveToast: vi.fn(),
  }),
}))

beforeEach(() => {
  seedTodos.length = 0
  seedTodos.push(
    {
      id: 'todo-1',
      title: 'Viết báo cáo tuần',
      completed: false,
      due_date: localDate(),
      due_time: '18:30',
      difficulty: 'NORMAL',
      priority: 'NORMAL',
      postpone_count: 0,
      postpone_minutes: 0,
      created_at: '2026-08-14T01:00:00.000Z',
    },
    {
      id: 'todo-2',
      title: 'Gọi điện cho nha sĩ',
      completed: true,
      due_date: localDate(),
      due_time: null,
      difficulty: 'EASY',
      priority: 'NORMAL',
      postpone_count: 0,
      postpone_minutes: 0,
      created_at: '2026-08-14T02:00:00.000Z',
    }
  )
  calls.updates.length = 0
  calls.inserts.length = 0
  toastCalls.length = 0
  dbState.updateError = null
})

afterEach(cleanup)

describe('TasksPage layout', () => {
  it('collapses finished tasks into their own group', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)

    // Việc chưa xong hiện ngay, việc đã xong nằm trong nhóm gập
    expect(screen.getByText('Viết báo cáo tuần')).toBeInTheDocument()
    expect(screen.queryByText('Gọi điện cho nha sĩ')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Đã xong/ }))
    expect(screen.getByText('Gọi điện cho nha sĩ')).toBeInTheDocument()
  })

  it('keeps the filter controls behind the filter button', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)

    expect(screen.queryByLabelText('Lọc theo ưu tiên')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lọc và sắp xếp' }))

    expect(screen.getByLabelText('Lọc theo ưu tiên')).toBeInTheDocument()
    expect(screen.getByLabelText('Lọc theo độ khó')).toBeInTheDocument()
    expect(screen.getByLabelText('Sắp xếp')).toBeInTheDocument()
  })

  it('shows day progress counting finished tasks', () => {
    render(<TasksPage />)
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })
})

describe('TasksPage postpone', () => {
  it('shows the deadline time on the task row', () => {
    render(<TasksPage />)
    expect(screen.getByText('18:30')).toBeInTheDocument()
  })

  it('pushes the deadline, bumps the counters and logs one history row', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)

    await user.click(screen.getByRole('button', { name: 'Postpone task' }))
    expect(screen.getByRole('heading', { name: 'Trì hoãn công việc' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+30 phút' }))
    await user.type(screen.getByPlaceholderText('VD: Bận họp đột xuất…'), 'Bận họp')
    await user.click(screen.getByRole('button', { name: 'Xác nhận trì hoãn' }))

    await waitFor(() => expect(calls.inserts).toHaveLength(1))

    const todoUpdate = calls.updates.find((c) => c.table === 'todos')
    expect(todoUpdate?.payload).toMatchObject({ postpone_count: 1, postpone_minutes: 30 })
    expect(todoUpdate?.payload.due_time).toMatch(/^\d{2}:\d{2}$/)

    expect(calls.inserts[0].table).toBe('task_postpones')
    expect(calls.inserts[0].payload).toMatchObject({
      todo_id: 'todo-1',
      minutes: 30,
      reason: 'Bận họp',
      prev_due_time: '18:30',
    })

    // Optimistic UI: the row now carries a postpone badge
    expect(screen.getByText('⏳×1')).toBeInTheDocument()
  })

  it('accepts a custom number of minutes instead of a preset', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)

    await user.click(screen.getByRole('button', { name: 'Postpone task' }))
    await user.type(screen.getByPlaceholderText('VD: 90'), '90')
    await user.click(screen.getByRole('button', { name: 'Xác nhận trì hoãn' }))

    await waitFor(() => expect(calls.inserts).toHaveLength(1))
    expect(calls.inserts[0].payload.minutes).toBe(90)
    expect(calls.updates.find((c) => c.table === 'todos')?.payload).toMatchObject({ postpone_minutes: 90 })
  })

  it('surfaces the Supabase message when a write is rejected', async () => {
    // Exactly what PostgREST returns when a migration was never applied
    dbState.updateError = { message: "Could not find the 'difficulty' column of 'todos' in the schema cache" }
    const user = userEvent.setup()
    render(<TasksPage />)

    await user.click(screen.getByRole('button', { name: /Viết báo cáo tuần/ }))

    await waitFor(() => expect(toastCalls.some((m) => m.includes("Could not find the 'difficulty' column"))).toBe(true))
    // and it must not claim a clean local save with no explanation
    expect(toastCalls).not.toContain('Đã lưu Local')
  })

  it('blocks confirming when the custom input is not a positive number', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)

    await user.click(screen.getByRole('button', { name: 'Postpone task' }))
    await user.type(screen.getByPlaceholderText('VD: 90'), '0')

    expect(screen.getByRole('button', { name: 'Xác nhận trì hoãn' })).toBeDisabled()
    expect(calls.inserts).toHaveLength(0)
  })
})
