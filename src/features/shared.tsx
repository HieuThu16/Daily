import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { loadLocal, saveLocal } from '../lib/persistence'
import { Plus, Trash2, X, Inbox } from 'lucide-react'

/** Supabase cắt mọi select ở 1000 dòng. App ghi nhật ký hằng ngày nên phải kéo hết từng trang. */
const PAGE_SIZE = 1000

async function fetchAll<T>(table: string, order: string): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; ; page += 1) {
    const { data, error } = await supabase!
      .from(table)
      .select('*')
      .is('deleted_at', null)
      .order(order, { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (error) throw error
    if (data) all.push(...(data as T[]))
    if (!data || data.length < PAGE_SIZE) return all
  }
}

// Giữ dữ liệu đã tải giữa các lần đổi tab để quay lại không thấy màn hình trống.
const cache = new Map<string, unknown[]>()

/** Cache còn sống qua cả lần tải lại trang: mất mạng vẫn xem được dữ liệu lần trước. */
const diskKey = (cacheKey: string) => `daily_cache_${cacheKey}`

/**
 * Trần cho phần ghi xuống localStorage.
 *
 * `media_items` gom cả sách, manga, nhạc, phim nên dễ vài nghìn dòng. Nén cả bảng
 * thành chuỗi rồi ghi sau MỖI lần tải và MỖI lần sửa tại chỗ vừa vượt hạn mức ~5MB
 * (rồi hỏng âm thầm), vừa chặn main thread đủ lâu để thấy giật.
 *
 * Bộ nhớ trong vẫn giữ đủ; chỉ phần dự phòng trên đĩa là cắt bớt — nó chỉ để
 * lần mở sau có cái hiện ngay, không phải nguồn sự thật.
 *
 * ponytail: cắt cứng theo số dòng và số ký tự. Muốn giữ trọn vẹn thì phải chuyển
 * sang IndexedDB, lúc đó bỏ hai hằng số này đi.
 */
const DISK_CACHE_MAX_ROWS = 400
const DISK_CACHE_MAX_CHARS = 1_000_000

function readCache<T>(cacheKey: string): T[] {
  const inMemory = cache.get(cacheKey)
  if (inMemory) return inMemory as T[]
  const onDisk = loadLocal<T[]>(diskKey(cacheKey), [])
  if (onDisk.length) cache.set(cacheKey, onDisk)
  return onDisk
}

function writeCache<T>(cacheKey: string, rows: T[]) {
  cache.set(cacheKey, rows)

  // Danh sách đã sắp giảm dần nên phần đầu là phần mới nhất — cắt đuôi là đúng cái cần giữ.
  let slice = rows.length > DISK_CACHE_MAX_ROWS ? rows.slice(0, DISK_CACHE_MAX_ROWS) : rows
  let serialized = JSON.stringify(slice)
  while (serialized.length > DISK_CACHE_MAX_CHARS && slice.length > 20) {
    slice = slice.slice(0, Math.floor(slice.length / 2))
    serialized = JSON.stringify(slice)
  }
  if (serialized.length > DISK_CACHE_MAX_CHARS) return

  // Quá hạn mức localStorage thì bỏ qua — cache chỉ là tiện ích, không phải nguồn sự thật.
  saveLocal(diskKey(cacheKey), slice)
}

export function useQuery<T>(table: string, order = 'created_at') {
  const cacheKey = `${table}:${order}`
  /*
   * Đổi bảng/thứ tự lúc lần tải trước còn dở thì kết quả cũ về sau sẽ đè lên
   * kết quả mới. Đánh số mỗi lần gọi, về trễ thì bỏ.
   */
  const requestId = useRef(0)
  const [items, setItems] = useState<T[]>(() => readCache<T>(cacheKey))
  // Đã có cache thì hiện ngay, làm mới ngầm — không chớp màn hình trống.
  const [loading, setLoading] = useState(() => readCache<T>(cacheKey).length === 0)
  const [error, setError] = useState('')

  const reload = async () => {
    if (!supabase) return
    const myId = ++requestId.current
    setLoading(readCache<T>(cacheKey).length === 0)
    try {
      const rows = await fetchAll<T>(table, order)
      if (myId !== requestId.current) return
      writeCache(cacheKey, rows)
      setItems(rows)
      setError('')
    } catch {
      if (myId !== requestId.current) return
      // Còn cache thì im lặng dùng tiếp; trắng tay mới báo lỗi.
      setError(readCache<T>(cacheKey).length ? '' : 'Chưa tải được dữ liệu. Thử lại nhé.')
    }
    if (myId === requestId.current) setLoading(false)
  }

  useEffect(() => {
    setItems(readCache<T>(cacheKey))
    void reload()
  }, [cacheKey])

  // Sửa tại chỗ cũng phải ghi vào cache, nếu không lần sau quay lại sẽ thấy dữ liệu cũ.
  const setItemsCached: typeof setItems = (update) => {
    setItems((prev) => {
      const next = typeof update === 'function' ? (update as (p: T[]) => T[])(prev) : update
      writeCache(cacheKey, next)
      return next
    })
  }

  return { items, setItems: setItemsCached, loading, error, reload }
}

/**
 * Dựng danh sách dài theo từng mẻ thay vì đổ hết ra DOM một lúc.
 *
 * Trả về số phần tử nên hiện và một ref để gắn vào thẻ canh cuối danh sách;
 * thẻ đó lọt vào tầm nhìn (trước 400px) thì tự nới thêm một mẻ. Đổi bộ lọc thì
 * `resetKey` đổi theo và đếm lại từ đầu, nếu không danh sách mới vẫn nặng như cũ.
 */
export function useIncrementalList(total: number, step = 48, resetKey: unknown = null) {
  const [visibleCount, setVisibleCount] = useState(step)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleCount(step)
  }, [resetKey, step])

  useEffect(() => {
    if (!sentinel.current || visibleCount >= total) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((prev) => Math.min(prev + step, total))
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [visibleCount, total, step])

  const showMore = () => setVisibleCount((prev) => Math.min(prev + step, total))
  const showAll = () => setVisibleCount(total)

  return { visibleCount, sentinel, showMore, showAll, hasMore: visibleCount < total, remaining: Math.max(0, total - visibleCount) }
}

