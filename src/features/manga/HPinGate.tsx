import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Delete, Flame } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const SESSION_KEY = 'daily_h_manga_pin_unlocked'
const CORRECT_PIN = '2580'

export function isHUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

export function lockH(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function unlockH(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, 'true')
  } catch {
    // ignore
  }
}

type Props = {
  children: ReactNode
}

export function HPinGate({ children }: Props) {
  const navigate = useNavigate()
  const [unlocked, setUnlocked] = useState(() => isHUnlocked())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  // Listen for keyboard input (0-9, Backspace, Enter)
  useEffect(() => {
    if (unlocked) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Enter') {
        handleSubmit(pin)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [unlocked, pin])

  const triggerError = () => {
    setError('Mật khẩu không đúng!')
    setShake(true)
    setTimeout(() => {
      setShake(false)
      setPin('')
    }, 500)
  }

  const handleSubmit = (currentPin: string) => {
    if (currentPin === CORRECT_PIN) {
      unlockH()
      setUnlocked(true)
      setError('')
    } else {
      triggerError()
    }
  }

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return
    setError('')
    const nextPin = pin + digit
    setPin(nextPin)
    if (nextPin.length === 4) {
      if (nextPin === CORRECT_PIN) {
        unlockH()
        setTimeout(() => setUnlocked(true), 150)
      } else {
        triggerError()
      }
    }
  }

  const handleBackspace = () => {
    setError('')
    setPin((prev) => prev.slice(0, -1))
  }

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '75vh',
        padding: '24px 16px',
        maxWidth: 400,
        margin: '0 auto',
        userSelect: 'none',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          padding: '28px 20px',
          borderRadius: 24,
          border: '1.5px solid rgba(225, 29, 72, 0.3)',
          background: 'linear-gradient(180deg, var(--card-bg) 0%, rgba(225, 29, 72, 0.05) 100%)',
          boxShadow: '0 10px 30px rgba(225, 29, 72, 0.12)',
          textAlign: 'center',
          animation: shake ? 'shake 0.4s ease-in-out' : 'none',
        }}
      >
        {/* Icon Lock */}
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #e11d48, #be123c)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 6px 16px rgba(225, 29, 72, 0.35)',
          }}
        >
          <Flame size={30} />
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Truyện H (18+)
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Mục này được bảo vệ bằng mật khẩu.<br />
          Vui lòng nhập mã PIN để mở khóa.
        </p>

        {/* PIN Dots display */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index
            return (
              <div
                key={index}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `2px solid ${error ? '#e11d48' : isFilled ? '#e11d48' : 'var(--card-border)'}`,
                  background: isFilled ? '#e11d48' : 'transparent',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.18s ease',
                  boxShadow: isFilled ? '0 0 8px rgba(225, 29, 72, 0.5)' : 'none',
                }}
              />
            )
          })}
        </div>

        {/* Error message */}
        {error ? (
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e11d48', marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        ) : (
          <div style={{ height: 16, marginBottom: 16 }} />
        )}

        {/* Numpad 0-9 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            maxWidth: 260,
            margin: '0 auto 20px',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              style={{
                height: 52,
                borderRadius: 14,
                border: '1px solid var(--card-border)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '1.3rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.92)'
                e.currentTarget.style.background = 'rgba(225, 29, 72, 0.15)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'var(--bg-main)'
              }}
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: Back, 0, Backspace */}
          <button
            type="button"
            onClick={() => navigate('/home')}
            style={{
              height: 52,
              borderRadius: 14,
              border: 0,
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            style={{
              height: 52,
              borderRadius: 14,
              border: '1px solid var(--card-border)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '1.3rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.92)'
              e.currentTarget.style.background = 'rgba(225, 29, 72, 0.15)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.background = 'var(--bg-main)'
            }}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Xóa"
            style={{
              height: 52,
              borderRadius: 14,
              border: 0,
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Back home button */}
        <button
          type="button"
          onClick={() => navigate('/home')}
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: '6px 12px',
          }}
        >
          ← Quay lại Trang chủ
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}
