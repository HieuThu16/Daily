import React, { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'info' | 'delete' | 'supabase' | 'local'

type ToastMessage = {
  id: number
  message: string
  type?: ToastType
}

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void
  showSaveToast: (isSupabaseSaved: boolean, actionLabel?: string) => void
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showSaveToast: () => {},
})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToast({ id, message, type })
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current))
    }, 2500)
  }, [])

  const showSaveToast = useCallback((isSupabaseSaved: boolean, actionLabel: string = 'dữ liệu') => {
    if (isSupabaseSaved) {
      showToast(`☁️ Đã lưu ${actionLabel} lên Supabase!`, 'supabase')
    } else {
      showToast(`💾 Đã lưu tạm ${actionLabel} vào Local!`, 'local')
    }
  }, [showToast])

  const getToastColors = (type?: ToastType) => {
    switch (type) {
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

  const currentColors = getToastColors(toast?.type)

  return (
    <ToastContext.Provider value={{ showToast, showSaveToast }}>
      {children}
      {toast && (
        <div
          className={`app-toast toast-${toast.type || 'success'}`}
          style={{
            position: 'fixed',
            bottom: 68,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: currentColors.bg,
            color: currentColors.color,
            border: `1.5px solid ${currentColors.border}`,
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
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  )
}
