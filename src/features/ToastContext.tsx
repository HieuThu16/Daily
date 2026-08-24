import React, { createContext, useCallback, useContext, useState } from 'react'
import { Z } from '../lib/zLayers'

type ToastType = 'success' | 'info' | 'delete' | 'supabase' | 'local' | 'error'

type ToastMessage = {
  id: number
  message: string
  type?: ToastType
  onUndo?: () => void
}

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void
  showSaveToast: (isSupabaseSaved: boolean, actionLabel?: string) => void
  /** Toast kèm nút Hoàn tác, sống 6 giây cho kịp bấm. */
  showUndoToast: (message: string, onUndo: () => void) => void
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showSaveToast: () => {},
  showUndoToast: () => {},
})

export const useToast = () => useContext(ToastContext)

let nextToastId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    // Date.now() trùng khi hai toast bắn cùng mili giây, cái này sẽ xoá nhầm cái kia.
    const id = (nextToastId += 1)
    // Giữ tối đa 3 cái: báo lưu và báo lỗi hay bắn liên tiếp, đè nhau thì mất thông tin.
    setToasts((current) => [...current, { id, message, type }].slice(-3))
    // Cảnh báo lưu hỏng thường kèm câu lỗi dài, cần thời gian đọc lâu hơn
    setTimeout(() => dismiss(id), type === 'local' || type === 'error' ? 6000 : 2500)
  }, [dismiss])

  const showUndoToast = useCallback((message: string, onUndo: () => void) => {
    const id = (nextToastId += 1)
    setToasts((current) => [...current, { id, message, type: 'delete' as ToastType, onUndo }].slice(-3))
    setTimeout(() => dismiss(id), 6000)
  }, [dismiss])

  const showSaveToast = useCallback((isSupabaseSaved: boolean, actionLabel: string = 'dữ liệu') => {
    if (isSupabaseSaved) {
      showToast(`☁️ Đã lưu ${actionLabel} lên Supabase!`, 'supabase')
    } else {
      showToast(`💾 Đã lưu tạm ${actionLabel} vào Local!`, 'local')
    }
  }, [showToast])

  const getToastColors = (type?: ToastType) => {
    switch (type) {
      case 'error':
      case 'delete':
        return { color: 'var(--rose)', border: 'var(--rose)', bg: 'var(--card-bg)' }
      case 'info':
        return { color: 'var(--primary)', border: 'var(--primary)', bg: 'var(--card-bg)' }
      case 'supabase':
        return { color: '#2563eb', border: '#2563eb', bg: 'var(--card-bg)' }
      case 'local':
        return { color: '#d97706', border: '#d97706', bg: 'var(--card-bg)' }
      default:
        return { color: 'var(--emerald)', border: 'var(--emerald)', bg: 'var(--card-bg)' }
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, showSaveToast, showUndoToast }}>
      {children}
      <div
        // role="status" để trình đọc màn hình đọc lên mà không cướp tiêu điểm.
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 68,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: Z.toast,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const colors = getToastColors(toast.type)
          return (
            <div
              key={toast.id}
              role={toast.onUndo ? 'group' : undefined}
              onClick={() => !toast.onUndo && dismiss(toast.id)}
              className={`app-toast toast-${toast.type || 'success'}`}
              style={{
                background: colors.bg,
                color: colors.color,
                border: `1.5px solid ${colors.border}`,
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 700,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backdropFilter: 'blur(12px)',
                animation: 'toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                maxWidth: 'min(92vw, 460px)',
                textAlign: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
            >
              <span>{toast.message}</span>
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onUndo?.()
                    dismiss(toast.id)
                  }}
                  style={{ border: 0, background: 'transparent', color: 'var(--cyan)', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Hoàn tác
                </button>
              )}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
