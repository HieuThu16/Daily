import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { useToast } from './ToastContext'
import { Modal } from './shared'
import { FoodPeriodView, PeriodSelector } from './nutrition/NutritionPeriodViews'
import {
  getPeriodRange,
  shiftPeriodAnchor,
  type MealFilter,
  type MealSlot,
  type NutritionLog,
  type PeriodMode,
} from './nutrition/periodData'
import {
  useRememberedFoods,
  saveRememberedFood,
  removeRememberedFood,
} from './nutrition/foodSuggestions'
import { SkeletonList } from './Skeleton'

const MEALS: { slot: MealSlot; label: string; emoji: string; color: string; bg: string }[] = [
  { slot: 'MORNING', label: 'Sáng', emoji: '🌅', color: '#f59e0b', bg: 'rgba(245,185,11,.10)' },
  { slot: 'LUNCH', label: 'Trưa', emoji: '☀️', color: '#10b981', bg: 'rgba(16,185,129,.10)' },
  { slot: 'AFTERNOON', label: 'Chiều', emoji: '🌤️', color: '#f97316', bg: 'rgba(249,115,22,.10)' },
  { slot: 'EVENING', label: 'Tối', emoji: '🌙', color: '#6366f1', bg: 'rgba(99,102,241,.10)' },
]

