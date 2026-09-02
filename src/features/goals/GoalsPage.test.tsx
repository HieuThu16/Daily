import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GoalsPage } from './GoalsPage'
import { HeaderActionProvider } from '../HeaderAction'
import { ToastProvider } from '../ToastContext'

function renderGoalsPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <HeaderActionProvider>
          <GoalsPage />
        </HeaderActionProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('GoalsPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('hiển thị bảng điều khiển mục tiêu và tầm nhìn', () => {
    renderGoalsPage()
    expect(screen.getAllByText(/Bảng Tầm Nhìn & Mục Tiêu/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Thêm Mục Tiêu Mới/i })[0]).toBeInTheDocument()
  }, 15000)

  it('chuyển đổi qua lại giữa Đang theo đuổi và Đã hoàn thành', () => {
    renderGoalsPage()

    const completedBtn = screen.getByRole('button', { name: /Đã Hoàn Thành/i })
    fireEvent.click(completedBtn)
    expect(screen.getByText(/Chưa có mục tiêu nào hoàn thành/i)).toBeInTheDocument()

    const activeBtn = screen.getByRole('button', { name: /Đang Theo Đuổi/i })
    fireEvent.click(activeBtn)
    expect(screen.getByText(/Chưa có mục tiêu nào đang theo đuổi/i)).toBeInTheDocument()
  }, 15000)

  it('mở modal tạo mục tiêu mới', () => {
    renderGoalsPage()
    const addBtn = screen.getAllByRole('button', { name: /Thêm Mục Tiêu Mới/i })[0]
    fireEvent.click(addBtn)

    expect(screen.getAllByText(/Tạo Mục Tiêu Mới/i).length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText(/VD: Mua nhà trước 30 tuổi/i)).toBeInTheDocument()
  }, 15000)
})
