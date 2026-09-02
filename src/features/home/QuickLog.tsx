import { useMemo, useState } from 'react'
import { Moon, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { sleepDuration } from '../../lib/sleep'
import { useToast } from '../ToastContext'
import { queueWrite } from '../../lib/offlineQueue'
import { Modal } from '../shared'
import { ClockTimeInput } from '../nutrition/ClockTimeInput'
import { useRememberedFoods, saveRememberedFood, removeRememberedFood } from '../nutrition/foodSuggestions'
import type { NutritionLog } from '../../types'
import '../nutrition/NutritionPeriodViews.css'

type Props = { dateKey: string; onSaved: () => void }

type MealSlot = NutritionLog['meal_slot']

const MEALS: { slot: MealSlot; label: string; emoji: string; color: string; bg: string }[] = [
  { slot: 'MORNING', label: 'Sáng', emoji: '🌅', color: '#f59e0b', bg: 'rgba(245,185,11,.10)' },
  { slot: 'LUNCH', label: 'Trưa', emoji: '☀️', color: '#10b981', bg: 'rgba(16,185,129,.10)' },
  { slot: 'AFTERNOON', label: 'Chiều', emoji: '🌤️', color: '#f97316', bg: 'rgba(249,115,22,.10)' },
  { slot: 'EVENING', label: 'Tối', emoji: '🌙', color: '#6366f1', bg: 'rgba(99,102,241,.10)' },
]

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? `${rest}m` : ''}` : `${rest}m`
}

function money(price: number) {
  return `${new Intl.NumberFormat('vi-VN').format(price)}đ`
}

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Ghi bữa ăn / giấc ngủ bằng modal chuẩn đầy đủ tính năng ngay tại Thống kê ngày. */
export function QuickLog({ dateKey, onSaved }: Props) {
  const { showToast } = useToast()
  const [foodModal, setFoodModal] = useState(false)
  const [sleepModal, setSleepModal] = useState(false)

  // Form Bữa ăn
  const [slot, setSlot] = useState<MealSlot>('LUNCH')
  const [foodName, setFoodName] = useState('')
  const [foodPrice, setFoodPrice] = useState('')
  const [foodLogTime, setFoodLogTime] = useState(nowTime)
  const [showFoodSuggestions, setShowFoodSuggestions] = useState(false)

  // Form Giấc ngủ
  const [sleepStart, setSleepStart] = useState('22:00')
  const [sleepEnd, setSleepEnd] = useState('06:00')
  const [dream, setDream] = useState('')
  const [busy, setBusy] = useState(false)

  const rememberedFoods = useRememberedFoods()

  const filteredSuggestions = useMemo(() => {
    const q = foodName.trim().toLowerCase()
    if (!q) return rememberedFoods.slice(0, 10)
    return rememberedFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 10)
  }, [rememberedFoods, foodName])

  function openFoodModal() {
    const hour = new Date().getHours()
    const autoSlot: MealSlot = hour < 10 ? 'MORNING' : hour < 14 ? 'LUNCH' : hour < 18 ? 'AFTERNOON' : 'EVENING'
    setSlot(autoSlot)
    setFoodName('')
    setFoodPrice('')
    setFoodLogTime(nowTime())
    setShowFoodSuggestions(false)
    setFoodModal(true)
  }

  function openSleepModal() {
    setSleepStart('22:00')
    setSleepEnd('06:00')
    setDream('')
    setSleepModal(true)
  }

  async function handleSaveFood() {
    const name = foodName.trim()
    const rawPrice = foodPrice.replace(/[,.đ\s]/g, '').trim().toLowerCase()
    let parsedPrice = 0
    if (rawPrice.endsWith('k')) {
      parsedPrice = (parseFloat(rawPrice.slice(0, -1)) || 0) * 1000
    } else {
      parsedPrice = parseInt(rawPrice, 10) || 0
    }

    if (!name) {
      showToast('⚠️ Vui lòng nhập tên món ăn', 'error')
      return
    }

    saveRememberedFood(name, parsedPrice)
    setBusy(true)

    const payload = {
      meal_slot: slot,
      food_name: name,
      price: parsedPrice,
      log_date: dateKey,
      log_time: foodLogTime || nowTime(),
    }

    let savedOnline = false
    try {
      if (supabase) {
        const { error } = await supabase.from('nutrition_logs').insert(payload).select().single()
        if (!error) {
          savedOnline = true
          showToast('🍲 Đã lưu bữa ăn lên Supabase!', 'success')
        } else {
          console.warn('Lỗi lưu Supabase [nutrition_logs]:', error)
        }
      }
    } catch (err) {
      console.warn('Lỗi kết nối Supabase [nutrition_logs]:', err)
    }

    if (!savedOnline) {
      const localId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`
      queueWrite({
        table: 'nutrition_logs',
        op: 'insert',
        payload: { id: localId, ...payload },
      })
      const key = `nutrition_${dateKey}`
      const prev = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify([...prev, { ...payload, id: localId, created_at: new Date().toISOString() }]))
      showToast('💾 Đã lưu offline (Đã xếp hàng đồng bộ)', 'local')
    }

    setBusy(false)
    setFoodModal(false)
    setFoodName('')
    setFoodPrice('')
    setShowFoodSuggestions(false)
    onSaved()
  }

  async function handleSaveSleep() {
    const dur = sleepDuration({ sleep_start: sleepStart, sleep_end: sleepEnd, log_date: dateKey })
    if (dur <= 0) {
      showToast('⚠️ Giờ ngủ không hợp lệ', 'error')
      return
    }

    const cleanDream = dream.trim() || null
    setBusy(true)

    const basePayload: Record<string, unknown> = {
      log_date: dateKey,
      sleep_start: sleepStart,
      sleep_end: sleepEnd,
      duration_minutes: dur,
    }
    if (cleanDream) {
      basePayload.dream = cleanDream
    }

    let savedOnline = false
    try {
      if (supabase) {
        const { error } = await supabase.from('sleep_logs').insert(basePayload).select().single()
        if (!error) {
          savedOnline = true
          showToast('☁️ Đã lưu giấc ngủ lên Supabase!', 'success')
        } else {
          console.warn('Lỗi lưu Supabase [sleep_logs] lần 1:', error)
          const fallbackPayload = {
            log_date: dateKey,
            sleep_start: sleepStart,
            sleep_end: sleepEnd,
            duration_minutes: dur,
          }
          const { error: retryErr } = await supabase.from('sleep_logs').insert(fallbackPayload).select().single()
          if (!retryErr) {
            savedOnline = true
            showToast('☁️ Đã lưu giấc ngủ lên Supabase!', 'success')
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi kết nối Supabase [sleep_logs]:', err)
    }

    if (!savedOnline) {
      const localId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`
      queueWrite({
        table: 'sleep_logs',
        op: 'insert',
        payload: { id: localId, ...basePayload },
      })
      const key = `sleep_${dateKey}`
      const prev = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify([...prev, { ...basePayload, id: localId, created_at: new Date().toISOString() }]))
      showToast('💾 Đã lưu offline (Đã xếp hàng đồng bộ)', 'local')
    }

    setBusy(false)
    setSleepModal(false)
    setDream('')
    onSaved()
  }

  const currentMealObj = MEALS.find((m) => m.slot === slot)

  return (
    <div className="card" style={{ padding: 10, marginBottom: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: 6 }}>
        <button
          type="button"
          className="ghost"
          onClick={openFoodModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 12px',
            borderRadius: 10,
            background: 'var(--emerald-bg)',
            color: 'var(--emerald)',
            border: 0,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <UtensilsCrossed size={15} /> Thêm bữa ăn
        </button>
        <button
          type="button"
          className="ghost"
          onClick={openSleepModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 12px',
            borderRadius: 10,
            background: 'var(--purple-bg)',
            color: 'var(--purple)',
            border: 0,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Moon size={15} /> Thêm giấc ngủ
        </button>
      </div>

      {/* MODAL THÊM BỮA ĂN CHUẨN ĐẦY ĐỦ */}
      {foodModal && (
        <Modal
          onClose={() => {
            setFoodModal(false)
            setShowFoodSuggestions(false)
          }}
          title={`Thêm món bữa ${currentMealObj?.label || ''}`}
        >
          <div className="form-grid">
            {/* Chọn bữa ăn */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 4 }}>
              {MEALS.map((m) => {
                const active = slot === m.slot
                return (
                  <button
                    key={m.slot}
                    type="button"
                    onClick={() => setSlot(m.slot)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: active ? `2px solid ${m.color}` : '1px solid var(--card-border)',
                      background: active ? m.bg : 'var(--card-bg)',
                      color: active ? m.color : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>

            <label style={{ position: 'relative' }}>
              <span>Tên món ăn</span>
              <div className="food-combobox-wrapper">
                <input
                  autoFocus
                  value={foodName}
                  onChange={(event) => {
                    setFoodName(event.target.value)
                    setShowFoodSuggestions(true)
                  }}
                  onFocus={() => setShowFoodSuggestions(true)}
                  placeholder="Gõ hoặc chọn món: Cơm tấm, Phở bò…"
                  autoComplete="off"
                />

                {/* Combobox Gợi ý món ăn & tự fill giá tiền */}
                {showFoodSuggestions && (
                  <div className="food-suggestions-dropdown" onMouseDown={(e) => e.preventDefault()}>
                    {filteredSuggestions.length > 0 ? (
                      filteredSuggestions.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          className="food-suggestion-item"
                          onClick={() => {
                            setFoodName(item.name)
                            if (item.price > 0) setFoodPrice(String(item.price))
                            setShowFoodSuggestions(false)
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>🍲 {item.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="food-suggestion-price">{item.price ? money(item.price) : '0đ'}</span>
                            <span
                              className="food-suggestion-delete"
                              title="Xoá món này khỏi gợi ý"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeRememberedFood(item.name)
                              }}
                            >
                              <Trash2 size={12} />
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: '8px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Nhập món mới &quot;{foodName}&quot; tuỳ thích
                      </div>
                    )}
                  </div>
                )}
              </div>
            </label>

            <label>
              Chi phí
              <input
                value={foodPrice}
                onChange={(event) => setFoodPrice(event.target.value)}
                placeholder="Ví dụ: 35k hoặc 35000"
                inputMode="numeric"
                onFocus={() => setShowFoodSuggestions(false)}
              />
            </label>

            <label>
              Giờ ăn
              <input
                type="time"
                value={foodLogTime}
                onChange={(event) => setFoodLogTime(event.target.value)}
                onFocus={() => setShowFoodSuggestions(false)}
              />
            </label>

            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={handleSaveFood}
              style={{ background: '#10b981', borderRadius: 10, padding: '10px 16px', fontWeight: 700 }}
            >
              {busy ? 'Đang lưu…' : 'Lưu món ăn'}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL GHI GIẤC NGỦ CHUẨN ĐẦY ĐỦ */}
      {sleepModal && (
        <Modal
          onClose={() => setSleepModal(false)}
          title="Ghi giấc ngủ & Giấc mơ"
        >
          <div className="form-grid" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
              <ClockTimeInput label="Ngủ từ" value={sleepStart} onChange={setSleepStart} size={140} />
              <ClockTimeInput label="Đến" value={sleepEnd} onChange={setSleepEnd} size={140} />
            </div>

            <div style={{ textAlign: 'center', color: '#6366f1', fontWeight: 800, fontSize: '0.88rem' }}>
              {duration(sleepDuration({ sleep_start: sleepStart, sleep_end: sleepEnd, log_date: dateKey }))}
              {sleepEnd <= sleepStart && (
                <small style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>
                  Qua đêm — giờ chia cho {dateKey} và ngày hôm sau
                </small>
              )}
            </div>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>💭 Nằm mơ thấy gì?</span>
              <textarea
                value={dream}
                onChange={(event) => setDream(event.target.value)}
                placeholder="Kể lại giấc mơ nếu bạn nhớ được…"
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  padding: '8px 10px',
                  fontSize: '0.84rem',
                  resize: 'vertical',
                }}
              />
            </label>

            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={handleSaveSleep}
              style={{ padding: '10px 14px', background: '#6366f1', borderRadius: 10, fontWeight: 700 }}
            >
              {busy ? 'Đang lưu…' : 'Lưu giấc ngủ'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
