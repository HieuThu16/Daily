import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BookMarked, ChevronRight, Sparkles, X } from 'lucide-react'
import { fetchDuaLeoMangaList, getFollows } from './mangaService'
import { fetchNgontinhList, getNgontinhFollows } from './ngontinhService'
import {
  findNewChapters,
  getSeenChapters,
  markSeen,
  saveSeenChapters,
  seenKey,
  type MangaUpdate,
} from './followUpdates'

/** Sự kiện phát ra khi người dùng bấm theo dõi / bỏ theo dõi một truyện. */
export const FOLLOWS_UPDATED_EVENT = 'daily-manga-follows-updated'

export function notifyFollowsChanged() {
  window.dispatchEvent(new CustomEvent(FOLLOWS_UPDATED_EVENT))
}

/** Chuông báo truyện đang theo dõi có chương mới, cho cả BL và Ngôn Tình. */
export function MangaNotificationBell() {
  const [updates, setUpdates] = useState<MangaUpdate[]>([])
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  const check = useCallback(async () => {
    const blFollows = getFollows()
    const ntFollows = getNgontinhFollows()
    if (blFollows.length === 0 && ntFollows.length === 0) {
      setUpdates([])
      return
    }

    const seen = getSeenChapters()
    const [bl, nt] = await Promise.all([
      blFollows.length > 0 ? fetchDuaLeoMangaList() : Promise.resolve([]),
      ntFollows.length > 0 ? fetchNgontinhList() : Promise.resolve([]),
    ])

    setUpdates([
      ...findNewChapters(bl, blFollows, 'BL', seen),
      ...findNewChapters(nt, ntFollows, 'NGONTINH', seen),
    ])

    // Truyện vừa theo dõi chưa có mốc: ghi mốc ngay, lần crawl sau mới tính là chương mới.
    const freshBL = bl.filter((m) => seen[seenKey('BL', m.slug)] === undefined)
    const freshNT = nt.filter((m) => seen[seenKey('NGONTINH', m.slug)] === undefined)
    if (freshBL.length > 0 || freshNT.length > 0) {
      let next = markSeen(freshBL, blFollows, 'BL', seen)
      next = markSeen(freshNT, ntFollows, 'NGONTINH', next)
      saveSeenChapters(next)
    }
  }, [])

  useEffect(() => {
    void check()
    const onChange = () => void check()
    window.addEventListener(FOLLOWS_UPDATED_EVENT, onChange)
    window.addEventListener('focus', onChange)
    return () => {
      window.removeEventListener(FOLLOWS_UPDATED_EVENT, onChange)
      window.removeEventListener('focus', onChange)
    }
  }, [check])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** Mở truyện và đánh dấu đã xem riêng truyện đó. */
  const openManga = (update: MangaUpdate) => {
    saveSeenChapters({ ...getSeenChapters(), [update.key]: update.chapterCount })
    setUpdates((prev) => prev.filter((u) => u.key !== update.key))
    setOpen(false)
    nav(update.kind === 'BL' ? `/bl/${update.slug}` : `/ngontinh/${update.slug}`)
  }

  const markAllSeen = () => {
    const next = { ...getSeenChapters() }
    for (const u of updates) next[u.key] = u.chapterCount
    saveSeenChapters(next)
    setUpdates([])
  }

  const count = updates.length

  return (
    <div className="task-bell-container">
      <button
        type="button"
        className={`task-bell-btn ${count > 0 ? 'has-tasks' : ''} ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Thông báo truyện: ${count} truyện có chương mới`}
        title={count > 0 ? `${count} truyện có chương mới` : 'Truyện theo dõi chưa có chương mới'}
      >
        <BookMarked size={18} className="task-bell-icon" />
        {count > 0 && <span className="task-bell-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open &&
        createPortal(
          <div className="task-bell-portal-backdrop" role="presentation" onClick={() => setOpen(false)}>
            <div
              className="task-bell-dropdown-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Truyện có chương mới"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="task-bell-sheet-handle" aria-hidden="true" />

              <div className="task-bell-header">
                <div className="task-bell-title-wrap">
                  <div className="task-bell-title-icon">
                    <BookMarked size={16} />
                  </div>
                  <strong className="task-bell-title">Truyện có chương mới</strong>
                  <span className="task-bell-count-pill">{count} truyện</span>
                </div>
                <button
                  type="button"
                  className="task-bell-close-btn"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng bảng thông báo truyện"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="task-bell-body">
                {count === 0 ? (
                  <div className="task-bell-empty">
                    <div className="task-bell-empty-icon">
                      <Sparkles size={28} />
                    </div>
                    <p className="task-bell-empty-title">Chưa có chương mới</p>
                    <p className="task-bell-empty-desc">
                      Bấm “Theo dõi” ở trang truyện để được báo khi có chương mới.
                    </p>
                  </div>
                ) : (
                  <ul className="task-bell-list">
                    {updates.map((u) => (
                      <li key={u.key} className="task-bell-item" onClick={() => openManga(u)}>
                        {u.cover && <img className="mn-cover" src={u.cover} alt="" loading="lazy" />}
                        <div className="task-bell-item-content">
                          <span className="task-bell-item-title">{u.title}</span>
                          <div className="task-bell-item-tags">
                            <span className="task-tag-badge tag-today">+{u.newChapters} chương mới</span>
                            <span className="task-tag-badge tag-category">
                              {u.kind === 'BL' ? 'Truyện BL' : 'Ngôn Tình'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="task-bell-item-arrow" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {count > 0 && (
                <div className="task-bell-footer">
                  <button type="button" className="task-bell-view-all-btn" onClick={markAllSeen}>
                    <span>Đánh dấu đã xem hết</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
