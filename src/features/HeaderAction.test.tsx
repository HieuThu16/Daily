import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeaderActionProvider, useHeaderAction, useHeaderActionSlot } from './HeaderAction'

function Slot() {
  const action = useHeaderActionSlot()
  return action ? <button onClick={action.onClick}>{action.label}</button> : null
}

/** Cố tình KHÔNG bọc useCallback — đây chính là kiểu gọi làm MoneyPage render vô hạn. */
function PageWithInlineHandler({ onFire, renderCount }: { onFire: () => void; renderCount: { value: number } }) {
  renderCount.value += 1
  useHeaderAction('Ghi khoản tiền', () => onFire())
  return <span>trang</span>
}

afterEach(cleanup)

describe('useHeaderAction', () => {
  it('không render vô hạn khi onClick tạo mới mỗi lần render', () => {
    const renderCount = { value: 0 }
    render(
      <HeaderActionProvider>
        <Slot />
        <PageWithInlineHandler onFire={vi.fn()} renderCount={renderCount} />
      </HeaderActionProvider>,
    )
    expect(screen.getByRole('button', { name: 'Ghi khoản tiền' })).toBeInTheDocument()
    expect(renderCount.value).toBeLessThan(5)
  })

  it('luôn gọi bản onClick mới nhất', async () => {
    const user = userEvent.setup()
    const fire = vi.fn()
    render(
      <HeaderActionProvider>
        <Slot />
        <PageWithInlineHandler onFire={fire} renderCount={{ value: 0 }} />
      </HeaderActionProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Ghi khoản tiền' }))
    expect(fire).toHaveBeenCalledOnce()
  })
})
