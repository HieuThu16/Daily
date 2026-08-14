import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Store = { el: HTMLElement | null; setEl: (el: HTMLElement | null) => void }

const AsideContext = createContext<Store>({ el: null, setEl: () => {} })

/**
 * Cột phụ bên phải của bố cục desktop.
 *
 * Context chỉ giữ *thẻ DOM* của cột, không giữ nội dung. Trang đẩy nội dung
 * vào bằng portal nên render lại bao nhiêu lần cũng không đụng tới state của
 * provider. Bản trước cất ReactNode vào state và bị lặp vô hạn: trang render
 * -> setState -> cả cây render lại -> node mới -> setState... Với portal thì
 * không còn đường nào tạo ra vòng lặp đó nữa.
 *
 * Cột luôn được dựng kể cả trên điện thoại rồi mới bị CSS ẩn, để chỉ có một
 * nơi quyết định desktop hay không (media query trong styles.css).
 */
export function AsideProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  return <AsideContext.Provider value={{ el, setEl }}>{children}</AsideContext.Provider>
}

/** App gắn ref này lên thẻ <aside> của khung. */
export function useAsideRef() {
  return useContext(AsideContext).setEl
}

/** Trang bọc nội dung cột phụ trong thẻ này. Chưa có cột thì không vẽ gì. */
export function Aside({ children }: { children: ReactNode }) {
  const { el } = useContext(AsideContext)
  return el ? createPortal(children, el) : null
}

/** Một khối trong cột phụ: tiêu đề nhỏ chữ hoa + nội dung. */
export function AsideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="aside-card">
      <h3 className="aside-card-title">{title}</h3>
      {children}
    </section>
  )
}
