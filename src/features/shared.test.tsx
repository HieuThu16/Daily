import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './shared'

afterEach(cleanup)

describe('Modal — bấm ra nền', () => {
  it('không đóng khi bôi đen chữ trong hộp rồi nhả chuột ra ngoài', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Thêm thẻ" onClose={onClose}>
        <p>nội dung cần bôi đen</p>
      </Modal>,
    )
    const backdrop = document.querySelector('.modal-backdrop')!
    const text = screen.getByText('nội dung cần bôi đen')

    fireEvent.mouseDown(text)
    fireEvent.mouseUp(backdrop)
    // Trình duyệt bắn click ở tổ tiên chung khi nhả ngoài phần tử đã nhấn.
    fireEvent.click(backdrop)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('vẫn đóng khi bấm gọn một cái vào nền', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Thêm thẻ" onClose={onClose}>
        <p>nội dung</p>
      </Modal>,
    )
    const backdrop = document.querySelector('.modal-backdrop')!
    fireEvent.mouseDown(backdrop)
    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
