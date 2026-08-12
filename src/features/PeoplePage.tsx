import { useEffect, useState } from 'react'
import { ArrowLeft, Heart, Plus, Save, UserRound } from 'lucide-react'
import { localDate } from '../lib/date'
import { supabase } from '../lib/supabase'
import type { Person, PersonDailyLog, PersonInterest } from '../types'
import { Empty } from './shared'
import { useToast } from './ToastContext'

const key = 'daily_people_local'
export function PeoplePage() {
  const { showToast } = useToast()
  const [people, setPeople] = useState<Person[]>([])
  const [selected, setSelected] = useState<Person | null>(null)
  const [name, setName] = useState('')
  const [interest, setInterest] = useState('')
  const [interests, setInterests] = useState<PersonInterest[]>([])
  const [date, setDate] = useState(localDate())
  const [log, setLog] = useState('')
  const [source, setSource] = useState<'Local' | 'Supabase'>('Local')

  useEffect(() => { const saved = localStorage.getItem(key); if (saved) setPeople(JSON.parse(saved)); if (supabase) supabase.from('people').select('*').is('deleted_at', null).order('name').then(({ data }) => { if (data) { setPeople(data as Person[]); setSource('Supabase') } }) }, [])
  useEffect(() => { if (selected && supabase) { supabase.from('person_interests').select('*').eq('person_id', selected.id).then(({ data }) => setInterests((data ?? []) as PersonInterest[])); supabase.from('person_daily_logs').select('*').eq('person_id', selected.id).eq('log_date', date).maybeSingle().then(({ data }) => setLog((data as PersonDailyLog | null)?.content ?? '')) } }, [selected, date])
  const persistLocal = (next: Person[]) => { setPeople(next); localStorage.setItem(key, JSON.stringify(next)); setSource('Local') }
  const addPerson = async () => { const value = name.trim(); if (!value) return; const local: Person = { id: crypto.randomUUID(), name: value }; if (!supabase) { persistLocal([local, ...people]); setName(''); return } const { data, error } = await supabase.from('people').insert({ name: value }).select().single(); if (error || !data) { persistLocal([local, ...people]); showToast('Đã lưu Local'); } else { setPeople((p) => [data as Person, ...p]); setSource('Supabase'); showToast('Đã lưu Supabase') } setName('') }
  const saveLog = async () => { if (!selected || !log.trim()) return; if (!supabase) { showToast('Đã lưu Local'); setSource('Local'); return } const { error } = await supabase.from('person_daily_logs').upsert({ person_id: selected.id, log_date: date, content: log.trim() }, { onConflict: 'user_id,person_id,log_date' }); if (error) { showToast('Đã lưu Local'); setSource('Local') } else { showToast('Đã lưu Supabase'); setSource('Supabase') } }
  const addInterest = async () => { if (!selected || !interest.trim()) return; const local = { id: crypto.randomUUID(), person_id: selected.id, label: interest.trim() }; setInterests((i) => [...i, local]); setInterest(''); if (supabase) { const { error } = await supabase.from('person_interests').insert({ person_id: selected.id, label: local.label }); if (error) { setSource('Local'); showToast('Sở thích đã lưu Local') } else { setSource('Supabase'); showToast('Sở thích đã lưu Supabase') } } }
  if (selected) return <section style={{ maxWidth: 800, margin: '0 auto' }}><button className="icon" onClick={() => setSelected(null)}><ArrowLeft size={18} /> Người</button><div className="card"><h2><UserRound size={18} /> {selected.name}</h2><div style={{ display: 'flex', gap: 6 }}><input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Thêm sở thích…" /><button className="primary" onClick={addInterest}><Plus size={14} /></button></div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>{interests.map((i) => <span key={i.id} className="eyebrow"><Heart size={12} /> {i.label}</span>)}</div><label>Nhật ký ngày {date}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><textarea rows={8} value={log} onChange={(e) => setLog(e.target.value)} placeholder={`Viết nhật ký với ${selected.name}…`} /><button className="primary" onClick={saveLog}><Save size={14} /> Lưu ({source})</button></div></section>
  return <section style={{ maxWidth: 800, margin: '0 auto' }}><div className="card"><h2><UserRound size={18} /> Người</h2><div style={{ display: 'flex', gap: 6 }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên người…" /><button className="primary" onClick={addPerson}><Plus size={14} /> Thêm</button></div></div>{people.length ? <div style={{ display: 'grid', gap: 8 }}>{people.map((p) => <button key={p.id} className="card" onClick={() => setSelected(p)} style={{ textAlign: 'left' }}><UserRound size={18} /> <strong>{p.name}</strong></button>)}</div> : <Empty icon={UserRound}>Chưa có người nào.</Empty>}</section>
}
