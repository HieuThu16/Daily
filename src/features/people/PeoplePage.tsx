import { useCallback, useMemo, useState } from 'react'
import { CalendarHeart, ChevronRight, Plus, Search, SlidersHorizontal, UserRound, Users } from 'lucide-react'
import { localDate } from '../../lib/date'
import { countdownLabel, daysUntil, isLunar, nextOccurrence, upcomingOccasions } from '../../lib/occasions'
import { saveSourceLabel } from '../../lib/persistence'
import type { OccasionCalendar, Person, PersonGroup, PersonOccasion } from '../../types'
import { useHeaderAction } from '../HeaderAction'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { avatarStyle, initials } from './avatar'
import { DualCalendarDate } from './DualCalendarDate'
import { GROUPS, groupLabel } from './groups'
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
  return { text: `${next.getDate()}/${next.getMonth() + 1}${isLunar(found) ? ' âm' : ''}`, days, soon: days <= 7 }
}

export function PeoplePage() {
  const { showToast } = useToast()
  const { people, occasions, loading, addPerson, updatePerson, addOccasion, removeOccasion } = usePeopleData()
  const [selected, setSelected] = useState<Person | null>(null)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [groupFilter, setGroupFilter] = useState<PersonGroup | 'ALL'>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<PersonGroup>('FAMILY')
  const [withBirthday, setWithBirthday] = useState(false)
  const [birthday, setBirthday] = useState(localDate())
  const [birthdayCalendar, setBirthdayCalendar] = useState<OccasionCalendar>('SOLAR')
  const [saving, setSaving] = useState(false)

  const openForm = useCallback(() => setFormOpen(true), [])
  useHeaderAction('Thêm người', openForm)

  const filtered = useMemo(
    () =>
      people.filter(
        (p) =>
          p.name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (groupFilter === 'ALL' || p.group_key === groupFilter),
      ),
    [people, search, groupFilter],
  )

  const upcomingCount = useMemo(
    () => upcomingOccasions(occasions, people, new Date(), { withinDays: 30, limit: 99 }).length,
    [occasions, people],
  )

  const handleAddOccasion = async (input: NewOccasion) => {
    const savedTo = await addOccasion(input)
    showToast(saveSourceLabel(savedTo))
  }

  const handleUpdatePerson = async (id: string, patch: Pick<Person, 'name' | 'group_key'>) => {
    const savedTo = await updatePerson(id, patch)
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
    showToast(saveSourceLabel(savedTo))
  }

  const closeForm = () => {
    setFormOpen(false)
    setName('')
    setGroup('FAMILY')
    setWithBirthday(false)
    setBirthday(localDate())
    setBirthdayCalendar('SOLAR')
  }

  const handleAddPerson = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const savedTo = await addPerson({
      name,
      group_key: group,
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
        onUpdatePerson={handleUpdatePerson}
      />
    )
  }

  return (
    <section className="people-page">
      <div className="people-search">
        <Search size={17} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên…"
          aria-label="Tìm theo tên"
        />
        <button
          type="button"
          className={'people-filter-toggle' + (groupFilter !== 'ALL' ? ' active' : '')}
          aria-label="Lọc theo nhóm"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((v) => !v)}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>

      {filterOpen && (
        <div className="people-filters" role="group" aria-label="Lọc theo nhóm">
          {(['ALL', ...GROUPS.map((g) => g.key)] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={groupFilter === key ? 'active' : ''}
              aria-pressed={groupFilter === key}
              onClick={() => setGroupFilter(key)}
            >
              {key === 'ALL' ? 'Tất cả' : groupLabel(key)}
            </button>
          ))}
        </div>
      )}

      <div className="people-stats">
        <div className="people-stat cyan">
          <Users size={20} />
          <strong>{people.length}</strong>
          <span>người thân quen</span>
        </div>
        <div className="people-stat rose">
          <CalendarHeart size={20} />
          <strong>{upcomingCount}</strong>
          <span>dịp sắp tới</span>
        </div>
      </div>

      <OccasionsSection
        occasions={occasions}
        people={people}
        onAdd={handleAddOccasion}
        onRemove={removeOccasion}
      />

      <div className="people-section-label">
        <h3>Người thân quen</h3>
        <span className="count-pill">{filtered.length}</span>
      </div>

      {loading && people.length === 0 ? (
        <p className="home-card-empty">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <div className="people-empty">
          <div className="icon-box" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>
            <UserRound size={22} />
          </div>
          <p>{people.length === 0 ? 'Chưa có ai ở đây cả.' : 'Không tìm thấy ai khớp bộ lọc.'}</p>
          {people.length === 0 && (
            <button className="primary" onClick={openForm}>
              <Plus size={15} /> Thêm người đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="person-grid">
          {filtered.map((person) => {
            const bd = birthdayInfo(occasions, person.id)
            const tag = groupLabel(person.group_key)
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
                  {tag && <span className="group-chip">{tag}</span>}
                  {bd ? (
                    <span className="person-meta">
                      🎂 {bd.text}
                      <span className={'countdown-badge' + (bd.soon ? ' soon' : '')}>{countdownLabel(bd.days)}</span>
                    </span>
                  ) : (
                    <span className="person-meta muted">Chưa có sinh nhật</span>
                  )}
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
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

            <div className="field">
              <span>Nhóm</span>
              <div className="group-picker" role="group" aria-label="Nhóm">
                {GROUPS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={group === key ? 'active' : ''}
                    aria-pressed={group === key}
                    onClick={() => setGroup(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

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
