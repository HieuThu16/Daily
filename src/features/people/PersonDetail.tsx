import { useEffect, useState } from 'react'
import { ArrowLeft, Heart, Plus, Save, X } from 'lucide-react'
import { localDate } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import { ageOnNext, isLunar, lunarLabel, nextOccurrence } from '../../lib/occasions'
import type { Person, PersonDailyLog, PersonInterest, PersonOccasion } from '../../types'
import { useToast } from '../ToastContext'
import { avatarStyle, initials } from './avatar'
import { DailyLogPhotos } from './DailyLogPhotos'
import { OccasionsSection } from './OccasionsSection'
import type { NewOccasion } from './usePeopleData'

type Props = {
  person: Person
  occasions: PersonOccasion[]
  people: Person[]
  onBack: () => void
  onAddOccasion: (input: NewOccasion) => void
  onRemoveOccasion: (id: string) => void
}

export function PersonDetail({ person, occasions, people, onBack, onAddOccasion, onRemoveOccasion }: Props) {
  const { showToast } = useToast()
  const [interests, setInterests] = useState<PersonInterest[]>([])
  const [interest, setInterest] = useState('')
  const [date, setDate] = useState(localDate())
  const [log, setLog] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('person_interests')
      .select('*')
      .eq('person_id', person.id)
      .then(({ data }) => setInterests((data ?? []) as PersonInterest[]))
  }, [person.id])

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('person_daily_logs')
      .select('*')
      .eq('person_id', person.id)
      .eq('log_date', date)
      .maybeSingle()
      .then(({ data }) => setLog((data as PersonDailyLog | null)?.content ?? ''))
  }, [person.id, date])

  const birthday = occasions.find((o) => o.person_id === person.id && o.kind === 'BIRTHDAY')
  const nextBirthday = birthday ? nextOccurrence(birthday) : null
  const age = birthday ? ageOnNext(birthday) : null

  const addInterest = async () => {
    const label = interest.trim()
    if (!label) return
    const local: PersonInterest = { id: crypto.randomUUID(), person_id: person.id, label }
    setInterests((prev) => [...prev, local])
    setInterest('')
    if (!supabase) return showToast('Sở thích đã lưu Local')
    const { error } = await supabase.from('person_interests').insert({ person_id: person.id, label })
    showToast(error ? 'Sở thích đã lưu Local' : 'Sở thích đã lưu Supabase')
  }

  const removeInterest = async (id: string) => {
    setInterests((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('person_interests').delete().eq('id', id)
  }

  const saveLog = async () => {
    if (!log.trim()) return
    if (!supabase) return showToast('Đã lưu Local')
    const { error } = await supabase
      .from('person_daily_logs')
      .upsert({ person_id: person.id, log_date: date, content: log.trim() }, { onConflict: 'user_id,person_id,log_date' })
    showToast(error ? 'Đã lưu Local' : 'Đã lưu Supabase')
  }

  return (
    <section className="people-page">
      <button className="icon" onClick={onBack} style={{ marginBottom: 10, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <ArrowLeft size={18} /> Người
      </button>

      <div className="person-hero">
        {person.avatar_url ? (
          <img className="person-avatar large" src={person.avatar_url} alt={person.name} />
        ) : (
          <div className="person-avatar large" style={avatarStyle(person.name)}>
            {initials(person.name)}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h2>{person.name}</h2>
          {nextBirthday && (
            <div className="person-meta">
              🎂 Sinh nhật {nextBirthday.getDate()}/{nextBirthday.getMonth() + 1}
              {birthday && isLunar(birthday) ? ` (${lunarLabel(birthday)})` : ''}
              {age ? ` · ${age} tuổi` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="card home-section-card">
        <div className="home-section-head">
          <h3>
            <Heart size={17} color="var(--rose)" /> Sở thích
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="Thêm sở thích…"
            aria-label="Thêm sở thích"
          />
          <button className="primary" onClick={addInterest} aria-label="Lưu sở thích">
            <Plus size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {interests.length === 0 && <p className="home-card-empty">Chưa ghi sở thích nào.</p>}
          {interests.map((item) => (
            <span key={item.id} className="interest-chip">
              <Heart size={12} /> {item.label}
              <button onClick={() => removeInterest(item.id)} aria-label={`Xoá ${item.label}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <OccasionsSection
        occasions={occasions}
        people={people}
        personId={person.id}
        title="Dịp của người này"
        withinDays={400}
        onAdd={onAddOccasion}
        onRemove={onRemoveOccasion}
      />

      <div className="card home-section-card">
        <div className="home-section-head">
          <h3>Nhật ký</h3>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày nhật ký" />
        </div>
        <textarea
          rows={8}
          value={log}
          onChange={(e) => setLog(e.target.value)}
          placeholder={`Viết nhật ký với ${person.name}…`}
          style={{ width: '100%' }}
        />
        <button className="primary" onClick={saveLog} style={{ marginTop: 8 }}>
          <Save size={14} /> Lưu
        </button>

        <DailyLogPhotos personId={person.id} date={date} />
      </div>
    </section>
  )
}
