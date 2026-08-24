import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/** `icon` là mã tên, không phải JSX, để mảng hành động giữ được tham chiếu ổn định. */
export type HeaderActionIcon = 'plus' | 'radio' | 'download'
export type HeaderAction = { label: string; icon?: HeaderActionIcon; onClick: () => void }

type Store = {
  actions: HeaderAction[]
  setActions: (actions: HeaderAction[]) => void
  hidden: boolean
  setHidden: (hidden: boolean) => void
}

const HeaderActionContext = createContext<Store>({
  actions: [],
  setActions: () => {},
  hidden: false,
  setHidden: () => {},
})

/** Ô hành động riêng của từng tab, hiện trong header chung. */
export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<HeaderAction[]>([])
  const [hidden, setHidden] = useState(false)
  return (
    <HeaderActionContext.Provider value={{ actions, setActions, hidden, setHidden }}>
      {children}
    </HeaderActionContext.Provider>
  )
}

export function useHeaderActionSlot(): HeaderAction | null {
  return useContext(HeaderActionContext).actions[0] ?? null
}

export function useHeaderActionSlots(): HeaderAction[] {
  return useContext(HeaderActionContext).actions
}

export function useIsHeaderHidden(): boolean {
  return useContext(HeaderActionContext).hidden
}

/** Hook để ẩn header chung của app khi ở trong trang chi tiết */
export function useHideHeader(shouldHide = true) {
  const { setHidden } = useContext(HeaderActionContext)
  useEffect(() => {
    setHidden(shouldHide)
    return () => setHidden(false)
  }, [shouldHide, setHidden])
}

/**
 * Trang gọi hook này để chiếm ô hành động; rời trang thì tự trả lại.
 * `onClick` giữ trong ref nên trang không cần bọc useCallback — nếu để nó trong
 * deps, một hàm tạo mới mỗi lần render sẽ chạy effect → setState → render vô hạn.
 */
export function useHeaderAction(label: string, onClick: () => void) {
  const { setActions } = useContext(HeaderActionContext)
  const handler = useRef(onClick)
  handler.current = onClick

  useEffect(() => {
    setActions([{ label, onClick: () => handler.current() }])
    return () => setActions([])
  }, [label, setActions])
}

/**
 * Đặt nhiều nút vào header (vd Thêm kênh + Thêm video lẻ). Mảng `items` được phép
 * tạo mới mỗi lần render: handler giữ trong ref, effect chỉ chạy lại khi nhãn đổi.
 */
export function useHeaderActions(items: HeaderAction[]) {
  const { setActions } = useContext(HeaderActionContext)
  const latest = useRef(items)
  latest.current = items
  const key = items.map((a) => `${a.label}:${a.icon ?? 'plus'}`).join('|')

  useEffect(() => {
    setActions(
      latest.current.map((a, i) => ({
        label: a.label,
        icon: a.icon,
        onClick: () => latest.current[i]?.onClick(),
      }))
    )
    return () => setActions([])
  }, [key, setActions])
}
