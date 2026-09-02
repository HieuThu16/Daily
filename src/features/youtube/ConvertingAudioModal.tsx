import { useEffect, useState } from 'react'
import { Headphones, Sparkles, CheckCircle2, AlertCircle, Loader2, X, Music2 } from 'lucide-react'

export type ConvertingAudioState = {
  isOpen: boolean
  videoId: string
  title: string
  channelName?: string | null
  thumbnail?: string | null
  progress: number
  statusText: string
  error: string | null
  isCompleted: boolean
}

export function ConvertingAudioModal({
  state,
  onClose,
  onRetry,
}: {
  state: ConvertingAudioState
  onClose: () => void
  onRetry?: () => void
}) {
  const [displayPercent, setDisplayPercent] = useState(0)

  // Smooth animation for percentage progress
  useEffect(() => {
    if (!state.isOpen) {
      setDisplayPercent(0)
      return
    }

    const target = Math.min(100, Math.max(0, state.progress))
    const timer = setTimeout(() => {
      setDisplayPercent((prev) => {
        if (target > prev) {
          return prev + Math.ceil((target - prev) / 3)
        }
        return target
      })
    }, 50)

    return () => clearTimeout(timer)
  }, [state.progress, state.isOpen, displayPercent])

  // Auto-close on complete after 1.2 seconds
  useEffect(() => {
    if (state.isCompleted && state.isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [state.isCompleted, state.isOpen, onClose])

  if (!state.isOpen) return null

  return (
    <div
      className="daily-modal-overlay"
      onClick={state.error || state.isCompleted ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="converting-audio-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: 'var(--card-bg, #18181b)',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(6, 182, 212, 0.2)',
          borderRadius: 24,
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Glow ambient background */}
        <div
          style={{
            position: 'absolute',
            top: -50,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(59, 130, 246, 0) 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Nút đóng (hiện khi lỗi hoặc đã xong) */}
        {(state.error || state.isCompleted) && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-main, #fff)',
              cursor: 'pointer',
              zIndex: 2,
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Icon & Animation Header */}
        <div style={{ position: 'relative', marginBottom: 18, zIndex: 1 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: state.error
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.35))'
                : state.isCompleted
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.35))'
                  : 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.3))',
              border: state.error
                ? '2px solid rgba(239, 68, 68, 0.5)'
                : state.isCompleted
                  ? '2px solid rgba(16, 185, 129, 0.6)'
                  : '2px solid rgba(6, 182, 212, 0.6)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: state.isCompleted
                ? '0 0 24px rgba(16, 185, 129, 0.4)'
                : '0 0 24px rgba(6, 182, 212, 0.35)',
            }}
          >
            {state.error ? (
              <AlertCircle size={38} color="#ef4444" />
            ) : state.isCompleted ? (
              <CheckCircle2 size={40} color="#10b981" />
            ) : (
              <Headphones size={38} color="#06b6d4" className="audio-converting-pulse" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text-main, #fff)',
            zIndex: 1,
          }}
        >
          {state.error
            ? 'Chuyển đổi Audio không thành công'
            : state.isCompleted
              ? 'Đã chuyển thành Audio thành công!'
              : 'Đang chuyển đổi Video sang Audio'}
        </h3>

        {/* Video preview card */}
        <div
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            zIndex: 1,
            textAlign: 'left',
          }}
        >
          {state.thumbnail ? (
            <img
              src={state.thumbnail}
              alt=""
              style={{
                width: 64,
                height: 44,
                borderRadius: 8,
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 44,
                borderRadius: 8,
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Music2 size={20} color="#06b6d4" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong
              style={{
                display: 'block',
                fontSize: '0.86rem',
                fontWeight: 700,
                color: 'var(--text-main, #fff)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {state.title || 'Video YouTube'}
            </strong>
            <small style={{ color: 'var(--text-muted, #a1a1aa)', fontSize: '0.75rem' }}>
              {state.channelName || 'YouTube Audio'}
            </small>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        {!state.error && (
          <div style={{ width: '100%', marginBottom: 16, zIndex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-muted, #a1a1aa)',
                }}
              >
                Tiến độ xử lý
              </span>
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  color: state.isCompleted ? '#10b981' : '#06b6d4',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {displayPercent}%
              </span>
            </div>

            {/* Glowing Progress Track */}
            <div
              style={{
                width: '100%',
                height: 10,
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 99,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${displayPercent}%`,
                  height: '100%',
                  background: state.isCompleted
                    ? 'linear-gradient(90deg, #10b981, #06b6d4)'
                    : 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)',
                  borderRadius: 99,
                  transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: state.isCompleted
                    ? '0 0 12px rgba(16, 185, 129, 0.8)'
                    : '0 0 12px rgba(6, 182, 212, 0.8)',
                }}
              />
            </div>
          </div>
        )}

        {/* Status Message Text */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: state.error
              ? 'rgba(239, 68, 68, 0.12)'
              : state.isCompleted
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(6, 182, 212, 0.1)',
            border: state.error
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : state.isCompleted
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(6, 182, 212, 0.25)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            zIndex: 1,
            marginBottom: state.error ? 16 : 0,
          }}
        >
          {!state.error && !state.isCompleted && <Loader2 size={16} className="tv-spin text-cyan" />}
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: state.error ? '#f87171' : state.isCompleted ? '#34d399' : 'var(--text-main, #fff)',
            }}
          >
            {state.error || state.statusText || 'Đang chuẩn bị...'}
          </span>
        </div>

        {/* Error retry / dismiss actions */}
        {state.error && (
          <div style={{ display: 'flex', gap: 10, width: '100%', zIndex: 1 }}>
            <button
              type="button"
              className="tv-btn"
              onClick={onClose}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Đóng
            </button>
            {onRetry && (
              <button
                type="button"
                className="tv-btn primary"
                onClick={onRetry}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Thử lại
              </button>
            )}
          </div>
        )}

        {/* Footer tip */}
        {!state.error && (
          <small
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 16,
              color: 'var(--text-muted, #a1a1aa)',
              fontSize: '0.74rem',
              zIndex: 1,
            }}
          >
            <Sparkles size={12} color="#06b6d4" />
            Hỗ trợ tắt màn hình & chạy ngầm qua Trình phát Audio
          </small>
        )}
      </div>
    </div>
  )
}
