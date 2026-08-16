import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TaskNotificationBell } from './TaskNotificationBell'

const { mockTasks } = vi.hoisted(() => ({
  mockTasks: [] as any[],
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: mockTasks, error: null }),
            }),
          }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: () => Promise.resolve(),
  },
}))

vi.mock('./ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSaveToast: vi.fn(),
  }),
}))

beforeEach(() => {
  mockTasks.length = 0
})

afterEach(cleanup)

describe('TaskNotificationBell', () => {
  it('hiển thị chuông không có badge khi không có task nào chưa hoàn thành', async () => {
    render(
      <MemoryRouter>
        <TaskNotificationBell />
      </MemoryRouter>,
    )

    const bellBtn = await screen.findByRole('button', { name: /Thông báo công việc: 0 việc/i })
    expect(bellBtn).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('hiển thị số lượng task chưa xong trên badge khi có task', async () => {
    mockTasks.push(
      {
        id: 't-1',
        title: 'Học tiếng Anh 30p',
        completed: false,
        due_date: '2026-08-16',
        due_time: '15:00',
        created_at: '2026-08-16T08:00:00Z',
      },
      {
        id: 't-2',
        title: 'Mua quà sinh nhật',
        completed: false,
        due_date: '2026-08-17',
        due_time: null,
        created_at: '2026-08-16T09:00:00Z',
      },
    )

    render(
      <MemoryRouter>
        <TaskNotificationBell />
      </MemoryRouter>,
    )

    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('mở danh sách dropdown khi bấm vào chuông và có thể tích hoàn thành', async () => {
    const user = userEvent.setup()
    mockTasks.push({
      id: 't-1',
      title: 'Học tiếng Anh 30p',
      completed: false,
      due_date: '2026-08-16',
      due_time: '15:00',
      created_at: '2026-08-16T08:00:00Z',
    })

    render(
      <MemoryRouter>
        <TaskNotificationBell />
      </MemoryRouter>,
    )

    const bellBtn = await screen.findByRole('button', { name: /Thông báo công việc/i })
    await user.click(bellBtn)

    expect(screen.getByText('Công việc chưa xong')).toBeInTheDocument()
    expect(screen.getByText('Học tiếng Anh 30p')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hoàn thành: Học tiếng Anh 30p/i })).toBeInTheDocument()
  })
})
