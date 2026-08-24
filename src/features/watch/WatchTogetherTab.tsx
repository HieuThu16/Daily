import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Trash2, RefreshCw, UserPlus, ExternalLink } from 'lucide-react'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import {
  addMember, deleteGroup, listMembers, removeMember, useMyGroups, useWatchFeed,
  type WatchGroup, type WatchShare,
} from '../../lib/watchTogether'

const KIND_LABEL: Record<string, string> = {
  VIDEO: 'Video', MUSIC: 'Nhạc', MANGA: 'Truyện', BOOK: 'Sách', OTHER: 'Khác',
}

/** Tab Xem chung: các mục nhóm đã gửi, tiến độ người gửi chạy realtime. */
export function WatchTogetherTab() {
  const { groups, loading: loadingGroups, reload: reloadGroups } = useMyGroups()
  const { shares, loading, reload } = useWatchFeed()
  const [groupFilter, setGroupFilter] = useState<string>('ALL')
  const [managing, setManaging] = useState<WatchGroup | null>(null)
  const navigate = useNavigate()

  const visible = useMemo(
    () => (groupFilter === 'ALL' ? shares : shares.filter((s) => s.group_id === groupFilter)),
    [shares, groupFilter],
  )
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? 'Nhóm'

  const open = (s: WatchShare) => {
    if (s.kind === 'VIDEO') navigate(`/youtube/watch/${s.ref_id}`)
    else if (s.url) window.open(s.url, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="ALL">Tất cả nhóm</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => void reload()}><RefreshCw size={14} /> Làm mới</button>
        {groups.map((g) => (
          <button key={g.id} type="button" onClick={() => setManaging(g)} title="Quản lý thành viên">
            <Users size={14} /> {g.name}
          </button>
        ))}
      </div>

      {loading || loadingGroups ? (
        <div style={{ fontSize: '0.9rem' }}>Đang tải…</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: '0.9rem', opacity: 0.75 }}>
          Chưa có gì được gửi lên xem chung. Bấm nút “Xem chung” ở video, nhạc hay truyện để gửi.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((s) => (
            <div
              key={s.id}
              onClick={() => open(s)}
              style={{ display: 'flex', gap: 12, padding: 10, borderRadius: 14, background: 'var(--surface-2, rgba(0,0,0,0.04))', cursor: 'pointer' }}
            >
              {s.thumbnail && (
                <img src={s.thumbnail} alt="" style={{ width: 96, height: 56, objectFit: 'cover', borderRadius: 8 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '0.76rem', opacity: 0.75 }}>
                  {KIND_LABEL[s.kind] ?? s.kind} · {groupName(s.group_id)} · {s.sender_email ?? 'ai đó'}
                  {s.subtitle ? ` · ${s.subtitle}` : ''}
                </div>
                <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                  {s.progress_text ?? (s.percent > 0 ? `Đang xem ${s.percent}%` : 'Chưa xem')}
                </div>
                <div style={{ height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.1)', marginTop: 4 }}>
                  <div style={{ width: `${s.percent}%`, height: '100%', borderRadius: 4, background: 'var(--primary, #8b5cf6)' }} />
                </div>
              </div>
              <ExternalLink size={16} style={{ alignSelf: 'center', opacity: 0.5 }} />
            </div>
          ))}
        </div>
      )}

      {managing && (
        <ManageGroupModal
          group={managing}
          onClose={() => setManaging(null)}
          onDeleted={() => { setManaging(null); reloadGroups(); void reload() }}
        />
      )}
    </div>
  )
}

function ManageGroupModal({ group, onClose, onDeleted }: { group: WatchGroup; onClose: () => void; onDeleted: () => void }) {
  const { showToast } = useToast()
  const [members, setMembers] = useState<Array<{ id: string; email: string }>>([])
  const [email, setEmail] = useState('')

  React.useEffect(() => {
    void listMembers(group.id).then(setMembers).catch(() => setMembers([]))
  }, [group.id])

  const add = async () => {
    if (!email.includes('@')) return showToast('Email không hợp lệ')
    try {
      await addMember(group.id, email)
      setEmail('')
      setMembers(await listMembers(group.id))
    } catch (err: any) {
      showToast(`Không thêm được: ${err?.message ?? err}`)
    }
  }

  return (
    <Modal title={`Nhóm ${group.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {members.length === 0 && <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Chưa có thành viên nào.</div>}
        {members.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{m.email}</span>
            <button
              type="button"
              onClick={() => void removeMember(m.id).then(async () => setMembers(await listMembers(group.id)))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@thanh.vien" style={{ flex: 1 }} />
        <button type="button" onClick={() => void add()}><UserPlus size={14} /> Thêm</button>
      </div>
      <button
        type="button"
        onClick={() => void deleteGroup(group.id).then(onDeleted)}
        style={{ width: '100%', color: '#dc2626' }}
      >
        <Trash2 size={14} /> Xoá nhóm
      </button>
    </Modal>
  )
}
