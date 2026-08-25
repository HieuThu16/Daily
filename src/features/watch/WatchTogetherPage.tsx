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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: 'var(--bg-main)' }}>
          <BoxTab active={box === 'INBOX'} onClick={() => setBox('INBOX')} count={inbox.length}>
            <Inbox size={14} /> Được gửi cho mình
          </BoxTab>
          <BoxTab active={box === 'SENT'} onClick={() => setBox('SENT')} count={sent.length}>
            <Send size={14} /> Mình đã gửi
          </BoxTab>
        </div>
        <button type="button" onClick={() => { void reload(); reloadPeople() }} title="Tải lại">
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '0.9rem' }}>Đang tải…</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: '0.9rem', opacity: 0.75, padding: '20px 0', textAlign: 'center' }}>
          {box === 'INBOX'
            ? 'Chưa ai gửi gì cho bạn. Khi có người bấm “Xem chung” và chọn Gmail của bạn, mục đó hiện ở đây.'
            : 'Bạn chưa gửi gì. Bấm “Xem chung” ở video, nhạc hay truyện rồi chọn Gmail người nhận.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10,
        border: 0, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
        background: active ? 'var(--card-bg)' : 'transparent',
        color: active ? 'var(--text-main)' : 'var(--text-muted)',
        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {children}
      {count > 0 && <span style={{ opacity: 0.6 }}>({count})</span>}
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
  return (
    <div
      style={{
        display: 'flex', gap: 12, padding: 10, borderRadius: 14,
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Mở ${s.title}`}
        style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }}
      >
        {s.thumbnail && (
          <img
            src={s.thumbnail}
            alt=""
            loading="lazy"
            style={{ width: 96, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', opacity: 0.75, marginTop: 2 }}>
            {person && <Avatar person={person} size={16} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {whoPrefix} {who} · {KIND_LABEL[s.kind] ?? s.kind}
              {s.subtitle ? ` · ${s.subtitle}` : ''}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', marginTop: 5 }}>
            {s.progress_text ?? (s.percent > 0 ? `Đang xem ${s.percent}%` : 'Chưa xem')}
          </div>
          <div style={{ height: 4, borderRadius: 4, background: 'var(--card-border)', marginTop: 4 }}>
            <div style={{ width: `${s.percent}%`, height: '100%', borderRadius: 4, background: 'var(--accent, #8b5cf6)' }} />
          </div>
        </div>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignSelf: 'center', flexShrink: 0 }}>
        {onRename && (
          <button
            type="button"
            aria-label={`Đặt tên cho ${person?.email ?? who}`}
            title="Đặt tên cho Gmail này"
            onClick={onRename}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <Pencil size={14} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`Gỡ ${s.title} khỏi xem chung`}
            title="Gỡ khỏi xem chung"
            onClick={onRemove}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--rose, #f43f5e)', padding: 4 }}
          >
            <Trash2 size={14} />
          </button>
        )}
        <ExternalLink size={14} style={{ opacity: 0.4, margin: '0 4px' }} aria-hidden="true" />
      </div>
    </div>
  )
}
