import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Inbox, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useToast } from '../ToastContext'
import { Avatar, RenameContactModal } from './WatchTogetherButton'
import {
  emailLabel,
  unshare,
  useMyUserId,
  usePeople,
  useWatchFeed,
  type WatchPerson,
  type WatchShare,
} from '../../lib/watchTogether'

const KIND_LABEL: Record<string, string> = {
  VIDEO: 'Video', MUSIC: 'Nhạc', MANGA: 'Truyện', BOOK: 'Sách', OTHER: 'Khác',
}

type Box = 'INBOX' | 'SENT'

/**
 * Tab Xem chung: những gì người khác gửi cho mình và những gì mình gửi đi,
 * tiến độ người gửi chạy realtime.
 */
export function WatchTogetherPage() {
  const { shares, loading, reload } = useWatchFeed()
  const { people, reload: reloadPeople } = usePeople()
  const myId = useMyUserId()
  const [box, setBox] = useState<Box>('INBOX')
  const [renaming, setRenaming] = useState<WatchPerson | null>(null)
  const navigate = useNavigate()
  const { showToast } = useToast()

  /** Email → người trong danh bạ, để hiện tên mình tự đặt thay vì địa chỉ Gmail trần. */
  const byEmail = useMemo(() => {
    const map = new Map<string, WatchPerson>()
    for (const p of people) map.set(p.email.toLowerCase(), p)
    return map
  }, [people])

  const inbox = useMemo(() => shares.filter((s) => s.sender_id !== myId), [shares, myId])
  const sent = useMemo(() => shares.filter((s) => s.sender_id === myId), [shares, myId])
  const visible = box === 'INBOX' ? inbox : sent

  const open = (s: WatchShare) => {
    if (s.kind === 'VIDEO') navigate(`/youtube/watch/${s.ref_id}`)
    else if (s.url) window.open(s.url, '_blank', 'noopener')
    else showToast('Mục này không có đường mở trực tiếp.', 'info')
  }

  const remove = async (s: WatchShare) => {
    if (!confirm(`Gỡ "${s.title}" khỏi xem chung?`)) return
    try {
      await unshare(s.id)
      void reload()
      showToast('🗑️ Đã gỡ khỏi xem chung')
    } catch (err) {
      showToast(`❌ Không gỡ được: ${err instanceof Error ? err.message : err}`, 'delete')
    }
  }

  return (
    <div className="watch-page">
      <div className="watch-toolbar">
        <div className="watch-tabs" role="tablist">
          <BoxTab active={box === 'INBOX'} onClick={() => setBox('INBOX')} count={inbox.length}>
            <Inbox size={14} /> Được gửi cho mình
          </BoxTab>
          <BoxTab active={box === 'SENT'} onClick={() => setBox('SENT')} count={sent.length}>
            <Send size={14} /> Mình đã gửi
          </BoxTab>
        </div>
        <button
          type="button"
          className="watch-refresh"
          aria-label="Tải lại danh sách"
          title="Tải lại"
          onClick={() => { void reload(); reloadPeople() }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <div className="watch-empty">Đang tải…</div>
      ) : visible.length === 0 ? (
        <div className="watch-empty">
          <span className="watch-empty-icon">{box === 'INBOX' ? <Inbox size={26} /> : <Send size={26} />}</span>
          <strong>{box === 'INBOX' ? 'Chưa ai gửi gì cho bạn' : 'Bạn chưa gửi gì'}</strong>
          <span>
            {box === 'INBOX'
              ? 'Khi có người bấm “Xem chung” và chọn Gmail của bạn, mục đó hiện ở đây.'
              : 'Bấm “Xem chung” ở video, nhạc hay truyện rồi chọn Gmail người nhận.'}
          </span>
        </div>
      ) : (
        <div className="watch-list">
          {visible.map((s) => {
            // Hộp đến thì quan tâm ai gửi; hộp đi thì quan tâm gửi cho ai.
            const email = box === 'INBOX' ? s.sender_email : s.recipient_email
            const person = email ? byEmail.get(email.toLowerCase()) : undefined
            const who = person?.label ?? emailLabel(email)
            return (
              <ShareCard
                key={s.id}
                share={s}
                who={who}
                whoPrefix={box === 'INBOX' ? 'Từ' : 'Gửi'}
                person={person}
                onOpen={() => open(s)}
                onRename={person ? () => setRenaming(person) : undefined}
                onRemove={box === 'SENT' ? () => void remove(s) : undefined}
              />
            )
          })}
        </div>
      )}

      {renaming && (
        <RenameContactModal
          person={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => { setRenaming(null); reloadPeople() }}
        />
      )}
    </div>
  )
}

function BoxTab({
  active, onClick, count, children,
}: {
  active: boolean; onClick: () => void; count: number; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`watch-tab${active ? ' on' : ''}`}>
      {children}
      {count > 0 && <span className="watch-tab-count">{count}</span>}
    </button>
  )
}

function ShareCard({
  share: s, who, whoPrefix, person, onOpen, onRename, onRemove,
}: {
  share: WatchShare
  who: string
  whoPrefix: string
  person?: WatchPerson
  onOpen: () => void
  onRename?: () => void
  onRemove?: () => void
}) {
  const done = s.percent >= 90
  const started = s.percent > 0
  return (
    <article className="watch-card">
      <button type="button" className="watch-card-main" onClick={onOpen} aria-label={`Mở ${s.title}`}>
        <span className="watch-thumb">
          {s.thumbnail ? (
            <img src={s.thumbnail} alt="" loading="lazy" />
          ) : (
            <span className="watch-thumb-fallback">{KIND_LABEL[s.kind]?.charAt(0) ?? '?'}</span>
          )}
          <span className="watch-kind">{KIND_LABEL[s.kind] ?? s.kind}</span>
        </span>

        <span className="watch-card-body">
          <span className="watch-card-title" title={s.title}>{s.title}</span>

          <span className="watch-card-who">
            {person && <Avatar person={person} size={16} />}
            <span className="watch-card-who-text">
              {whoPrefix} <b>{who}</b>
              {s.subtitle ? ` · ${s.subtitle}` : ''}
            </span>
          </span>

          {/* Chưa xem thì thanh 0% trông như lỗi hiển thị — thay bằng một chip chữ. */}
          {started ? (
            <>
              <span className="watch-card-progress-text">
                {s.progress_text ?? (done ? 'Đã xem xong' : `Đang xem ${s.percent}%`)}
              </span>
              <span className="watch-bar" role="progressbar" aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100}>
                <i className={done ? 'done' : undefined} style={{ width: `${Math.min(100, s.percent)}%` }} />
              </span>
            </>
          ) : (
            <span className="watch-chip">Chưa xem</span>
          )}
        </span>
      </button>

      <div className="watch-card-actions">
        {onRename && (
          <button
            type="button"
            className="watch-icon-btn"
            aria-label={`Đặt tên cho ${person?.email ?? who}`}
            title="Đặt tên cho Gmail này"
            onClick={onRename}
          >
            <Pencil size={15} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            className="watch-icon-btn danger"
            aria-label={`Gỡ ${s.title} khỏi xem chung`}
            title="Gỡ khỏi xem chung"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        )}
        <button type="button" className="watch-icon-btn" aria-label={`Mở ${s.title}`} title="Mở" onClick={onOpen}>
          <ExternalLink size={15} />
        </button>
      </div>
    </article>
  )
}
