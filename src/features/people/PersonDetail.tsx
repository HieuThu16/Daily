import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, Check, ChevronRight, Heart, Mail, Pencil, Sparkles, Trash2, Users } from 'lucide-react'
import { ageOnNext, isLunar, lunarLabel, nextOccurrence } from '../../lib/occasions'
import type { Person, PersonGroup, PersonOccasion } from '../../types'
import { Modal } from '../shared'
import { avatarStyle, initials } from './avatar'
import { GROUPS, groupLabel } from './groups'
import { useHideHeader } from '../HeaderAction'
import { OccasionsSection } from './OccasionsSection'
import { PersonInterests } from './PersonInterests'
import { PersonJournal } from './PersonJournal'
import { PersonSpending } from './PersonSpending'
import { CoupleLocationTab } from './CoupleLocationTab'
import type { NewOccasion } from './usePeopleData'

type DetailTab = 'location' | 'events' | 'info' | 'occasions' | 'journal'

type Props = {
  person: Person
  occasions: PersonOccasion[]
  people: Person[]
  onBack: () => void
  onAddOccasion: (input: NewOccasion) => void
  onUpdateOccasion?: (id: string, patch: Partial<NewOccasion>) => void
  onRemoveOccasion: (id: string) => void
  onUpdatePerson: (id: string, patch: Pick<Person, 'name' | 'group_key' | 'is_partner'>) => void
  onDeletePerson?: (id: string) => void
  onSendInvite?: (person: Person, email: string) => void
}

