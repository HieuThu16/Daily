import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search, X } from 'lucide-react'
import { filterStatic, searchEverything, type SearchHit } from '../lib/globalSearch'
import { useBackdropClose } from './shared'

export type PaletteTab = { id: string; label: string; group: string }

const DEBOUNCE_MS = 250

/** Sự kiện mở palette từ nút bấm (mobile không có bàn phím để bấm Ctrl+K). */
const OPEN_EVENT = 'daily-open-command-palette'

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

/** Ctrl/Cmd+K: gõ để nhảy tab hoặc tìm task / người / thẻ học / sách xuyên nghiệp vụ. */
export function CommandPalette({ tabs }: { tabs: PaletteTab[] }) {
  const [open, setOpen] = useState(false)
  const backdrop = useBackdropClose(() => setOpen(false))
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setRemote([])
      setCursor(0)
      return
    }
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Tab lọc tại chỗ (chạy được cả khi mất mạng); dữ liệu thì hỏi Supabase sau khi ngừng gõ.
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setRemote([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const hits = await searchEverything(query)
      setRemote(hits)
      setSearching(false)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, open])

  const hits = useMemo<SearchHit[]>(() => {
    const tabHits = filterStatic(tabs, query, (t) => t.label).map<SearchHit>((t) => ({
      id: `tab-${t.id}`,
      group: 'Màn hình',
      title: t.label,
      subtitle: t.group,
      path: '/' + t.id,
    }))
    return [...tabHits.slice(0, 6), ...remote]
  }, [tabs, query, remote])

  useEffect(() => {
    setCursor((c) => (c >= hits.length ? 0 : c))
  }, [hits.length])

  const go = (hit: SearchHit) => {
    setOpen(false)
    nav(hit.path)
  }

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (hits.length ? (c + 1) % hits.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (hits.length ? (c - 1 + hits.length) % hits.length : 0))
    } else if (e.key === 'Enter' && hits[cursor]) {
      e.preventDefault()
      go(hits[cursor])
    }
  }

  if (!open) return null

  let lastGroup = ''

  return createPortal(
    <div className="cmdk-backdrop" role="presentation" {...backdrop}>
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Tìm kiếm toàn app" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Tìm màn hình, công việc, người, thẻ học, sách…"
            aria-label="Từ khoá tìm kiếm"
          />
          <button type="button" className="cmdk-close" onClick={() => setOpen(false)} aria-label="Đóng tìm kiếm">
            <X size={16} />
          </button>
        </div>

        <div className="cmdk-results">
          {hits.length === 0 && (
            <p className="cmdk-empty">{searching ? 'Đang tìm…' : query.trim().length < 2 ? 'Gõ ít nhất 2 ký tự.' : 'Không tìm thấy gì.'}</p>
          )}
          {hits.map((hit, index) => {
            const showGroup = hit.group !== lastGroup
            lastGroup = hit.group
            return (
              <div key={hit.id}>
                {showGroup && <div className="cmdk-group">{hit.group}</div>}
                <button
                  type="button"
                  className={`cmdk-item ${index === cursor ? 'is-active' : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(hit)}
                >
                  <span className="cmdk-item-title">{hit.title}</span>
                  {hit.subtitle && <span className="cmdk-item-sub">{hit.subtitle}</span>}
                </button>
              </div>
            )
          })}
          {searching && hits.length > 0 && <p className="cmdk-empty">Đang tìm thêm…</p>}
        </div>

        <div className="cmdk-foot">
          <span><CornerDownLeft size={12} /> chọn</span>
          <span>↑↓ di chuyển</span>
          <span>Esc đóng</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
