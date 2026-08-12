import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Moon, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { useToast } from './ToastContext'
import { Modal } from './shared'

type MealSlot = 'MORNING' | 'LUNCH' | 'AFTERNOON' | 'EVENING'
type SubTab = 'food' | 'sleep' | 'stats'
type StatsPeriod = 'week' | 'month'

interface NutritionLog {
  id: string
  meal_slot: MealSlot
  food_name: string
  price: number
  log_date: string
  log_time?: string
  created_at: string
}

interface SleepLog {
  id: string
  sleep_start: string
  sleep_end: string
  log_date: string
  duration_minutes: number
  created_at: string
}

const MEALS: { slot: MealSlot; label: string; emoji: string; color: string; bg: string }[] = [
  { slot: 'MORNING',   label: 'Sáng',  emoji: '🌅', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  { slot: 'LUNCH',     label: 'Trưa',  emoji: '☀️',  color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  { slot: 'AFTERNOON', label: 'Chiều', emoji: '🌤️', color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  { slot: 'EVENING',   label: 'Tối',   emoji: '🌙', color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
]

// ── utils ───────────────────────────────────────────────────────────────────

function fmt(price: number) {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ'
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  return minutes
}

function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`
}

function sleepQuality(minutes: number) {
  if (minutes >= 450) return { label: 'Đủ giấc ✅', color: '#10b981' }
  if (minutes >= 360) return { label: 'Tạm ổn ⚠️', color: '#f59e0b' }
  return { label: 'Thiếu ngủ ❌', color: '#ef4444' }
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function getPeriodDates(period: StatsPeriod): { start: string; days: string[] } {
  const today = new Date()
  let start: Date
  if (period === 'week') {
    start = new Date(today)
    start.setDate(today.getDate() - 6) // last 7 days incl. today
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1)
  }
  const days: string[] = []
  const cur = new Date(start)
  while (cur <= today) {
    days.push(isoDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return { start: isoDate(start), days }
}

function shortDate(s: string) {
  const d = new Date(s + 'T12:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// ── Bar chart component ──────────────────────────────────────────────────────

function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {value > 0 ? (typeof value === 'number' && value > 1000 ? fmt(value) : fmtDuration(value)) : '—'}
      </div>
      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ width: '70%', height: `${Math.max(4, pct)}%`, borderRadius: '3px 3px 0 0', background: color, transition: 'height 0.4s', minHeight: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

function MiniBarPrice({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {value > 0 ? fmt(value) : '—'}
      </div>
      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ width: '70%', height: `${Math.max(4, pct)}%`, borderRadius: '3px 3px 0 0', background: color, transition: 'height 0.4s', minHeight: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function NutritionPage() {
  const { showToast } = useToast()
  const [tab, setTab] = useState<SubTab>('food')
  const [currentDate, setCurrentDate] = useState(localDate(new Date()))

  // Food state
  const [logs, setLogs] = useState<NutritionLog[]>([])
  const [foodLoading, setFoodLoading] = useState(true)
  const [foodModal, setFoodModal] = useState(false)
  const [activeMeal, setActiveMeal] = useState<MealSlot>('MORNING')
  const [foodName, setFoodName] = useState('')
  const [foodPrice, setFoodPrice] = useState('')
  const [foodLogDate, setFoodLogDate] = useState(currentDate)
  const [foodLogTime, setFoodLogTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })

  // Sleep state
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [sleepLoading, setSleepLoading] = useState(true)
  const [sleepModal, setSleepModal] = useState(false)
  const [sleepStart, setSleepStart] = useState('22:00')
  const [sleepEnd, setSleepEnd] = useState('06:00')

  // Stats state
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('week')
  const [allFoodLogs, setAllFoodLogs] = useState<NutritionLog[]>([])
  const [allSleepLogs, setAllSleepLogs] = useState<SleepLog[]>([])
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => { fetchFood() }, [currentDate])
  useEffect(() => { fetchSleep() }, [currentDate])
  useEffect(() => { if (tab === 'stats') fetchStatsData() }, [tab, statsPeriod])

  // ── Food ─────────────────────────────────────────────────────────────────

  async function fetchFood() {
    setFoodLoading(true)
    try {
      const { data, error } = await supabase!.from('nutrition_logs').select('*')
        .eq('log_date', currentDate).is('deleted_at', null).order('created_at', { ascending: true })
      if (error) throw error
      setLogs(data || [])
    } catch {
      const local = localStorage.getItem(`nutrition_${currentDate}`)
      setLogs(local ? JSON.parse(local) : [])
    } finally { setFoodLoading(false) }
  }

  function parsePriceInput(val: string): number {
    if (!val) return 0
    let clean = val.toLowerCase().trim()
    if (clean.endsWith('k')) {
      const num = parseFloat(clean.replace('k', ''))
      return isNaN(num) ? 0 : Math.round(num * 1000)
    }
    if (clean.endsWith('kđ') || clean.endsWith('kd')) {
      const num = parseFloat(clean.replace(/kđ|kd/, ''))
      return isNaN(num) ? 0 : Math.round(num * 1000)
    }
    const num = parseInt(clean.replace(/\D/g, ''), 10)
    return isNaN(num) ? 0 : num
  }

  async function addFood() {
    if (!foodName.trim()) { showToast('⚠️ Nhập tên mục/đồ ăn!'); return }
    const price = parsePriceInput(foodPrice)
    const payload = {
      meal_slot: activeMeal,
      food_name: foodName.trim(),
      price,
      log_date: foodLogDate || currentDate,
      log_time: foodLogTime
    }
    try {
      const { data, error } = await supabase!.from('nutrition_logs').insert(payload).select().single()
      if (error) throw error
      if (foodLogDate === currentDate) {
        setLogs(p => [...p, data])
      }
      showToast(`✅ Đã thêm ${foodName.trim()} (${fmt(price)})!`)
    } catch {
      const fb = { ...payload, id: Date.now().toString(), created_at: new Date().toISOString() } as NutritionLog
      if (foodLogDate === currentDate) {
        const next = [...logs, fb]
        setLogs(next)
        localStorage.setItem(`nutrition_${currentDate}`, JSON.stringify(next))
      }
      showToast('📴 Đã lưu offline')
    }
    setFoodName(''); setFoodPrice(''); setFoodModal(false)
  }

  async function deleteFood(id: string) {
    try {
      await supabase!.from('nutrition_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    } catch {}
    const next = logs.filter(l => l.id !== id)
    setLogs(next)
    localStorage.setItem(`nutrition_${currentDate}`, JSON.stringify(next))
    showToast('🗑️ Đã xoá')
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────

  async function fetchSleep() {
    setSleepLoading(true)
    try {
      const { data, error } = await supabase!.from('sleep_logs').select('*')
        .eq('log_date', currentDate).is('deleted_at', null).order('created_at', { ascending: true })
      if (error) throw error
      setSleepLogs(data || [])
    } catch {
      const local = localStorage.getItem(`sleep_${currentDate}`)
      setSleepLogs(local ? JSON.parse(local) : [])
    } finally { setSleepLoading(false) }
  }

  async function addSleep() {
    const dur = calcDuration(sleepStart, sleepEnd)
    const payload = { sleep_start: sleepStart, sleep_end: sleepEnd, log_date: currentDate, duration_minutes: dur }
    try {
      const { data, error } = await supabase!.from('sleep_logs').insert(payload).select().single()
      if (error) throw error
      setSleepLogs(p => [...p, data])
      showToast('✅ Đã ghi giấc ngủ!')
    } catch {
      const fb = { ...payload, id: Date.now().toString(), created_at: new Date().toISOString() } as SleepLog
      const next = [...sleepLogs, fb]
      setSleepLogs(next)
      localStorage.setItem(`sleep_${currentDate}`, JSON.stringify(next))
      showToast('📴 Đã lưu offline')
    }
    setSleepModal(false)
  }

  async function deleteSleep(id: string) {
    try {
      await supabase!.from('sleep_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    } catch {}
    const next = sleepLogs.filter(l => l.id !== id)
    setSleepLogs(next)
    localStorage.setItem(`sleep_${currentDate}`, JSON.stringify(next))
    showToast('🗑️ Đã xoá')
  }

  // ── Stats data ────────────────────────────────────────────────────────────

  async function fetchStatsData() {
    setStatsLoading(true)
    const { start } = getPeriodDates(statsPeriod)
    try {
      const [fd, sl] = await Promise.all([
        supabase!.from('nutrition_logs').select('*').gte('log_date', start).is('deleted_at', null),
        supabase!.from('sleep_logs').select('*').gte('log_date', start).is('deleted_at', null),
      ])
      setAllFoodLogs((fd.data || []) as NutritionLog[])
      setAllSleepLogs((sl.data || []) as SleepLog[])
    } catch {
      setAllFoodLogs([]); setAllSleepLogs([])
    } finally { setStatsLoading(false) }
  }

  // ── Derived: daily food ───────────────────────────────────────────────────

  const groupedLogs = useMemo(() => {
    const g: Record<MealSlot, NutritionLog[]> = { MORNING: [], LUNCH: [], AFTERNOON: [], EVENING: [] }
    logs.forEach(l => g[l.meal_slot].push(l))
    return g
  }, [logs])

  const grandTotal = logs.reduce((s, l) => s + l.price, 0)
  const totalSleep = sleepLogs.reduce((s, l) => s + l.duration_minutes, 0)

  const changeDate = (d: number) => {
    const date = new Date(currentDate)
    date.setDate(date.getDate() + d)
    setCurrentDate(localDate(date))
  }

  // ── Derived: stats ────────────────────────────────────────────────────────

  const { days: periodDays } = useMemo(() => getPeriodDates(statsPeriod), [statsPeriod])

  // Food: spending per day
  const foodByDay = useMemo(() => {
    const map: Record<string, number> = {}
    periodDays.forEach(d => { map[d] = 0 })
    allFoodLogs.forEach(l => { if (map[l.log_date] !== undefined) map[l.log_date] += l.price })
    return map
  }, [allFoodLogs, periodDays])

  // Food: spending per meal slot across period
  const foodBySlot = useMemo(() => {
    const map: Record<MealSlot, number> = { MORNING: 0, LUNCH: 0, AFTERNOON: 0, EVENING: 0 }
    allFoodLogs.forEach(l => { map[l.meal_slot] += l.price })
    return map
  }, [allFoodLogs])

  const totalFoodSpend = allFoodLogs.reduce((s, l) => s + l.price, 0)
  const avgFoodPerDay = periodDays.length > 0 ? Math.round(totalFoodSpend / periodDays.length) : 0
  const maxFoodDay = Math.max(...Object.values(foodByDay), 1)

  // Sleep: duration per day
  const sleepByDay = useMemo(() => {
    const map: Record<string, number> = {}
    periodDays.forEach(d => { map[d] = 0 })
    allSleepLogs.forEach(l => { if (map[l.log_date] !== undefined) map[l.log_date] += l.duration_minutes })
    return map
  }, [allSleepLogs, periodDays])

  const daysWithSleep = allSleepLogs.length > 0
    ? [...new Set(allSleepLogs.map(l => l.log_date))].length : 0
  const totalSleepMins = allSleepLogs.reduce((s, l) => s + l.duration_minutes, 0)
  const avgSleepPerDay = daysWithSleep > 0 ? Math.round(totalSleepMins / daysWithSleep) : 0
  const maxSleepDay = Math.max(...Object.values(sleepByDay), 1)
  const goodSleepDays = Object.values(sleepByDay).filter(m => m >= 450).length
  const okSleepDays = Object.values(sleepByDay).filter(m => m >= 360 && m < 450).length
  const badSleepDays = Object.values(sleepByDay).filter(m => m > 0 && m < 360).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Header: sub-tabs + date nav ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {([
            { key: 'food',  icon: <UtensilsCrossed size={13}/>, label: 'Ăn uống', active: '#2563eb' },
            { key: 'sleep', icon: <Moon size={13}/>,            label: 'Ngủ',     active: '#6366f1' },
            { key: 'stats', icon: <BarChart3 size={13}/>,       label: 'Thống kê',active: '#10b981' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as SubTab)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, border: '1.5px solid',
                borderColor: tab === t.key ? t.active : 'var(--card-border)',
                background: tab === t.key ? t.active : 'var(--card-bg)',
                color: tab === t.key ? 'white' : 'var(--text-main)', cursor: 'pointer', transition: 'all 0.18s'
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab !== 'stats' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => changeDate(-1)} className="icon" style={{ padding: '3px 7px', fontSize: '0.85rem' }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--primary)', minWidth: 78, textAlign: 'center' }}>{currentDate}</span>
            <button onClick={() => changeDate(1)} className="icon" style={{ padding: '3px 7px', fontSize: '0.85rem' }}>›</button>
          </div>
        )}

        {tab === 'stats' && (
          <div style={{ display: 'flex', gap: 5 }}>
            {([['week','7 ngày'],['month','Tháng']] as [StatsPeriod,string][]).map(([p, label]) => (
              <button
                key={p}
                onClick={() => setStatsPeriod(p)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid', transition: 'all 0.15s',
                  borderColor: statsPeriod === p ? 'var(--emerald)' : 'var(--card-border)',
                  background: statsPeriod === p ? 'var(--emerald)' : 'var(--card-bg)',
                  color: statsPeriod === p ? 'white' : 'var(--text-main)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════ FOOD TAB ════════════════════════════════════════ */}
      {tab === 'food' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderRadius: 12, background: 'var(--primary)', color: 'white', boxShadow: '0 3px 12px rgba(37,99,235,0.18)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tổng chi phí hôm nay</span>
            <span style={{ fontSize: '1rem', fontWeight: 800 }}>{fmt(grandTotal)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {MEALS.map(m => (
              <button key={m.slot} onClick={() => { setActiveMeal(m.slot); setFoodModal(true) }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', borderRadius: 12, border: '1.5px solid', borderColor: m.color, background: m.bg, cursor: 'pointer', transition: 'all 0.18s' }}>
                <span style={{ fontSize: '1.1rem' }}>{m.emoji}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: m.color }}>{m.label}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: m.color }}>{fmt(groupedLogs[m.slot].reduce((s, l) => s + l.price, 0))}</span>
                <Plus size={11} color={m.color} />
              </button>
            ))}
          </div>
          {foodLoading ? <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Đang tải…</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 'calc(100vh - 310px)', minHeight: 120 }}>
              {MEALS.map(m => {
                const items = groupedLogs[m.slot]
                if (!items.length) return null
                return (
                  <div key={m.slot} className="card" style={{ padding: 10, margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.95rem' }}>{m.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: m.color }}>{m.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: m.color }}>{fmt(items.reduce((s, l) => s + l.price, 0))}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.map(log => (
                        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: m.bg, fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, wordBreak: 'break-word', color: 'var(--text-main)' }}>{log.food_name}</span>
                            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              📅 {log.log_date} {log.log_time ? `⏰ ${log.log_time}` : log.created_at ? `⏰ ${log.created_at.slice(11, 16)}` : ''}
                            </span>
                          </div>
                          <span style={{ fontWeight: 800, color: m.color, marginLeft: 8, whiteSpace: 'nowrap', fontSize: '0.86rem' }}>{fmt(log.price)}</span>
                          <button onClick={() => deleteFood(log.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px', color: '#ef4444', display: 'flex' }}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {!logs.length && <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Chưa có gì hôm nay 🍽️</p>}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ SLEEP TAB ════════════════════════════════════════ */}
      {tab === 'sleep' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', boxShadow: '0 3px 12px rgba(99,102,241,0.25)' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.85 }}>Tổng ngủ hôm nay</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{totalSleep ? fmtDuration(totalSleep) : '—'}</div>
            </div>
            {totalSleep > 0 && (
              <div style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', color: sleepQuality(totalSleep).color === '#10b981' ? '#bbf7d0' : sleepQuality(totalSleep).color === '#f59e0b' ? '#fde68a' : '#fecaca' }}>
                {sleepQuality(totalSleep).label}
              </div>
            )}
            <button className="primary" onClick={() => setSleepModal(true)} style={{ padding: '6px 12px', fontSize: '0.78rem', background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.4)', gap: 4 }}>
              <Plus size={13} /> Ghi
            </button>
          </div>
          {sleepLogs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'Số lần', value: String(sleepLogs.length), color: '#6366f1' },
                { label: 'Trung bình', value: fmtDuration(Math.round(totalSleep / sleepLogs.length)), color: '#8b5cf6' },
                { label: 'Mục tiêu', value: '7h30m', color: '#10b981' },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: '8px 10px', margin: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {sleepLoading ? <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Đang tải…</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 'calc(100vh - 310px)', minHeight: 120 }}>
              {sleepLogs.length === 0 ? (
                <div className="card" style={{ padding: 28, margin: 0, textAlign: 'center' }}>
                  <Moon size={32} color="#6366f1" style={{ margin: '0 auto 8px' }} />
                  <p className="muted" style={{ margin: 0 }}>Chưa có dữ liệu giấc ngủ hôm nay.<br />Nhấn "Ghi" để thêm.</p>
                </div>
              ) : sleepLogs.map(s => {
                const dur = s.duration_minutes
                const q = sleepQuality(dur)
                return (
                  <div key={s.id} className="card" style={{ padding: '10px 14px', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Moon size={18} color="#6366f1" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{s.sleep_start} → {s.sleep_end}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{fmtDuration(dur)} · <span style={{ color: q.color, fontWeight: 600 }}>{q.label}</span></div>
                    </div>
                    <div style={{ width: 60, height: 6, borderRadius: 4, background: 'var(--card-border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(100, (dur / 540) * 100)}%`, background: dur >= 450 ? '#10b981' : dur >= 360 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <button onClick={() => deleteSleep(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex' }}><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ STATS TAB ════════════════════════════════════════ */}
      {tab === 'stats' && (
        statsLoading ? (
          <p className="muted" style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 'calc(100vh - 130px)' }}>

            {/* ── FOOD STATS ──────────────────────────────────────────────── */}
            <div className="card" style={{ padding: 14, margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <UtensilsCrossed size={15} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>Chi phí ăn uống</span>
              </div>

              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Tổng chi', value: fmt(totalFoodSpend), color: 'var(--primary)' },
                  { label: 'Trung bình/ngày', value: fmt(avgFoodPerDay), color: '#f97316' },
                  { label: 'Số ngày', value: `${[...new Set(allFoodLogs.map(l => l.log_date))].length}`, color: 'var(--emerald)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 10, background: 'var(--bg-main)' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Daily bar chart */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Chi tiêu theo ngày</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 80, padding: '0 2px' }}>
                {periodDays.map(d => {
                  const val = foodByDay[d] || 0
                  const pct = maxFoodDay > 0 ? (val / maxFoodDay) * 100 : 0
                  const isToday = d === localDate(new Date())
                  return (
                    <div key={d} title={`${shortDate(d)}: ${fmt(val)}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${Math.max(pct, val > 0 ? 4 : 0)}%`, borderRadius: '3px 3px 0 0', background: isToday ? 'var(--primary)' : 'rgba(37,99,235,0.35)', minHeight: val > 0 ? 4 : 0, transition: 'height 0.4s' }} />
                      <div style={{ fontSize: '0.5rem', color: isToday ? 'var(--primary)' : 'var(--text-muted)', fontWeight: isToday ? 800 : 400, whiteSpace: 'nowrap' }}>
                        {shortDate(d)}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Per meal slot breakdown */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 14, marginBottom: 8 }}>Chi theo bữa</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MEALS.map(m => {
                  const val = foodBySlot[m.slot]
                  const pct = totalFoodSpend > 0 ? (val / totalFoodSpend) * 100 : 0
                  return (
                    <div key={m.slot} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.72rem', width: 40, flexShrink: 0 }}>{m.emoji} {m.label}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-main)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: m.color, transition: 'width 0.4s' }} />
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: m.color, minWidth: 52, textAlign: 'right' }}>{fmt(val)}</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', minWidth: 32, textAlign: 'right' }}>{Math.round(pct)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── SLEEP STATS ─────────────────────────────────────────────── */}
            <div className="card" style={{ padding: 14, margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Moon size={15} color="#6366f1" />
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#6366f1' }}>Giấc ngủ</span>
              </div>

              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Trung bình/đêm', value: avgSleepPerDay ? fmtDuration(avgSleepPerDay) : '—', color: '#6366f1' },
                  { label: 'Tổng giờ ngủ', value: totalSleepMins ? fmtDuration(totalSleepMins) : '—', color: '#8b5cf6' },
                  { label: 'Ngày có data', value: String(daysWithSleep), color: 'var(--emerald)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 10, background: 'var(--bg-main)' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Daily bar chart sleep */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Giờ ngủ theo ngày</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 80, padding: '0 2px', marginBottom: 4 }}>
                {periodDays.map(d => {
                  const val = sleepByDay[d] || 0
                  const pct = maxSleepDay > 0 ? (val / maxSleepDay) * 100 : 0
                  const q = val > 0 ? sleepQuality(val) : null
                  const isToday = d === localDate(new Date())
                  return (
                    <div key={d} title={`${shortDate(d)}: ${val ? fmtDuration(val) : '—'}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${Math.max(pct, val > 0 ? 4 : 0)}%`, borderRadius: '3px 3px 0 0', background: q ? (isToday ? q.color : q.color + '88') : 'var(--card-border)', minHeight: val > 0 ? 4 : 0, transition: 'height 0.4s' }} />
                      <div style={{ fontSize: '0.5rem', color: isToday ? '#6366f1' : 'var(--text-muted)', fontWeight: isToday ? 800 : 400, whiteSpace: 'nowrap' }}>
                        {shortDate(d)}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Reference line label */}
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                🟢 Màu xanh = đủ giấc (≥7h30m) · 🟡 Vàng = tạm ổn · 🔴 Đỏ = thiếu ngủ
              </div>

              {/* Quality breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'Đủ giấc', count: goodSleepDays, color: '#10b981', bg: 'rgba(16,185,129,0.10)', emoji: '✅' },
                  { label: 'Tạm ổn',  count: okSleepDays,   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', emoji: '⚠️' },
                  { label: 'Thiếu ngủ', count: badSleepDays, color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  emoji: '❌' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 12, background: s.bg, border: `1px solid ${s.color}33` }}>
                    <div style={{ fontSize: '1.2rem' }}>{s.emoji}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: '0.62rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>ngày</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* ══════════════════ MODALS ══════════════════════════════════════════ */}

      {foodModal && (
        <Modal onClose={() => setFoodModal(false)} title="Thêm mục chi tiêu / đồ ăn">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              Khung giờ / Danh mục
              <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                {MEALS.map(m => (
                  <button key={m.slot} type="button" onClick={() => setActiveMeal(m.slot)}
                    style={{ flex: 1, padding: '5px 2px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, border: '1.5px solid', borderColor: activeMeal === m.slot ? m.color : 'var(--card-border)', background: activeMeal === m.slot ? m.bg : 'var(--bg-main)', color: activeMeal === m.slot ? m.color : 'var(--text-muted)', cursor: 'pointer' }}>
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </label>
            <label>
              Tên mục / Đồ ăn
              <input autoFocus type="text" value={foodName} onChange={e => setFoodName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFood()} placeholder="Ví dụ: Xăng xe, Cơm tấm, Sữa tươi, Phở..." />
            </label>
            <label>
              Giá tiền (Có thể nhập: 50k, 30k, 150000...)
              <input type="text" value={foodPrice} onChange={e => setFoodPrice(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFood()} placeholder="Ví dụ: 50k hoặc 30k" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                📅 Ngày
                <input type="date" value={foodLogDate} onChange={e => setFoodLogDate(e.target.value)} />
              </label>
              <label>
                ⏰ Giờ
                <input type="time" value={foodLogTime} onChange={e => setFoodLogTime(e.target.value)} />
              </label>
            </div>
            <button className="primary" onClick={addFood} style={{ marginTop: 4 }}>Lưu chi tiêu / món ăn</button>
          </div>
        </Modal>
      )}

      {sleepModal && (
        <Modal onClose={() => setSleepModal(false)} title="Ghi giấc ngủ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>Ngủ từ<input type="time" value={sleepStart} onChange={e => setSleepStart(e.target.value)} /></label>
              <label>Đến<input type="time" value={sleepEnd} onChange={e => setSleepEnd(e.target.value)} /></label>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#6366f1' }}>{fmtDuration(calcDuration(sleepStart, sleepEnd))}</div>
              <div style={{ fontSize: '0.72rem', color: '#6366f1', marginTop: 2 }}>{sleepQuality(calcDuration(sleepStart, sleepEnd)).label}</div>
            </div>
            <button className="primary" onClick={addSleep} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none' }}>
              <Moon size={14} /> Lưu giấc ngủ
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
