import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type RowMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  /** Tô đỏ cho hành động phá huỷ. */
  danger?: boolean
  /** Dấu tích cho mục đang được chọn (dùng cho menu trạng thái). */
  checked?: boolean
  onSelect: () => void
}

type Props = {
  label: string
  icon: ReactNode
  items: RowMenuItem[]
  /** Màu chữ/viền của nút mở, dùng để lộ trạng thái ra ngoài menu. */
  tone?: string
  className?: string
}

type Position = { top: number; right: number; flipped: boolean }

const PANEL_GAP = 6
/** Ước lượng chiều cao bảng để biết còn chỗ mở xuống dưới hay phải lật lên. */
const ITEM_HEIGHT = 36
const PANEL_PADDING = 12

/**
 * Menu nhỏ bung ra từ một nút trên dòng danh sách.
 *
 * Bảng menu được đưa ra thẳng <body> bằng portal, định vị `fixed`. Bắt buộc
 * phải vậy: thẻ mục có `overflow: hidden` và danh sách có `overflow-y: auto`,
 * nên một bảng `position: absolute` nằm trong đó sẽ bị CẮT CỤT — z-index bao
 * nhiêu cũng vô ích, vì overflow cắt trước khi xếp lớp.
 *
 * Không dùng <select> vì bản thiết kế chỉ chừa chỗ cho một cái mũi tên, mà
 * select gốc luôn kéo theo phần chữ của lựa chọn hiện tại.
 */
export function RowMenu({ label, icon, items, tone, className }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const height = items.length * ITEM_HEIGHT + PANEL_PADDING
    const spaceBelow = window.innerHeight - rect.bottom
    const flipped = spaceBelow < height + PANEL_GAP && rect.top > spaceBelow

    setPosition({
      top: flipped ? rect.top - PANEL_GAP : rect.bottom + PANEL_GAP,
      right: window.innerWidth - rect.right,
      flipped,
    })
  }, [open, items.length])

  // Bấm ra ngoài, bấm Esc, hoặc cuộn trang thì đóng. Cuộn phải đóng vì bảng
  // định vị theo màn hình chứ không dính vào nút, để lại là nó trôi lệch chỗ.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const close = () => setOpen(false)

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const panel = open && position && (
    <div
      ref={panelRef}
      className={'row-menu-panel' + (position.flipped ? ' is-flipped' : '')}
      id={menuId}
      role="menu"
      style={{ top: position.top, right: position.right }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={'row-menu-item' + (item.danger ? ' is-danger' : '') + (item.checked ? ' is-checked' : '')}
          onClick={() => {
            setOpen(false)
            item.onSelect()
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className={'row-menu' + (className ? ` ${className}` : '')}>
      <button
        ref={triggerRef}
        type="button"
        className="row-menu-trigger"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        style={tone ? { color: tone, borderColor: tone } : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  )
}
