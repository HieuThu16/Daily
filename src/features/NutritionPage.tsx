import { useEffect, useMemo, useState } from 'react'
import { CloudMoon, Moon, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { shiftDate, sleepDuration, sleepMinutesOn } from '../lib/sleep'
import { ClockTimeInput } from './nutrition/ClockTimeInput'
import { useToast } from './ToastContext'
import { Modal } from './shared'
import { FoodPeriodView, PeriodSelector, SleepPeriodView } from './nutrition/NutritionPeriodViews'
import {
  getPeriodRange,
  shiftPeriodAnchor,
  type MealFilter,
  type MealSlot,
  type NutritionLog,
  type PeriodMode,
  type SleepLog,
} from './nutrition/periodData'

type SubTab = 'food' | 'sleep'

const MEALS: { slot: MealSlot; label: string; emoji: string; color: string; bg: string }[] = [
  { slot: 'MORNING', label: 'Sáng', emoji: '🌅', color: '#f59e0b', bg: 'rgba(245,185,11,.10)' },
  { slot: 'LUNCH', label: 'Trưa', emoji: '☀️', color: '#10b981', bg: 'rgba(16,185,129,.10)' },
  { slot: 'AFTERNOON', label: 'Chiều', emoji: '🌤️', color: '#f97316', bg: 'rgba(249,115,22,.10)' },
  { slot: 'EVENING', label: 'Tối', emoji: '🌙', color: '#6366f1', bg: 'rgba(99,102,241,.10)' },
]

function money(price: number) {
  return `${new Intl.NumberFormat('vi-VN').format(price)}đ`
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? `${rest}m` : ''}` : `${rest}m`
}

function periodLabel(anchor: string, mode: PeriodMode) {
  const range = getPeriodRange(anchor, mode)
  if (mode === 'day') return anchor
  if (mode === 'month') {
    const [year, month] = anchor.split('-')
    return `Tháng ${Number(month)}/${year}`
  }
  const format = (date: string) => {
    const [, month, day] = date.split('-')
    return `${Number(day)}/${Number(month)}`
  }
  return `${format(range.start)} – ${format(range.end)}`
}

export function NutritionPage() {
  const { showToast } = useToast()
  const [tab, setTab] = useState<SubTab>('food')
  const [currentDate, setCurrentDate] = useState(localDate())
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day')
  const [logs, setLogs] = useState<NutritionLog[]>([])
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [periodFoodLogs, setPeriodFoodLogs] = useState<NutritionLog[]>([])
  const [periodSleepLogs, setPeriodSleepLogs] = useState<SleepLog[]>([])
  const [mealFilter, setMealFilter] = useState<MealFilter>('ALL')
  const [loading, setLoading] = useState(true)

  const [foodModal, setFoodModal] = useState(false)
  const [activeMeal, setActiveMeal] = useState<MealSlot>('MORNING')
  const [foodName, setFoodName] = useState('')
  const [foodPrice, setFoodPrice] = useState('')
  const [foodLogTime, setFoodLogTime] = useState(() => new Date().toTimeString().slice(0, 5))
  
  const [sleepModal, setSleepModal] = useState(false)
  const [editingSleep, setEditingSleep] = useState<SleepLog | null>(null)
  const [sleepStart, setSleepStart] = useState('22:00')
  const [sleepEnd, setSleepEnd] = useState('06:00')
  const [dream, setDream] = useState('')

  const [dreamModalLog, setDreamModalLog] = useState<SleepLog | null>(null)
  const [dreamText, setDreamText] = useState('')

  const periodRange = useMemo(() => getPeriodRange(currentDate, periodMode), [currentDate, periodMode])

  useEffect(() => {
    let active = true
    async function fetchActiveData() {
      setLoading(true)
      try {
        if (periodMode === 'day') {
          if (tab === 'food') {
            const { data, error } = await supabase!.from('nutrition_logs').select('*').eq('log_date', currentDate).is('deleted_at', null).order('created_at')
            if (error) throw error
            if (!active) return
            setLogs((data ?? []) as NutritionLog[])
          } else {
            const { data, error } = await supabase!.from('sleep_logs').select('*').gte('log_date', shiftDate(currentDate, -1)).lte('log_date', currentDate).is('deleted_at', null).order('created_at')
            if (error) throw error
            if (!active) return
            setSleepLogs(((data ?? []) as SleepLog[]).filter((log) => sleepMinutesOn(log, currentDate) > 0))
          }
        } else {
          const table = tab === 'food' ? 'nutrition_logs' : 'sleep_logs'
          const { data, error } = await supabase!.from(table).select('*').gte('log_date', periodRange.start).lte('log_date', periodRange.end).is('deleted_at', null).order('log_date', { ascending: false }).order('created_at')
          if (error) throw error
          if (!active) return
          if (tab === 'food') setPeriodFoodLogs((data ?? []) as NutritionLog[])
          else setPeriodSleepLogs((data ?? []) as SleepLog[])
        }
      } catch {
        if (!active) return
        if (periodMode === 'day') {
          if (tab === 'food') setLogs(readLocalRange<NutritionLog>('nutrition', [currentDate]))
          else setSleepLogs(readLocalRange<SleepLog>('sleep', [shiftDate(currentDate, -1), currentDate]).filter((log) => sleepMinutesOn(log, currentDate) > 0))
        } else {
          if (tab === 'food') setPeriodFoodLogs(readLocalRange<NutritionLog>('nutrition', periodRange.days))
          else setPeriodSleepLogs(readLocalRange<SleepLog>('sleep', periodRange.days))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchActiveData()
    return () => { active = false }
  }, [currentDate, tab, periodMode, periodRange])

  function readLocalRange<T extends { log_date: string }>(prefix: string, days: string[]): T[] {
    const result: T[] = []
    for (const d of days) {
      try {
        const raw = localStorage.getItem(`${prefix}_${d}`)
        if (raw) result.push(...(JSON.parse(raw) as T[]))
      } catch { /* empty */ }
    }
    return result
  }

  const groupedFood = useMemo(() => {
    const map: Record<MealSlot, NutritionLog[]> = { MORNING: [], LUNCH: [], AFTERNOON: [], EVENING: [] }
    for (const log of logs) map[log.meal_slot]?.push(log)
    return map
  }, [logs])

  async function addFood() {
    const priceNum = Number(foodPrice.replace(/\D/g, '')) || 0
    const payload = { meal_slot: activeMeal, food_name: foodName.trim() || 'Món ăn', price: priceNum, log_date: currentDate, log_time: foodLogTime }
    try {
      const { data, error } = await supabase!.from('nutrition_logs').insert(payload).select().single()
      if (error) throw error
      setLogs((current) => [...current, data as NutritionLog])
      showToast('✅ Đã ghi món ăn!')
    } catch {
      const fallback = { ...payload, id: Date.now().toString(), created_at: new Date().toISOString() }
      const next = [...logs, fallback]
      setLogs(next)
      localStorage.setItem(`nutrition_${currentDate}`, JSON.stringify(next))
      showToast('📴 Đã lưu offline')
    }
    setFoodName(''); setFoodPrice(''); setFoodModal(false)
  }

  function openAddSleepModal() {
    setEditingSleep(null)
    setSleepStart('22:00')
    setSleepEnd('06:00')
    setDream('')
    setSleepModal(true)
  }

  function openEditSleepModal(log: SleepLog) {
    setEditingSleep(log)
    setSleepStart(log.sleep_start)
    setSleepEnd(log.sleep_end)
    setDream(log.dream ?? '')
    setSleepModal(true)
  }

  function openDreamModal(log: SleepLog) {
    setDreamModalLog(log)
    setDreamText(log.dream ?? '')
  }

  async function saveSleep() {
    const payload = {
      sleep_start: sleepStart,
      sleep_end: sleepEnd,
      log_date: currentDate,
      duration_minutes: sleepDuration({ sleep_start: sleepStart, sleep_end: sleepEnd, log_date: currentDate }),
      dream: dream.trim() || null,
    }

    if (editingSleep) {
      try {
        if (supabase) {
          const { data, error } = await supabase.from('sleep_logs').update(payload).eq('id', editingSleep.id).select().single()
          if (error) throw error
          setSleepLogs((prev) => prev.map((item) => (item.id === editingSleep.id ? (data as SleepLog) : item)))
          setPeriodSleepLogs((prev) => prev.map((item) => (item.id === editingSleep.id ? (data as SleepLog) : item)))
        } else {
          throw new Error('Offline')
        }
        showToast('✏️ Đã cập nhật phiên ngủ!')
      } catch {
        const updated = { ...editingSleep, ...payload }
        setSleepLogs((prev) => prev.map((item) => (item.id === editingSleep.id ? updated : item)))
        setPeriodSleepLogs((prev) => prev.map((item) => (item.id === editingSleep.id ? updated : item)))
        const local = readLocalRange<SleepLog>('sleep', [currentDate])
        const next = local.map((item) => (item.id === editingSleep.id ? updated : item))
        localStorage.setItem(`sleep_${currentDate}`, JSON.stringify(next))
        showToast('📴 Đã cập nhật offline')
      }
    } else {
      try {
        const { data, error } = await supabase!.from('sleep_logs').insert(payload).select().single()
        if (error) throw error
        setSleepLogs((current) => [...current, data as SleepLog])
        showToast('✅ Đã ghi giấc ngủ!')
      } catch {
        const fallback = { ...payload, id: Date.now().toString(), created_at: new Date().toISOString() }
        const next = [...sleepLogs, fallback]
        setSleepLogs(next)
        localStorage.setItem(`sleep_${currentDate}`, JSON.stringify(next))
        showToast('📴 Đã lưu offline')
      }
    }
    setEditingSleep(null)
    setDream('')
    setSleepModal(false)
  }

  async function saveDreamOnly() {
    if (!dreamModalLog) return
    const newDream = dreamText.trim() || null
    try {
      if (supabase) {
        const { data, error } = await supabase.from('sleep_logs').update({ dream: newDream }).eq('id', dreamModalLog.id).select().single()
        if (error) throw error
        setSleepLogs((prev) => prev.map((item) => (item.id === dreamModalLog.id ? (data as SleepLog) : item)))
        setPeriodSleepLogs((prev) => prev.map((item) => (item.id === dreamModalLog.id ? (data as SleepLog) : item)))
      } else {
        throw new Error('Offline')
      }
      showToast('💭 Đã lưu giấc mơ!')
    } catch {
      const updated = { ...dreamModalLog, dream: newDream }
      setSleepLogs((prev) => prev.map((item) => (item.id === dreamModalLog.id ? updated : item)))
      setPeriodSleepLogs((prev) => prev.map((item) => (item.id === dreamModalLog.id ? updated : item)))
      const local = readLocalRange<SleepLog>('sleep', [currentDate])
      const next = local.map((item) => (item.id === dreamModalLog.id ? updated : item))
      localStorage.setItem(`sleep_${currentDate}`, JSON.stringify(next))
      showToast('📴 Đã lưu offline')
    }
    setDreamModalLog(null)
    setDreamText('')
  }

  async function deleteFood(id: string) {
    try { await supabase!.from('nutrition_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id) } catch { /* local fallback below */ }
    setLogs((current) => current.filter((log) => log.id !== id))
    setPeriodFoodLogs((current) => current.filter((log) => log.id !== id))
    showToast('🗑️ Đã xoá')
  }

  async function deleteSleep(id: string) {
    try { await supabase!.from('sleep_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id) } catch { /* local fallback below */ }
    setSleepLogs((current) => current.filter((log) => log.id !== id))
    setPeriodSleepLogs((current) => current.filter((log) => log.id !== id))
    showToast('🗑️ Đã xoá')
  }

  const totalFood = logs.reduce((sum, log) => sum + log.price, 0)
  const totalSleep = sleepLogs.reduce((sum, log) => sum + sleepMinutesOn(log, currentDate), 0)

  return (
    <section className="page-shell is-narrow" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <button type="button" aria-pressed={tab === 'food'} onClick={() => setTab('food')} className={tab === 'food' ? 'primary' : 'icon'} style={{ padding: '6px 10px', gap: 4 }}><UtensilsCrossed size={13} /> Ăn uống</button>
          <button type="button" aria-pressed={tab === 'sleep'} onClick={() => setTab('sleep')} className={tab === 'sleep' ? 'primary' : 'icon'} style={{ padding: '6px 10px', gap: 4, background: tab === 'sleep' ? '#6366f1' : undefined }}><Moon size={13} /> Ngủ</button>
        </div>
        <PeriodSelector value={periodMode} onChange={setPeriodMode} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <button type="button" className="icon" aria-label="Khoảng trước" onClick={() => setCurrentDate(shiftPeriodAnchor(currentDate, periodMode, -1))}>‹</button>
        <strong style={{ minWidth: 125, color: 'var(--primary)', fontSize: '.76rem', textAlign: 'center' }}>{periodLabel(currentDate, periodMode)}</strong>
        <button type="button" className="icon" aria-label="Khoảng sau" onClick={() => setCurrentDate(shiftPeriodAnchor(currentDate, periodMode, 1))}>›</button>
      </div>

      {loading ? <p className="muted" style={{ textAlign: 'center', padding: 24 }}>Đang tải…</p> : (
        <>
          {tab === 'food' && periodMode === 'day' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderRadius: 13, background: 'var(--primary)', color: 'white' }}><span>Tổng chi hôm nay</span><strong>{money(totalFood)}</strong></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
                {MEALS.map((meal) => (
                  <button key={meal.slot} type="button" aria-label={meal.label} onClick={() => { setActiveMeal(meal.slot); setFoodModal(true) }} style={{ display: 'grid', justifyItems: 'center', gap: 2, padding: '8px 2px', border: `1px solid ${meal.color}`, borderRadius: 12, background: meal.bg, color: meal.color, cursor: 'pointer' }}>
                    <span>{meal.emoji}</span><strong style={{ fontSize: '.67rem' }}>{meal.label}</strong><small>{money(groupedFood[meal.slot].reduce((sum, log) => sum + log.price, 0))}</small><Plus size={11} />
                  </button>
                ))}
              </div>
              {MEALS.map((meal) => groupedFood[meal.slot].length ? (
                <div key={meal.slot} className="card" style={{ padding: 10, margin: 0 }}>
                  <strong style={{ color: meal.color, fontSize: '.8rem' }}>{meal.emoji} {meal.label}</strong>
                  {groupedFood[meal.slot].map((log) => (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, padding: '7px 8px', borderRadius: 9, background: meal.bg }}>
                      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: '.78rem' }}>{log.food_name}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{log.log_time}</small></div>
                      <b style={{ color: meal.color, fontSize: '.76rem' }}>{money(log.price)}</b>
                      <button type="button" aria-label={`Xóa ${log.food_name}`} onClick={() => deleteFood(log.id)} style={{ border: 0, background: 'none', color: '#ef4444' }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : null)}
            </>
          )}

          {tab === 'food' && periodMode !== 'day' && <FoodPeriodView logs={periodFoodLogs} days={periodRange.days} mealFilter={mealFilter} onMealFilter={setMealFilter} onDelete={deleteFood} />}

          {tab === 'sleep' && periodMode === 'day' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 13, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
                <div><small>Tổng ngủ hôm nay</small><strong style={{ display: 'block', fontSize: '1.2rem' }}>{totalSleep ? duration(totalSleep) : '—'}</strong></div>
                <button type="button" className="primary" onClick={openAddSleepModal} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)' }}><Plus size={13} /> Ghi</button>
              </div>
              {sleepLogs.map((log) => (
                <div key={log.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Moon size={18} color="#6366f1" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{log.sleep_start} → {log.sleep_end}{log.log_date !== currentDate && ' (hôm trước)'}</strong>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                        {duration(log.duration_minutes)}
                        {sleepMinutesOn(log, currentDate) !== log.duration_minutes && ` · tính hôm nay ${duration(sleepMinutesOn(log, currentDate))}`}
                      </small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button type="button" aria-label={`Ghi giấc mơ ${log.sleep_start}`} title={log.dream ? 'Sửa giấc mơ' : 'Thêm giấc mơ'} onClick={() => openDreamModal(log)} style={{ border: 0, background: 'none', color: '#8b5cf6', padding: 4, cursor: 'pointer' }}><CloudMoon size={16} /></button>
                      <button type="button" aria-label={`Sửa phiên ngủ ${log.sleep_start}`} title="Sửa phiên ngủ" onClick={() => openEditSleepModal(log)} style={{ border: 0, background: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}><Pencil size={15} /></button>
                      <button type="button" aria-label={`Xóa giấc ngủ ${log.sleep_start}`} title="Xoá phiên ngủ" onClick={() => deleteSleep(log.id)} style={{ border: 0, background: 'none', color: '#ef4444', padding: 4, cursor: 'pointer' }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  {log.dream ? (
                    <div onClick={() => openDreamModal(log)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 10px', background: 'var(--bg-main)', borderRadius: 8, fontSize: '0.78rem', borderLeft: '3px solid #8b5cf6', color: 'var(--text-main)', cursor: 'pointer' }} title="Nhấn để sửa giấc mơ">
                      <CloudMoon size={14} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ flex: 1 }}>{log.dream}</span>
                      <Pencil size={11} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} />
                    </div>
                  ) : (
                    <button type="button" onClick={() => openDreamModal(log)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', background: 'rgba(139, 92, 246, 0.08)', border: '1px dashed rgba(139, 92, 246, 0.3)', borderRadius: 6, fontSize: '0.74rem', color: '#8b5cf6', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', marginTop: 2 }}>
                      <Plus size={12} /> Thêm giấc mơ cho phiên này
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === 'sleep' && periodMode !== 'day' && <SleepPeriodView logs={periodSleepLogs} days={periodRange.days} onDelete={deleteSleep} onEdit={openEditSleepModal} onDream={openDreamModal} />}
        </>
      )}

      {foodModal && (
        <Modal onClose={() => setFoodModal(false)} title={`Thêm bữa ${MEALS.find((meal) => meal.slot === activeMeal)?.label}`}>
          <div className="form-grid">
            <label>Tên món ăn<input autoFocus value={foodName} onChange={(event) => setFoodName(event.target.value)} placeholder="Ví dụ: Cơm tấm" /></label>
            <label>Chi phí<input value={foodPrice} onChange={(event) => setFoodPrice(event.target.value)} placeholder="Ví dụ: 35k" inputMode="numeric" /></label>
            <label>Giờ<input type="time" value={foodLogTime} onChange={(event) => setFoodLogTime(event.target.value)} /></label>
            <button type="button" className="primary" onClick={addFood}>Lưu món ăn</button>
          </div>
        </Modal>
      )}

      {sleepModal && (
        <Modal onClose={() => { setSleepModal(false); setEditingSleep(null) }} title={editingSleep ? `Sửa phiên ngủ (${editingSleep.sleep_start} → ${editingSleep.sleep_end})` : 'Ghi giấc ngủ & Giấc mơ'}>
          <div className="form-grid" style={{ gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
              <ClockTimeInput label="Ngủ từ" value={sleepStart} onChange={setSleepStart} size={140} />
              <ClockTimeInput label="Đến" value={sleepEnd} onChange={setSleepEnd} size={140} />
            </div>
            <div style={{ textAlign: 'center', color: '#6366f1', fontWeight: 800, fontSize: '0.88rem' }}>
              {duration(sleepDuration({ sleep_start: sleepStart, sleep_end: sleepEnd, log_date: currentDate }))}
              {sleepEnd <= sleepStart && <small style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem' }}>Qua đêm — giờ chia cho {currentDate} và ngày hôm sau</small>}
            </div>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>💭 Nằm mơ thấy gì?</span>
              <textarea value={dream} onChange={(event) => setDream(event.target.value)} placeholder="Kể lại giấc mơ nếu bạn nhớ được…" rows={2} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)', padding: '6px 8px', fontSize: '0.84rem', resize: 'vertical' }} />
            </label>
            <button type="button" className="primary" onClick={saveSleep} style={{ padding: '8px 12px' }}>{editingSleep ? 'Cập nhật phiên ngủ' : 'Lưu giấc ngủ'}</button>
          </div>
        </Modal>
      )}

      {dreamModalLog && (
        <Modal onClose={() => setDreamModalLog(null)} title={`Ghi chép giấc mơ (${dreamModalLog.sleep_start} → ${dreamModalLog.sleep_end})`}>
          <div className="form-grid">
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>💭 Chi tiết giấc mơ</span>
              <textarea autoFocus value={dreamText} onChange={(event) => setDreamText(event.target.value)} placeholder="Nhập nội dung giấc mơ của phiên ngủ này…" rows={4} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', padding: '8px 10px', fontSize: '0.88rem', resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDreamModalLog(null)}>Huỷ</button>
              <button type="button" className="primary" onClick={saveDreamOnly}>Lưu giấc mơ</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
