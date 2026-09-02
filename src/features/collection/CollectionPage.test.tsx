import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CollectionPage } from './CollectionPage'
import { ToastProvider } from '../ToastContext'

function renderCollectionPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <CollectionPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('CollectionPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('hiển thị thanh điều hướng khoảnh khắc', () => {
    renderCollectionPage()
    expect(screen.getAllByRole('button', { name: /Theo Ngày/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Dòng Thời Gian/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thư Viện Media/i })).toBeInTheDocument()
  })

  it('chuyển đổi tab xem giữa Theo Ngày, Dòng thời gian, Thư viện và Sưu tập đặc biệt', () => {
    renderCollectionPage()

    const timelineBtn = screen.getByRole('button', { name: /Dòng Thời Gian/i })
    fireEvent.click(timelineBtn)
    expect(timelineBtn).toHaveClass('active')

    const galleryBtn = screen.getByRole('button', { name: /Thư Viện Media/i })
    fireEvent.click(galleryBtn)
    expect(galleryBtn).toHaveClass('active')

    const specialBtn = screen.getByRole('button', { name: /Sưu Tập Đặc Biệt/i })
    fireEvent.click(specialBtn)
    expect(specialBtn).toHaveClass('active')
  })

  it('thao tác chuyển ngày hôm qua và ngày mai', () => {
    renderCollectionPage()
    const prevDayBtn = screen.getByRole('button', { name: /Hôm qua/i })
    fireEvent.click(prevDayBtn)

    const nextDayBtn = screen.getByRole('button', { name: /Ngày mai/i })
    fireEvent.click(nextDayBtn)

    expect(screen.getByRole('button', { name: /Hôm nay/i })).toBeInTheDocument()
  })
})
