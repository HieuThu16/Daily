import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarqueeText } from './MarqueeText'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/**
 * jsdom không bố cục thật nên scrollWidth/clientWidth luôn là 0. Giả lập hai
 * số đó để kiểm tra được đúng cái quyết định duy nhất của component:
 * chữ có tràn hay không.
 */
function mockWidths({ text, box }: { text: number; box: number }) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(text)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(box)
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
})

describe('MarqueeText', () => {
  it('chữ vừa chỗ thì đứng yên', () => {
    mockWidths({ text: 100, box: 200 })
    const { container } = render(<MarqueeText text="Tên ngắn" />)

    expect(container.querySelector('.marquee')).not.toHaveClass('is-running')
  })

  it('chữ tràn thì cho chạy và đặt quãng đường đúng bằng phần tràn', () => {
    mockWidths({ text: 320, box: 200 })
    const { container } = render(<MarqueeText text="Một cái tên rất dài không vừa chỗ" />)

    const box = container.querySelector('.marquee')!
    expect(box).toHaveClass('is-running')
    expect(container.querySelector<HTMLElement>('.marquee-inner')!.style.getPropertyValue('--marquee-shift')).toBe('120px')
  })

  it('chênh lệch làm tròn vài pixel thì không coi là tràn', () => {
    mockWidths({ text: 201, box: 200 })
    const { container } = render(<MarqueeText text="Vừa khít" />)

    expect(container.querySelector('.marquee')).not.toHaveClass('is-running')
  })

  it('luôn giữ tên đầy đủ trong title để rê chuột đọc được', () => {
    mockWidths({ text: 320, box: 200 })
    render(<MarqueeText text="Ngày đẹp trời để nói chia tay" />)

    expect(screen.getByTitle('Ngày đẹp trời để nói chia tay')).toBeInTheDocument()
  })
})