function money(price: number) {
  return `${new Intl.NumberFormat('vi-VN').format(price)}đ`
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
  const [currentDate, setCurrentDate] = useState(localDate())
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day')
  const [logs, setLogs] = useState<NutritionLog[]>([])
  const [periodFoodLogs, setPeriodFoodLogs] = useState<NutritionLog[]>([])
  const [mealFilter, setMealFilter] = useState<MealFilter>('ALL')
  const [loading, setLoading] = useState(true)

  const [foodModal, setFoodModal] = useState(false)
  const [editingFood, setEditingFood] = useState<NutritionLog | null>(null)
  const [activeMeal, setActiveMeal] = useState<MealSlot>('MORNING')
  const [foodName, setFoodName] = useState('')
  const [foodPrice, setFoodPrice] = useState('')
  const [foodLogTime, setFoodLogTime] = useState(() => new Date().toTimeString().slice(0, 5))
  const [showFoodSuggestions, setShowFoodSuggestions] = useState(false)

  const rememberedFoods = useRememberedFoods()

  const filteredSuggestions = useMemo(() => {
    const q = foodName.trim().toLowerCase()
    if (!q) return rememberedFoods.slice(0, 10)
    return rememberedFoods
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 10)
  }, [rememberedFoods, foodName])

  const periodRange = useMemo(() => getPeriodRange(currentDate, periodMode), [currentDate, periodMode])

  useEffect(() => {
    let active = true
    async function fetchActiveData() {
      setLoading(true)
      try {
        if (periodMode === 'day') {
          const { data, error } = await supabase!
            .from('nutrition_logs')
            .select('*')
            .eq('log_date', currentDate)
            .is('deleted_at', null)
            .order('created_at')
          if (error) throw error
          if (!active) return
          setLogs((data ?? []) as NutritionLog[])
        } else {
          const { data, error } = await supabase!
            .from('nutrition_logs')
            .select('*')
            .gte('log_date', periodRange.start)
            .lte('log_date', periodRange.end)
            .is('deleted_at', null)
            .order('log_date', { ascending: false })
            .order('created_at')
          if (error) throw error
          if (!active) return
          setPeriodFoodLogs((data ?? []) as NutritionLog[])
        }
      } catch (err) {
        console.warn('Lỗi tải dữ liệu ăn uống:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchActiveData()
    return () => {
      active = false
    }
  }, [currentDate, periodMode, periodRange.start, periodRange.end])

  const groupedFood = useMemo(() => {
    const map: Record<MealSlot, NutritionLog[]> = { MORNING: [], LUNCH: [], AFTERNOON: [], EVENING: [] }
    for (const item of logs) {
      if (map[item.meal_slot]) {
        map[item.meal_slot].push(item)
      }
    }
    return map
  }, [logs])

  function openAddFoodModal(slot: MealSlot) {
    setEditingFood(null)
    setActiveMeal(slot)
    setFoodName('')
    setFoodPrice('')
    setFoodLogTime(new Date().toTimeString().slice(0, 5))
    setShowFoodSuggestions(false)
    setFoodModal(true)
  }

  function openEditFoodModal(log: NutritionLog) {
    setEditingFood(log)
    setActiveMeal(log.meal_slot)
    setFoodName(log.food_name)
    setFoodPrice(String(log.price))
    setFoodLogTime(log.log_time || new Date().toTimeString().slice(0, 5))
    setShowFoodSuggestions(false)
    setFoodModal(true)
  }

  async function saveFood() {
    const name = foodName.trim()
    const rawPrice = foodPrice.replace(/[,.đ\s]/g, '').trim().toLowerCase()
    let parsedPrice = 0
    if (rawPrice.endsWith('k')) {
      parsedPrice = (parseFloat(rawPrice.slice(0, -1)) || 0) * 1000
    } else {
      parsedPrice = parseInt(rawPrice, 10) || 0
    }

    if (!name) {
      showToast('⚠️ Vui lòng nhập tên món ăn')
      return
    }

    saveRememberedFood(name, parsedPrice)

    const payload = {
      log_date: currentDate,
      meal_slot: activeMeal,
      food_name: name,
      price: parsedPrice,
      log_time: foodLogTime,
    }

    if (editingFood) {
      try {
        const { data } = await supabase!
          .from('nutrition_logs')
          .update(payload)
          .eq('id', editingFood.id)
          .select()
          .single()
        if (data) {
          setLogs((prev) => prev.map((item) => (item.id === editingFood.id ? (data as NutritionLog) : item)))
          setPeriodFoodLogs((prev) => prev.map((item) => (item.id === editingFood.id ? (data as NutritionLog) : item)))
        }
      } catch {}
    } else {
      try {
        const { data } = await supabase!.from('nutrition_logs').insert(payload).select().single()
        if (data) {
          setLogs((prev) => [...prev, data as NutritionLog])
          setPeriodFoodLogs((prev) => [...prev, data as NutritionLog])
        }
      } catch {}
    }

    setFoodModal(false)
    setEditingFood(null)
    setShowFoodSuggestions(false)
    showToast('🍲 Đã lưu món ăn')
  }

  async function deleteFood(id: string) {
    try {
      await supabase!.from('nutrition_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    } catch {}
    setLogs((current) => current.filter((log) => log.id !== id))
    setPeriodFoodLogs((current) => current.filter((log) => log.id !== id))
    showToast('🗑️ Đã xoá món ăn')
  }

  const totalFood = logs.reduce((sum, log) => sum + log.price, 0)

  return (
    <section className="page-shell is-narrow" style={{ display: 'grid', gap: 10 }}>
      {/* HEADER & PERIOD SELECTOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
          <UtensilsCrossed size={20} color="#10b981" />
          <span>Theo dõi ăn uống</span>
        </div>
        <PeriodSelector value={periodMode} onChange={setPeriodMode} />
      </div>

      {/* CHUYỂN NGÀY / KỲ */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="icon"
          aria-label="Khoảng trước"
          onClick={() => setCurrentDate(shiftPeriodAnchor(currentDate, periodMode, -1))}
        >
          ‹
        </button>
        <strong style={{ minWidth: 125, color: '#10b981', fontSize: '.78rem', textAlign: 'center' }}>
          {periodLabel(currentDate, periodMode)}
        </strong>
        <button
          type="button"
          className="icon"
          aria-label="Khoảng sau"
          onClick={() => setCurrentDate(shiftPeriodAnchor(currentDate, periodMode, 1))}
        >
          ›
        </button>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {periodMode === 'day' && (
            <>
              {/* Tổng chi hôm nay */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                }}
              >
                <div>
                  <small style={{ fontSize: '0.78rem', opacity: 0.9 }}>Tổng chi tiêu ăn uống hôm nay</small>
                  <strong style={{ display: 'block', fontSize: '1.35rem', marginTop: 2 }}>{money(totalFood)}</strong>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, opacity: 0.95 }}>
                  {logs.length} món
                </div>
              </div>

              {/* 4 Bữa ăn: Sáng, Trưa, Chiều, Tối */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                {MEALS.map((meal) => (
                  <button
                    key={meal.slot}
                    type="button"
                    aria-label={meal.label}
                    onClick={() => openAddFoodModal(meal.slot)}
                    style={{
                      display: 'grid',
                      justifyItems: 'center',
                      gap: 3,
                      padding: '10px 4px',
                      border: `1.5px solid ${meal.color}`,
                      borderRadius: 12,
                      background: meal.bg,
                      color: meal.color,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{meal.emoji}</span>
                    <strong style={{ fontSize: '.72rem' }}>{meal.label}</strong>
                    <small style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                      {money(groupedFood[meal.slot].reduce((sum, log) => sum + log.price, 0))}
                    </small>
                    <Plus size={12} />
                  </button>
                ))}
              </div>

              {/* Danh sách chi tiết các món trong từng bữa */}
              {MEALS.map((meal) =>
                groupedFood[meal.slot].length ? (
                  <div key={meal.slot} className="card" style={{ padding: 12, margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ color: meal.color, fontSize: '.84rem' }}>
                        {meal.emoji} Bữa {meal.label}
                      </strong>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: meal.color }}>
                        {money(groupedFood[meal.slot].reduce((sum, log) => sum + log.price, 0))}
                      </span>
                    </div>

                    {groupedFood[meal.slot].map((log) => (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 6,
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: meal.bg,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: '.82rem', color: 'var(--text-main)' }}>{log.food_name}</strong>
                          <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 1 }}>
                            {log.log_time || 'Chưa ghi giờ'}
                          </small>
                        </div>
                        <b style={{ color: meal.color, fontSize: '.8rem' }}>{money(log.price)}</b>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            aria-label={`Sửa ${log.food_name}`}
                            onClick={() => openEditFoodModal(log)}
                            style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Xóa ${log.food_name}`}
                            onClick={() => deleteFood(log.id)}
                            style={{ border: 0, background: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null,
              )}
            </>
          )}

          {periodMode !== 'day' && (
            <FoodPeriodView
              logs={periodFoodLogs}
              days={periodRange.days}
              mealFilter={mealFilter}
              onMealFilter={setMealFilter}
              onDelete={deleteFood}
              onEdit={openEditFoodModal}
            />
          )}
        </>
      )}

      {/* MODAL THÊM / SỬA MÓN ĂN */}
      {foodModal && (
        <Modal
          onClose={() => {
            setFoodModal(false)
            setEditingFood(null)
            setShowFoodSuggestions(false)
          }}
          title={
            editingFood
              ? `Sửa món bữa ${MEALS.find((meal) => meal.slot === activeMeal)?.label} (${editingFood.food_name})`
              : `Thêm món bữa ${MEALS.find((meal) => meal.slot === activeMeal)?.label}`
          }
        >
          <div className="form-grid">
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
                        Nhập món mới "{foodName}" tuỳ thích
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
              onClick={saveFood}
              style={{ background: '#10b981', borderRadius: 10, padding: '10px 16px', fontWeight: 700 }}
            >
              {editingFood ? 'Lưu thay đổi' : 'Lưu món ăn'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
