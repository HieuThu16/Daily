import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type HeaderAction = { label: string; onClick: () => void }

type Store = {
  action: HeaderAction | null
  setAction: (action: HeaderAction | null) => void
  hidden: boolean
  setHidden: (hidden: boolean) => void
}

const HeaderActionContext = createContext<Store>({
  action: null,
  setAction: () => {},
  hidden: false,
  setHidden: () => {},
})

/** Ô hành động riêng của từng tab, hiện trong header chung. */
export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<HeaderAction | null>(null)
  const [hidden, setHidden] = useState(false)
  return (
    <HeaderActionContext.Provider value={{ action, setAction, hidden, setHidden }}>
      {children}
    </HeaderActionContext.Provider>
  )
}

export function useHeaderActionSlot(): HeaderAction | null {
  return useContext(HeaderActionContext).action
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
  const { setAction } = useContext(HeaderActionContext)
  const handler = useRef(onClick)
  handler.current = onClick

  useEffect(() => {
    setAction({ label, onClick: () => handler.current() })
    return () => setAction(null)
  }, [label, setAction])
}
