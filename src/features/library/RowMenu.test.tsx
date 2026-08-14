import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RowMenu } from './RowMenu'

afterEach(cleanup)

const items = [
  { key: 'edit', label: 'Chỉnh sửa', onSelect: vi.fn() },
  { key: 'delete', label: 'Xoá khỏi thư viện', danger: true, onSelect: vi.fn() },
]

const open = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Thao tác' }))
  return user
}

describe('RowMenu', () => {
  it('đóng lúc đầu và mở khi bấm nút', async () => {
    render(<RowMenu label="Thao tác" icon={<span />} items={items} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await open()

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Chỉnh sửa' })).toBeInTheDocument()
  })

  it('bảng menu nằm ngoài thẻ mục để không bị overflow của thẻ cắt mất', async () => {
    const { container } = render(
      <div className="library-media-card" style={{ overflow: 'hidden' }}>
        <RowMenu label="Thao tác" icon={<span />} items={items} />
      </div>,
    )
    await open()

    const panel = screen.getByRole('menu')
    expect(container.contains(panel)).toBe(false)
    expect(document.body.contains(panel)).toBe(true)
  })

  it('chọn một mục thì gọi đúng hành động và đóng menu', async () => {
    const onSelect = vi.fn()
    render(<RowMenu label="Thao tác" icon={<span />} items={[{ key: 'edit', label: 'Chỉnh sửa', onSelect }]} />)
    const user = await open()

    await user.click(screen.getByRole('menuitem', { name: 'Chỉnh sửa' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('bấm ra ngoài thì đóng', async () => {
    render(
      <div>
        <RowMenu label="Thao tác" icon={<span />} items={items} />
        <button type="button">Chỗ khác</button>
      </div>,
    )
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Chỗ khác' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('bấm Esc thì đóng', async () => {
    render(<RowMenu label="Thao tác" icon={<span />} items={items} />)
    const user = await open()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('cuộn trang thì đóng, vì bảng định vị theo màn hình sẽ trôi lệch chỗ', async () => {
    render(<RowMenu label="Thao tác" icon={<span />} items={items} />)
    await open()

    fireEvent.scroll(window)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('lật lên trên khi phía dưới không đủ chỗ', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 730,
      right: 360,
      left: 326,
      width: 34,
      height: 34,
      x: 326,
      y: 700,
      toJSON: () => ({}),
    })
    vi.stubGlobal('innerHeight', 760)

    render(<RowMenu label="Thao tác" icon={<span />} items={items} />)
    await open()

    expect(screen.getByRole('menu')).toHaveClass('is-flipped')
    vi.restoreAllMocks()
  })
})