export function PersonDetail({
  person,
  occasions,
  people,
  onBack,
  onAddOccasion,
  onUpdateOccasion,
  onRemoveOccasion,
  onUpdatePerson,
  onDeletePerson,
  onSendInvite,
}: Props) {
  // Ẩn Header chung của App khi xem chi tiết người thân, nhấn quay lại sẽ hiện lại
  useHideHeader(true)
  const navigate = useNavigate()

  const isLove = Boolean(
    person.is_partner ||
    person.room_code ||
    person.name.trim().toLowerCase() === 'kim ý' ||
    person.name.trim().toLowerCase() === 'kim y' ||
    person.name.trim().toLowerCase() === 'vợ' ||
    person.name.trim().toLowerCase() === 'vo'
  )

  const availableTabs = [
    ...(isLove ? [
      { key: 'location' as const, label: 'Vị trí' },
    ] : []),
    { key: 'events' as const, label: isLove ? 'Kỷ niệm chung' : 'Kỷ niệm' },
    { key: 'info' as const, label: 'Thông tin' },
    { key: 'occasions' as const, label: 'Dịp' },
    { key: 'journal' as const, label: 'Nhật ký' },
  ]

  const [tab, setTab] = useState<DetailTab>(isLove ? 'location' : 'info')

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(person.name)
  const [group, setGroup] = useState<PersonGroup | null>(person.group_key ?? null)
  const [isPartner, setIsPartner] = useState(!!person.is_partner)

  const [inviteModal, setInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')


  const birthday = occasions.find((o) => o.person_id === person.id && o.kind === 'BIRTHDAY')
  const nextBirthday = birthday ? nextOccurrence(birthday) : null
  const age = birthday ? ageOnNext(birthday) : null
  const tag = groupLabel(person.group_key)
  const mine = occasions.filter((o) => o.person_id === person.id)

  const openEdit = () => {
    setName(person.name)
    setGroup(person.group_key ?? null)
    setIsPartner(!!person.is_partner)
    setEditing(true)
  }

  const submitEdit = () => {
    if (!name.trim()) return
    onUpdatePerson(person.id, { name: name.trim(), group_key: group, is_partner: isPartner })
    setEditing(false)
  }

  const handleDelete = () => {
    if (!onDeletePerson) return
    if (confirm(`Bạn có chắc muốn xoá "${person.name}" không?`)) {
      onDeletePerson(person.id)
      onBack()
    }
  }

  const handleSendInviteSubmit = () => {
    if (!inviteEmail.trim() || !onSendInvite) return
    onSendInvite(person, inviteEmail.trim())
    setInviteModal(false)
    setInviteEmail('')
  }

  return (
    <section className="people-page">
      <div className="detail-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', marginBottom: 12 }}>
        <button
          className="icon"
          onClick={onBack}
          aria-label="Quay lại danh sách"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}
        >
          <ArrowLeft size={18} />
        </button>

        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, flex: 1, textAlign: 'center' }}>Chi tiết người thân</h2>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="icon"
            onClick={openEdit}
            aria-label="Sửa thông tin"
            title="Sửa thông tin"
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <Pencil size={16} />
          </button>
          {onDeletePerson && (
            <button
              className="icon danger"
              onClick={handleDelete}
              aria-label="Xóa người này"
              title="Xoá người này"
              style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="person-hero">
        {person.avatar_url ? (
          <img className="person-avatar large" src={person.avatar_url} alt={person.name} />
        ) : (
          <div className="person-avatar large" style={avatarStyle(person.name)}>
            {initials(person.name)}
          </div>
        )}

        <div className="person-hero-body">
          <h3>{person.name}</h3>
          {tag && (
            <span className="group-chip">
              <Users size={12} /> {tag}
            </span>
          )}
          <p>
            {nextBirthday
              ? `🎂 Sinh nhật ${nextBirthday.getDate()}/${nextBirthday.getMonth() + 1}` +
                (birthday && isLunar(birthday) ? ` (${lunarLabel(birthday)})` : '') +
                (age ? ` · ${age} tuổi` : '')
              : 'Chưa có sinh nhật'}
          </p>
        </div>

        <button className="hero-action" onClick={() => setTab('occasions')} aria-label="Xem dịp của người này">
          <CalendarPlus size={20} />
        </button>
      </div>

      {/* Nút vào trang kỷ niệm riêng (1 Router mới, 1 Page mới có nút back về) */}
      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => navigate(`/memories/${person.id}`)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 16,
            background: isLove
              ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 60%, #fecdd3 100%)'
              : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: isLove ? '1.5px solid #fda4af' : '1.5px solid #fcd34d',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: isLove ? '#f43f5e' : '#f59e0b',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {isLove ? <Heart size={18} fill="#fff" /> : <Sparkles size={18} />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isLove ? '#9f1239' : '#78350f' }}>
                {isLove ? '❤️ Mở Trang Kỷ Niệm Chung →' : `🌸 Mở Trang Kỷ Niệm · ${person.name} →`}
              </div>
              <div style={{ fontSize: '0.73rem', color: isLove ? '#be123c' : '#92400e', opacity: 0.85 }}>
                1 Trang riêng biệt toàn màn hình · Có nút quay lại
              </div>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: isLove ? '#e11d48' : '#b45309', flexShrink: 0 }} />
        </button>
      </div>

      <div className="segmented" role="tablist" aria-label="Phần thông tin">
        {availableTabs.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => {
              if (key === 'events') {
                navigate(`/memories/${person.id}`)
              } else {
                setTab(key)
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'location' && (
        <CoupleLocationTab partnerPerson={person} />
      )}

      {tab === 'info' && (
        <>
          {onSendInvite && (
            <div style={{ background: 'var(--primary-light)', padding: 12, borderRadius: 12, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>
                {person.is_partner ? '❤️ Đã đánh dấu là người yêu chung' : 'Chưa gửi lời mời kết nối kỷ niệm'}
              </span>
              <button
                className="primary"
                style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                onClick={() => setInviteModal(true)}
              >
                <Mail size={14} /> {person.is_partner ? 'Gửi lại lời mời' : 'Mời kỷ niệm chung'}
              </button>
            </div>
          )}
          <PersonInterests personId={person.id} />
          <PersonSpending personId={person.id} />
        </>
      )}

      {tab === 'occasions' && (
        <OccasionsSection
          occasions={mine}
          people={people}
          personId={person.id}
          title="Dịp quan trọng"
          withinDays={400}
          onAdd={onAddOccasion}
          onUpdate={onUpdateOccasion}
          onRemove={onRemoveOccasion}
        />
      )}

      {tab === 'journal' && <PersonJournal personId={person.id} personName={person.name} />}

      {tab === 'events' && (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <button
            type="button"
            className="primary"
            onClick={() => navigate(`/memories/${person.id}`)}
            style={{ padding: '10px 22px', borderRadius: 20, fontSize: '0.88rem', fontWeight: 800 }}
          >
            {isLove ? '❤️ Chuyển sang Trang Kỷ Niệm Chung →' : `🌸 Chuyển sang Trang Kỷ Niệm ${person.name} →`}
          </button>
        </div>
      )}


      {editing && (
        <Modal title="Sửa thông tin" onClose={() => setEditing(false)}>
          <div className="person-form">
            <label className="field">
              <span>Tên</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên người" />
            </label>

            <div className="field">
              <span>Nhóm</span>
              <div className="group-picker" role="group" aria-label="Nhóm">
                {GROUPS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={group === key ? 'active' : ''}
                    aria-pressed={group === key}
                    onClick={() => setGroup(group === key ? null : key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="check">
              <input type="checkbox" checked={isPartner} onChange={(e) => setIsPartner(e.target.checked)} />
              Là người yêu chung (hiện tab Sự kiện chung)
            </label>

            <div className="modal-actions">
              {onDeletePerson && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setEditing(false)
                    handleDelete()
                  }}
                  style={{ marginRight: 'auto' }}
                >
                  <Trash2 size={15} /> Xóa
                </button>
              )}
              <button onClick={() => setEditing(false)}>Huỷ</button>
              <button className="primary" onClick={submitEdit} disabled={!name.trim()}>
                <Check size={15} /> Lưu
              </button>
            </div>
          </div>
        </Modal>
      )}

      {inviteModal && (
        <Modal title={`Mời kết nối với ${person.name}`} onClose={() => setInviteModal(false)}>
          <div className="person-form">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Nhập Gmail của {person.name}. Hệ thống sẽ gửi lời mời đến đối phương. Khi đối phương chấp nhận, hai người sẽ xem được Kỷ niệm chung!
            </p>
            <label className="field">
              <span>Email đối phương</span>
              <input
                autoFocus
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInviteSubmit()}
                placeholder="VD: nguyenkimy1302.gr@gmail.com"
                aria-label="Email đối phương"
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setInviteModal(false)}>Huỷ</button>
              <button className="primary" onClick={handleSendInviteSubmit} disabled={!inviteEmail.trim()}>
                <Mail size={15} /> Gửi lời mời
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
