import { useState } from 'react'
import { Cake, Heart, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { localDate, shortDate } from '../../lib/date'
import { countdownLabel, isLunar, lunarLabel, upcomingOccasions } from '../../lib/occasions'
import type { OccasionCalendar, OccasionKind, Person, PersonOccasion } from '../../types'
import { Modal } from '../shared'
import { DualCalendarDate } from './DualCalendarDate'
import type { NewOccasion } from './usePeopleData'

type Props = {
  occasions: PersonOccasion[]
  people: Person[]
  /** Chỉ hiện dịp của người này và mặc định gắn dịp mới cho họ. */
  personId?: string
  title?: string
  withinDays?: number
  onAdd: (input: NewOccasion) => void
  onUpdate?: (id: string, input: Partial<NewOccasion>) => void
  onRemove: (id: string) => void
}

export function OccasionsSection({
  occasions,
  people,
  personId,
  title = 'Sinh nhật & Kỉ niệm',
  withinDays = 90,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false)
  const [editingOccasion, setEditingOccasion] = useState<PersonOccasion | null>(null)
  const [kind, setKind] = useState<OccasionKind>('BIRTHDAY')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(localDate())
  const [target, setTarget] = useState(personId ?? '')
  const [yearly, setYearly] = useState(true)
  const [calendar, setCalendar] = useState<OccasionCalendar>('SOLAR')

  const scoped = personId ? occasions.filter((o) => o.person_id === personId) : occasions
  const items = upcomingOccasions(scoped, people, new Date(), { withinDays, limit: 50 })

  const openAdd = () => {
    setEditingOccasion(null)
    setKind('BIRTHDAY')
    setLabel('')
    setDate(localDate())
    setTarget(personId ?? '')
    setYearly(true)
    setCalendar('SOLAR')
    setOpen(true)
  }

  const openEdit = (occ: PersonOccasion) => {
    setEditingOccasion(occ)
    setKind(occ.kind)
    setLabel(occ.title || '')
    setDate(occ.occasion_date)
    setTarget(occ.person_id ?? '')
    setYearly(Boolean(occ.is_yearly))
    setCalendar(occ.calendar || 'SOLAR')
    setOpen(true)
  }

  const submit = () => {
    if (!date) return
    const payload: NewOccasion = {
      person_id: personId ?? (target || null),
      kind,
      title: label,
      occasion_date: date,
      is_yearly: yearly,
      calendar,
      is_shared: true,
    }

    if (editingOccasion && onUpdate) {
      onUpdate(editingOccasion.id, payload)
    } else {
      onAdd(payload)
    }

    setEditingOccasion(null)
    setLabel('')
    setDate(localDate())
    setKind('BIRTHDAY')
    setYearly(true)
    setCalendar('SOLAR')
    if (!personId) setTarget('')
    setOpen(false)
  }

  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <Cake size={17} color="var(--rose)" /> {title}
        </h3>
        <button type="button" className="link-add" onClick={openAdd}>
          <Plus size={16} /> Thêm dịp
        </button>
      </div>

      {items.length === 0 ? (
        <div className="occasions-empty">
          <div className="icon-box" style={{ background: 'var(--rose-bg)', color: 'var(--rose)' }}>
            <Cake size={22} />
          </div>
          <p>Chưa có dịp nào</p>
        </div>
      ) : (
        items.map(({ occasion, days, date: next, label: name }) => {
          const Icon = occasion.kind === 'BIRTHDAY' ? Cake : Heart
          const tone = occasion.kind === 'BIRTHDAY' ? 'rose' : 'purple'
          return (
            <div key={occasion.id} className="occasion-row">
              <div
                className="icon-box icon-box-sm"
                style={{ width: 26, height: 26, background: `var(--${tone}-bg)`, color: `var(--${tone})` }}
              >
                <Icon size={14} />
              </div>
              <span className="occasion-name">{name}</span>
              {isLunar(occasion) && <span className="lunar-chip">{lunarLabel(occasion)}</span>}
              <span className={'countdown-badge' + (days <= 7 ? ' soon' : '')}>{countdownLabel(days)}</span>
              <time style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{shortDate(next)}</time>

              <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
                <button
                  type="button"
                  className="icon"
                  aria-label={`Sửa ${name}`}
                  onClick={() => openEdit(occasion)}
                  style={{ padding: 4, color: 'var(--text-muted)', cursor: 'pointer' }}
                  title="Sửa dịp kỷ niệm"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  className="icon danger"
                  aria-label={`Xoá ${name}`}
                  onClick={() => onRemove(occasion.id)}
                  style={{ padding: 4, cursor: 'pointer' }}
                  title="Xoá dịp kỷ niệm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })
      )}

      {open && (
        <Modal title={editingOccasion ? 'Sửa dịp kỷ niệm' : 'Thêm dịp'} onClose={() => { setOpen(false); setEditingOccasion(null) }}>
          <div className="person-form">
            <label className="field">
              <span>Loại dịp</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as OccasionKind)} aria-label="Loại dịp">
                <option value="BIRTHDAY">🎂 Sinh nhật</option>
                <option value="ANNIVERSARY">💜 Kỉ niệm</option>
              </select>
            </label>

            <DualCalendarDate
              value={date}
              onChange={setDate}
              calendar={calendar}
              onCalendarChange={setCalendar}
              label="Ngày diễn ra"
            />

            {!personId && (
              <label className="field">
                <span>Gắn với người</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Gắn với người">
                  <option value="">Không gắn ai</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>Tên dịp</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Để trống sẽ tự đặt tên"
                aria-label="Tên dịp"
              />
            </label>

            <label className="check">
              <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
              Lặp lại hằng năm
            </label>

            <div className="modal-actions">
              <button type="button" onClick={() => { setOpen(false); setEditingOccasion(null) }}>
                Huỷ
              </button>
              <button type="button" className="primary" onClick={submit}>
                {editingOccasion ? <Save size={14} /> : <Plus size={14} />}
                <span>{editingOccasion ? 'Lưu thay đổi' : 'Thêm dịp'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
