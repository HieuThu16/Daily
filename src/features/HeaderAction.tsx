import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type HeaderAction = { label: string; onClick: () => void }

type Store = { action: HeaderAction | null; setAction: (action: HeaderAction | null) => void }

const HeaderActionContext = createContext<Store>({ action: null, setAction: () => {} })

/** Ô hành động riêng của từng tab, hiện trong header chung. */
export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<HeaderAction | null>(null)
  return <HeaderActionContext.Provider value={{ action, setAction }}>{children}</HeaderActionContext.Provider>
}

export function useHeaderActionSlot(): HeaderAction | null {
  return useContext(HeaderActionContext).action
}

/** Trang gọi hook này để chiếm ô hành động; rời trang thì tự trả lại. */
export function useHeaderAction(label: string, onClick: () => void) {
  const { setAction } = useContext(HeaderActionContext)
  useEffect(() => {
    setAction({ label, onClick })
    return () => setAction(null)
  }, [label, onClick, setAction])
}
