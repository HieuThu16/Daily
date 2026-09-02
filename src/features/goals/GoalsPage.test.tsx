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

  it('hiển thị bảng điều khiển độ cao và danh hiệu tầng mây', () => {
    renderGoalsPage()
    expect(screen.getAllByText(/Mặt Đất/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Thêm Mục Tiêu Lên Trời/i })[0]).toBeInTheDocument()
  }, 15000)

  it('chuyển đổi qua lại giữa Bậc thang lên trời và Đền vinh quang', () => {
    renderGoalsPage()

    const hallBtn = screen.getByRole('button', { name: /Đền Vinh Quang/i })
    fireEvent.click(hallBtn)
    expect(screen.getByText(/Đền Vinh Quang Đang Chờ Đón/i)).toBeInTheDocument()

    const stairwayBtn = screen.getByRole('button', { name: /Bậc Thang Lên Trời/i })
    fireEvent.click(stairwayBtn)
    expect(screen.getByText(/Bầu trời xanh đang chờ ước mơ/i)).toBeInTheDocument()
  }, 15000)

  it('mở modal tạo mục tiêu mới', () => {
    renderGoalsPage()
    const addBtn = screen.getAllByRole('button', { name: /Thêm Mục Tiêu Lên Trời/i })[0]
    fireEvent.click(addBtn)

    expect(screen.getByText(/Tạo Mục tiêu Lên Trời Mới/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/VD: Đọc 20 cuốn sách/i)).toBeInTheDocument()
  }, 15000)
})
