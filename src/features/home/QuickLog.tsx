import { useState } from 'react'
import { Moon, Plus, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { sleepDuration } from '../../lib/sleep'
import { useToast } from '../ToastContext'
import { queueWrite } from '../../lib/offlineQueue'
import type { NutritionLog } from '../../types'

type Props = { dateKey: string; onSaved: () => void }

const slots: { key: NutritionLog['meal_slot']; label: string }[] = [
  { key: 'MORNING', label: 'Sáng' },
  { key: 'LUNCH', label: 'Trưa' },
  { key: 'AFTERNOON', label: 'Xế' },
  { key: 'EVENING', label: 'Tối' },
]

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Ghi nhanh bữa ăn / giấc ngủ ngay tại Home, không cần sang tab Ăn uống. */
export function QuickLog({ dateKey, onSaved }: Props) {
  const { showToast } = useToast()
  const [open, setOpen] = useState<'food' | 'sleep' | null>(null)
  const [slot, setSlot] = useState<NutritionLog['meal_slot']>('LUNCH')
  const [food, setFood] = useState('')
  const [price, setPrice] = useState('')
  const [start, setStart] = useState('22:00')
  const [end, setEnd] = useState('06:00')
  const [busy, setBusy] = useState(false)

  /** Ghi thẳng xuống bảng; hỏng mạng thì xếp vào offline queue & localStorage */
  async function save(table: 'nutrition_logs' | 'sleep_logs', payload: Record<string, unknown>, localKey: string) {
    setBusy(true)
    let savedOnline = false
    try {
      if (supabase) {
        const { error } = await supabase.from(table).insert(payload).select().single()
        if (!error) {
          savedOnline = true
          showToast(table === 'sleep_logs' ? '☁️ Đã lưu giấc ngủ lên Supabase!' : '☁️ Đã lưu bữa ăn lên Supabase!', 'success')
        } else {
          console.warn(`Lỗi lưu Supabase [${table}]:`, error)
        }
      }
    } catch (err) {
      console.warn(`Lỗi kết nối Supabase [${table}]:`, err)
    }

    if (!savedOnline) {
      const localId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`
      queueWrite({
        table,
        op: 'insert',
        payload: { id: localId, ...payload },
      })
      const key = `${localKey}_${dateKey}`
      const prev = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify([...prev, { ...payload, id: localId, created_at: new Date().toISOString() }]))
      showToast('💾 Đã lưu offline (Đã xếp hàng đồng bộ)', 'local')
    }

    setBusy(false)
    setOpen(null)
    setFood('')
    setPrice('')
    onSaved()
  }

  const saveFood = () =>
    save('nutrition_logs', {
      meal_slot: slot,
      food_name: food.trim() || 'Món ăn',
      price: Number(price.replace(/\D/g, '')) || 0,
      log_date: dateKey,
      log_time: nowTime(),
    }, 'nutrition')

  const saveSleep = () =>
    save('sleep_logs', {
      sleep_start: start,
      sleep_end: end,
      log_date: dateKey,
      duration_minutes: sleepDuration({ sleep_start: start, sleep_end: end, log_date: dateKey }),
    }, 'sleep')

  return (
    <div className="card" style={{ padding: 10, marginBottom: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: 6 }}>
        <button type="button" className="ghost" onClick={() => setOpen(open === 'food' ? null : 'food')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--emerald-bg)', color: 'var(--emerald)', border: 0, fontWeight: 700, cursor: 'pointer' }}>
          <UtensilsCrossed size={15} /> Thêm bữa ăn
        </button>
        <button type="button" className="ghost" onClick={() => setOpen(open === 'sleep' ? null : 'sleep')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--purple-bg)', color: 'var(--purple)', border: 0, fontWeight: 700, cursor: 'pointer' }}>
          <Moon size={15} /> Thêm giấc ngủ
        </button>
      </div>

      {open === 'food' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: 4 }}>
            {slots.map((s) => (
              <button key={s.key} type="button" onClick={() => setSlot(s.key)}
                style={{ padding: '6px 4px', borderRadius: 8, border: 0, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', background: slot === s.key ? 'var(--emerald)' : 'var(--bg-main)', color: slot === s.key ? '#fff' : 'var(--text-muted)' }}>
                {s.label}
              </button>
            ))}
          </div>
          <input value={food} onChange={(e) => setFood(e.target.value)} placeholder="Ăn gì?" aria-label="Tên món ăn" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Giá tiền" inputMode="numeric" aria-label="Giá tiền" />
          <button type="button" className="primary" disabled={busy} onClick={() => void saveFood()}>
            <Plus size={14} /> Lưu bữa ăn
          </button>
        </div>
      )}

      {open === 'sleep' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Ngủ lúc
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Dậy lúc
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <button type="button" className="primary" disabled={busy} onClick={() => void saveSleep()}>
            <Plus size={14} /> Lưu giấc ngủ
          </button>
        </div>
      )}
    </div>
  )
}
