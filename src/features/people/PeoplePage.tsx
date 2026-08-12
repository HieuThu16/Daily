import { useMemo, useState } from 'react'
import { ChevronRight, Plus, UserRound } from 'lucide-react'
import { isLunar, nextOccurrence } from '../../lib/occasions'
import { localDate } from '../../lib/date'
import { saveSourceLabel } from '../../lib/persistence'
import type { Person } from '../../types'
import { Empty } from '../shared'
import { useToast } from '../ToastContext'
import { avatarStyle, initials } from './avatar'
import { OccasionsSection } from './OccasionsSection'
import { PersonDetail } from './PersonDetail'
import { DualCalendarDate } from './DualCalendarDate'
import { usePeopleData, type NewOccasion } from './usePeopleData'
import type { OccasionCalendar } from '../../types'

export function PeoplePage() {
  const { showToast } = useToast()
  const { people, occasions, loading, addPerson, addOccasion, removeOccasion } = usePeopleData()
  const [selected, setSelected] = useState<Person | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState(localDate())
  const [birthdayCalendar, setBirthdayCalendar] = useState<OccasionCalendar>('SOLAR')
  const [withBirthday, setWithBirthday] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
    [people, search],
  )

  const handleAddOccasion = async (input: NewOccasion) => {
    const savedTo = await addOccasion(input)
    showToast(saveSourceLabel(savedTo))
  }

  const handleAddPerson = async () => {
    if (!name.trim()) return
    const savedTo = await addPerson({
      name,
      phone,
      birthday: withBirthday ? birthday : undefined,
      birthdayCalendar,
    })
    setName('')
    setPhone('')
    setBirthday(localDate())
    setBirthdayCalendar('SOLAR')
    setWithBirthday(false)
    showToast(saveSourceLabel(savedTo))
  }

  const birthdayOf = (personId: string) => {
    const found = occasions.find((o) => o.person_id === personId && o.kind === 'BIRTHDAY')
    if (!found) return null
    const next = nextOccurrence(found)
    if (!next) return null
    return `${next.getDate()}/${next.getMonth() + 1}${isLunar(found) ? ' (âm)' : ''}`
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
      <div className="card home-section-card">
        <div className="home-section-head">
          <h3>
            <UserRound size={17} color="var(--cyan)" /> Người
          </h3>
          <span className="home-card-count">{people.length}</span>
        </div>

        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên…"
          aria-label="Tìm theo tên"
          style={{ width: '100%', marginBottom: 8 }}
        />

        <div className="person-form">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên người…"
            aria-label="Tên người mới"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Số điện thoại (không bắt buộc)"
            aria-label="Số điện thoại"
          />

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

          <button className="primary" onClick={handleAddPerson}>
            <Plus size={14} /> Thêm
          </button>
        </div>
      </div>

      <OccasionsSection
        occasions={occasions}
        people={people}
        onAdd={handleAddOccasion}
        onRemove={removeOccasion}
      />

      <div style={{ marginTop: 12 }}>
        {loading && people.length === 0 ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : filtered.length === 0 ? (
          <Empty icon={UserRound}>{people.length === 0 ? 'Chưa có người nào.' : 'Không tìm thấy ai.'}</Empty>
        ) : (
          <div className="person-grid">
            {filtered.map((person) => {
              const birthday = birthdayOf(person.id)
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
                    {birthday && <div className="person-meta">🎂 {birthday}</div>}
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