/**
 * Nhớ vị trí cuộn của một trang danh sách qua các lần rời đi rồi quay lại.
 * `ready` bật khi dữ liệu đã dựng xong — cuộn sớm hơn thì trang còn ngắn, trôi về đầu.
 * Lưu trong sessionStorage nên đóng tab là quên, đúng nghĩa "phiên làm việc".
 */
export function useScrollRestore(key: string, ready: boolean) {
  useEffect(() => {
    const onScroll = () => sessionStorage.setItem(`daily_scroll_${key}`, String(window.scrollY))
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [key])

  useEffect(() => {
    if (!ready) return
    const saved = Number(sessionStorage.getItem(`daily_scroll_${key}`) ?? 0)
    if (saved <= 0) return
    const frame = requestAnimationFrame(() => window.scrollTo({ top: saved }))
    return () => cancelAnimationFrame(frame)
  }, [ready, key])
}

export function Empty({ children, icon: Icon = Inbox, colorClass = 'icon-box-blue' }: { children: React.ReactNode; icon?: any; colorClass?: string }) {
  return (
    <div className="empty">
      <div className={`empty-icon ${colorClass}`}>
        <Icon size={22} />
      </div>
      <span>{children}</span>
    </div>
  )
}

export function InlineForm({ placeholder, onSave }: { placeholder: string; onSave: (text: string) => Promise<void> }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!value.trim()) return
        setBusy(true)
        await onSave(value.trim())
        setValue('')
        setBusy(false)
      }}
    >
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      <button className="primary" disabled={busy}>
        <Plus size={16} />
        {busy ? 'Đang lưu…' : 'Thêm'}
      </button>
    </form>
  )
}

/**
 * Đóng hộp thoại khi bấm ra nền — nhưng chỉ khi cú bấm *bắt đầu và kết thúc* trên nền.
 * Bôi đen chữ trong hộp rồi nhả chuột ra ngoài sẽ sinh sự kiện click trên nền,
 * nếu chỉ nghe click hay mousedown thì form tắt ngang giữa lúc đang chọn chữ.
 */
export function useBackdropClose(onClose: () => void) {
  const startedOnBackdrop = useRef(false)
  return {
    onMouseDown: (e: React.MouseEvent) => {
      startedOnBackdrop.current = e.target === e.currentTarget
    },
    onClick: (e: React.MouseEvent) => {
      if (startedOnBackdrop.current && e.target === e.currentTarget) onClose()
    },
  }
}

/**
 * Đếm số hộp thoại đang mở: hộp lồng hộp thì chỉ hộp cuối cùng đóng lại mới
 * trả cuộn về cho trang, không thì đóng cái trong là nền cuộn lại ngay.
 */
let openModalCount = 0

function lockBodyScroll() {
  openModalCount += 1
  if (openModalCount > 1) return () => unlockBodyScroll()
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => unlockBodyScroll(previous)
}

function unlockBodyScroll(previous?: string) {
  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount === 0) document.body.style.overflow = previous ?? ''
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null)
  // `onClose` thường là arrow inline nên đổi mỗi lần render. Giữ qua ref để effect
  // chỉ chạy đúng một lần lúc mở — chạy lại sẽ cướp tiêu điểm giữa lúc người dùng gõ.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const backdrop = useBackdropClose(onClose)

  useEffect(() => {
    // Không khoá thì trên mobile vuốt trong hộp thoại là trang phía sau trôi theo.
    const unlock = lockBodyScroll()
    const opener = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return closeRef.current()
      if (e.key !== 'Tab' || !panel.current) return
      // Giữ Tab quẩn trong hộp thoại, nếu không tiêu điểm lọt ra trang phía sau.
      const stops = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!stops.length) return
      const edge = e.shiftKey ? stops[0] : stops[stops.length - 1]
      if (document.activeElement === edge) {
        e.preventDefault()
        ;(e.shiftKey ? stops[stops.length - 1] : stops[0]).focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlock()
      opener?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="modal-backdrop" role="presentation" {...backdrop}>
      <section ref={panel} className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" aria-label="Đóng" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  )
}

export function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      className="text-danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Xoá mục này? App không hoàn tác lại được.')) return
        setBusy(true)
        try {
          await onDelete()
        } finally {
          // Xoá hỏng mà không nhả busy thì nút kẹt "Đang xoá…" vĩnh viễn.
          setBusy(false)
        }
      }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Trash2 size={16} />
      {busy ? 'Đang xoá…' : 'Xoá'}
    </button>
  )
}
