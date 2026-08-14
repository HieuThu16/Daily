import { useState } from 'react'
import { ArrowLeft, CalendarPlus, Check, Pencil, Users } from 'lucide-react'
import { ageOnNext, isLunar, lunarLabel, nextOccurrence } from '../../lib/occasions'
import type { Person, PersonGroup, PersonOccasion } from '../../types'
import { Modal } from '../shared'
import { avatarStyle, initials } from './avatar'
import { GROUPS, groupLabel } from './groups'
import { SharedEventsView } from '../daily/SharedEventsView'
import { OccasionsSection } from './OccasionsSection'
import { PersonInterests } from './PersonInterests'
import { PersonJournal } from './PersonJournal'
import { PersonSpending } from './PersonSpending'
import type { NewOccasion } from './usePeopleData'

type DetailTab = 'info' | 'occasions' | 'journal' | 'events'

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'info', label: 'Thông tin' },
  { key: 'occasions', label: 'Dịp' },
  { key: 'journal', label: 'Nhật ký' },
  { key: 'events', label: 'Kỷ niệm' },
]

type Props = {
  person: Person
  occasions: PersonOccasion[]
  people: Person[]
  onBack: () => void
  onAddOccasion: (input: NewOccasion) => void
  onRemoveOccasion: (id: string) => void
  onUpdatePerson: (id: string, patch: Pick<Person, 'name' | 'group_key'>) => void
}

export function PersonDetail({
  person,
  occasions,
  people,
  onBack,
  onAddOccasion,
  onRemoveOccasion,
  onUpdatePerson,
}: Props) {
  const [tab, setTab] = useState<DetailTab>('info')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(person.name)
  const [group, setGroup] = useState<PersonGroup | null>(person.group_key ?? null)
  const [isPartner, setIsPartner] = useState(!!person.is_partner)

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

  return (
    <section className="people-page">
      <div className="detail-bar">
        <button className="icon" onClick={onBack} aria-label="Quay lại danh sách">
          <ArrowLeft size={20} />
        </button>
        <h2>Chi tiết người thân</h2>
        <button className="icon" onClick={openEdit} aria-label="Sửa thông tin">
          <Pencil size={18} />
        </button>
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

      <div className="segmented" role="tablist" aria-label="Phần thông tin">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <>
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
          onRemove={onRemoveOccasion}
        />
      )}

      {tab === 'journal' && <PersonJournal personId={person.id} personName={person.name} />}

      {tab === 'events' && <SharedEventsView personId={person.id} isPartner={!!person.is_partner} />}

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
              <button onClick={() => setEditing(false)}>Huỷ</button>
              <button className="primary" onClick={submitEdit} disabled={!name.trim()}>
                <Check size={15} /> Lưu
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
