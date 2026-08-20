import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bom({ explode }: { explode: boolean }) {
  if (explode) throw new Error('dữ liệu lạ')
  return <p>Nội dung tab</p>
}

describe('ErrorBoundary', () => {
  // React in nguyên vết lỗi ra console khi boundary bắt được; tắt cho đỡ nhiễu output test.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  // Dự án không bật cleanup tự động, không dọn thì render trước còn nằm lại trong DOM.
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('không có lỗi thì hiện nguyên nội dung', () => {
    render(<ErrorBoundary><Bom explode={false} /></ErrorBoundary>)
    expect(screen.getByText('Nội dung tab')).toBeTruthy()
  })

  it('tab lỗi thì hiện lối thoát thay vì màn hình trắng', () => {
    render(<ErrorBoundary><Bom explode /></ErrorBoundary>)
    expect(screen.getByText('Mục này đang lỗi')).toBeTruthy()
    expect(screen.getByText('Thử lại')).toBeTruthy()
    expect(screen.getByText('dữ liệu lạ')).toBeTruthy()
  })

  it('đổi key (đổi tab) thì boundary dựng lại, không kẹt ở màn hình lỗi', () => {
    const { rerender } = render(<ErrorBoundary key="/money"><Bom explode /></ErrorBoundary>)
    expect(screen.getByText('Mục này đang lỗi')).toBeTruthy()

    rerender(<ErrorBoundary key="/home"><Bom explode={false} /></ErrorBoundary>)
    expect(screen.getByText('Nội dung tab')).toBeTruthy()
  })
})
