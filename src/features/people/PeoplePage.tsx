import { useMemo, useState } from 'react'
import { Cake, ChevronRight, Plus, Search, UserRound } from 'lucide-react'
import { localDate } from '../../lib/date'
import { countdownLabel, daysUntil, isLunar, nextOccurrence } from '../../lib/occasions'
import { saveSourceLabel } from '../../lib/persistence'
import type { OccasionCalendar, Person, PersonOccasion } from '../../types'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { avatarStyle, initials } from './avatar'
import { DualCalendarDate } from './DualCalendarDate'
import { OccasionsSection } from './OccasionsSection'
import { PersonDetail } from './PersonDetail'
import { usePeopleData, type NewOccasion } from './usePeopleData'

/** Sinh nhật sắp tới của một người, để hiện trên thẻ. */
function birthdayInfo(occasions: PersonOccasion[], personId: string) {
  const found = occasions.find((o) => o.person_id === personId && o.kind === 'BIRTHDAY')
  if (!found) return null
  const next = nextOccurrence(found)
  if (!next) return null
  const days = daysUntil(next)
  return {
    text: `${next.getDate()}/${next.getMonth() + 1}${isLunar(found) ? ' âm' : ''}`,
    days,
    soon: days <= 7,
  }
}

export function PeoplePage() {
  const { showToast } = useToast()
  const { people, occasions, loading, addPerson, addOccasion, removeOccasion } = usePeopleData()
  const [selected, setSelected] = useState<Person | null>(null)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [withBirthday, setWithBirthday] = useState(false)
  const [birthday, setBirthday] = useState(localDate())
  const [birthdayCalendar, setBirthdayCalendar] = useState<OccasionCalendar>('SOLAR')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(
    () => people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
    [people, search],
  )

  const handleAddOccasion = async (input: NewOccasion) => {
    const savedTo = await addOccasion(input)
    showToast(saveSourceLabel(savedTo))
  }

  const closeForm = () => {
    setFormOpen(false)
    setName('')
    setWithBirthday(false)
    setBirthday(localDate())
    setBirthdayCalendar('SOLAR')
  }

  const handleAddPerson = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const savedTo = await addPerson({
      name,
      birthday: withBirthday ? birthday : undefined,
      birthdayCalendar,
    })
    setSaving(false)
    closeForm()
    showToast(saveSourceLabel(savedTo))
  }

  if (selected) {
    return (
      <PersonDetail
        person={selected}
        occasions={occasions}
        people={people}
        onBack={() => setSelected(null)}
        onAddOccasion={handleAddOccasion}
        onRemoveOccasion={removeOccasion}
      />
    )
  }

  return (
    <section className="people-page">
      <header className="people-head">
        <div className="people-head-title">
          <div className="icon-box" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>
            <UserRound size={18} />
          </div>
          <div>
            <h2>Người</h2>
            <p>{people.length} người thân quen</p>
          </div>
        </div>
        <button className="primary people-add" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Thêm
        </button>
      </header>

      <div className="people-search">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên…"
          aria-label="Tìm theo tên"
        />
      </div>

      <OccasionsSection
        occasions={occasions}
        people={people}
        onAdd={handleAddOccasion}
        onRemove={removeOccasion}
      />

      {loading && people.length === 0 ? (
        <p className="home-card-empty">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <div className="people-empty">
          <div className="icon-box" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>
            <UserRound size={22} />
          </div>
          <p>{people.length === 0 ? 'Chưa có ai ở đây cả.' : 'Không tìm thấy ai khớp tên này.'}</p>
          {people.length === 0 && (
            <button className="primary" onClick={() => setFormOpen(true)}>
              <Plus size={15} /> Thêm người đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="person-grid">
          {filtered.map((person) => {
            const bd = birthdayInfo(occasions, person.id)
            return (
              <button key={person.id} className="person-tile" onClick={() => setSelected(person)}>
                {person.avatar_url ? (
                  <img className="person-avatar" src={person.avatar_url} alt={person.name} />
                ) : (
                  <div className="person-avatar" style={avatarStyle(person.name)}>
                    {initials(person.name)}
                  </div>
                )}
                <div className="person-body">
                  <strong>{person.name}</strong>
                  {bd ? (
                    <span className="person-meta">
                      <Cake size={12} /> {bd.text}
                      <span className={'countdown-badge' + (bd.soon ? ' soon' : '')}>{countdownLabel(bd.days)}</span>
                    </span>
                  ) : (
                    <span className="person-meta muted">Chưa có sinh nhật</span>
                  )}
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            )
          })}
        </div>
      )}

      {formOpen && (
        <Modal title="Thêm người" onClose={closeForm}>
          <div className="person-form">
            <label className="field">
              <span>Tên</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !withBirthday && handleAddPerson()}
                placeholder="VD: Linh"
                aria-label="Tên người mới"
              />
            </label>

            <label className="check">
              <input type="checkbox" checked={withBirthday} onChange={(e) => setWithBirthday(e.target.checked)} />
              Thêm sinh nhật
            </label>

            {withBirthday && (
              <DualCalendarDate
                value={birthday}
                onChange={setBirthday}
                calendar={birthdayCalendar}
                onCalendarChange={setBirthdayCalendar}
                label="Ngày sinh"
              />
            )}

            <div className="modal-actions">
              <button onClick={closeForm}>Huỷ</button>
              <button className="primary" onClick={handleAddPerson} disabled={!name.trim() || saving}>
                <Plus size={15} /> {saving ? 'Đang lưu…' : 'Thêm'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
