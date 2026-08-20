import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Pause, Play, Plus, Settings2 } from 'lucide-react'
import { loadLocal, saveLocal } from '../../lib/persistence'

const PREFS_KEY = 'daily_reader_prefs'

export type ReaderPrefs = {
  /** Pixel mỗi giây khi tự cuộn. */
  speed: number
  /** Khoảng hở giữa hai ảnh, px. Webtoon thường để 0 cho liền mạch. */
  gap: number
  /** Bề ngang tối đa của khung đọc, px. */
  maxWidth: number
  background: 'dark' | 'gray' | 'black'
}

const DEFAULT_PREFS: ReaderPrefs = { speed: 60, gap: 0, maxWidth: 800, background: 'dark' }

const BACKGROUNDS: Record<ReaderPrefs['background'], string> = {
  dark: '#111827',
  gray: '#4b5563',
  black: '#000000',
}

export function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => ({ ...DEFAULT_PREFS, ...loadLocal<Partial<ReaderPrefs>>(PREFS_KEY, {}) }))

  const update = useCallback((patch: Partial<ReaderPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveLocal(PREFS_KEY, next)
      return next
    })
  }, [])

  /** Đưa thẳng vào style của khung đọc. */
  const readerStyle: React.CSSProperties = {
    maxWidth: prefs.maxWidth,
    background: BACKGROUNDS[prefs.background],
    ['--reader-gap' as string]: `${prefs.gap}px`,
  }

  return { prefs, update, readerStyle }
}

/**
 * Tự cuộn đều tay bằng requestAnimationFrame.
 * `getScroller` trả về phần tử cuộn, hoặc null nếu cả trang là phần cuộn (window).
 * Chạm vào màn hình, lăn chuột hay bấm phím cách thì dừng — phản xạ khi muốn đọc kỹ.
 */
export function useAutoScroll(getScroller: () => HTMLElement | null, speed: number) {
  const [running, setRunning] = useState(false)
  const frame = useRef(0)
  const leftover = useRef(0)

  useEffect(() => {
    if (!running) return
    let last = performance.now()

    const step = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      const el = getScroller()
      // Cộng dồn phần lẻ dưới 1px, nếu không tốc độ chậm sẽ đứng yên mãi.
      const move = speed * delta + leftover.current
      const whole = Math.floor(move)
      leftover.current = move - whole

      if (whole > 0) {
        if (el) {
          const before = el.scrollTop
          el.scrollTop = before + whole
          if (el.scrollTop === before) setRunning(false) // chạm đáy
        } else {
          const before = window.scrollY
          window.scrollBy(0, whole)
          if (window.scrollY === before) setRunning(false)
        }
      }
      frame.current = requestAnimationFrame(step)
    }

    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [running, speed, getScroller])

  useEffect(() => {
    if (!running) return
    const stop = () => setRunning(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        setRunning(false)
      }
    }
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('keydown', onKey)
    }
  }, [running])

  return { running, setRunning, toggle: () => setRunning((r) => !r) }
}

/** Thanh nổi góc phải: bật/tắt tự cuộn, chỉnh tốc độ và các tuỳ chọn hiển thị. */
export function ReaderControls({
  running,
  onToggle,
  prefs,
  onChange,
}: {
  running: boolean
  onToggle: () => void
  prefs: ReaderPrefs
  onChange: (patch: Partial<ReaderPrefs>) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="reader-controls">
      {open && (
        <div className="reader-controls-panel">
          <label>
            Tốc độ cuộn: <strong>{prefs.speed}</strong> px/giây
            <input
              type="range"
              min={10}
              max={300}
              step={10}
              value={prefs.speed}
              onChange={(e) => onChange({ speed: Number(e.target.value) })}
            />
          </label>

          <label>
            Cách nhau: <strong>{prefs.gap}px</strong>
            <input type="range" min={0} max={24} step={2} value={prefs.gap} onChange={(e) => onChange({ gap: Number(e.target.value) })} />
          </label>

          <label>
            Bề ngang: <strong>{prefs.maxWidth}px</strong>
            <input
              type="range"
              min={480}
              max={1400}
              step={40}
              value={prefs.maxWidth}
              onChange={(e) => onChange({ maxWidth: Number(e.target.value) })}
            />
          </label>

          <div className="reader-bg-row">
            {(['dark', 'gray', 'black'] as const).map((bg) => (
              <button
                key={bg}
                type="button"
                className={prefs.background === bg ? 'on' : undefined}
                onClick={() => onChange({ background: bg })}
              >
                {bg === 'dark' ? 'Tối' : bg === 'gray' ? 'Xám' : 'Đen'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="reader-controls-bar">
        <button type="button" onClick={() => onChange({ speed: Math.max(10, prefs.speed - 20) })} aria-label="Cuộn chậm lại">
          <Minus size={15} />
        </button>
        <button type="button" className="reader-play" onClick={onToggle} aria-label={running ? 'Dừng tự cuộn' : 'Tự cuộn'}>
          {running ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button type="button" onClick={() => onChange({ speed: Math.min(300, prefs.speed + 20) })} aria-label="Cuộn nhanh hơn">
          <Plus size={15} />
        </button>
        <button type="button" className={open ? 'on' : undefined} onClick={() => setOpen((v) => !v)} aria-label="Tuỳ chọn hiển thị">
          <Settings2 size={15} />
        </button>
      </div>
    </div>
  )
}
