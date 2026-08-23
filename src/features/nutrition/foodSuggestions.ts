import { useEffect, useState } from 'react'
import type { NutritionLog } from './periodData'

export interface RememberedFood {
  name: string
  price: number
  lastUsed?: string
  count?: number
}

const STORAGE_KEY = 'daily_remembered_foods'
const EVENT_NAME = 'daily_remembered_foods_updated'

// Một số món ăn mặc định phổ biến để người dùng dùng được ngay
const DEFAULT_SUGGESTIONS: RememberedFood[] = [
  { name: 'Cơm tấm sườn bì chả', price: 40000, count: 5 },
  { name: 'Cơm trưa văn phòng', price: 35000, count: 4 },
  { name: 'Phở bò', price: 45000, count: 4 },
  { name: 'Bún bò Huế', price: 45000, count: 3 },
  { name: 'Bánh mì thịt', price: 20000, count: 5 },
  { name: 'Hủ tiếu Nam Vang', price: 40000, count: 3 },
  { name: 'Bún chả', price: 40000, count: 2 },
  { name: 'Cà phê sữa đá', price: 20000, count: 5 },
  { name: 'Trà sữa', price: 35000, count: 3 },
  { name: 'Xôi mặn', price: 20000, count: 3 },
]

export function getRememberedFoods(): RememberedFood[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SUGGESTIONS))
      return DEFAULT_SUGGESTIONS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : DEFAULT_SUGGESTIONS
  } catch (err) {
    console.error('Failed to get remembered foods:', err)
    return DEFAULT_SUGGESTIONS
  }
}

import { supabase } from '../../lib/supabase'

export function saveRememberedFood(name: string, price: number) {
  const cleanName = name.trim()
  if (!cleanName) return

  const current = getRememberedFoods()
  const existingIndex = current.findIndex(
    (item) => item.name.toLowerCase() === cleanName.toLowerCase()
  )

  const now = new Date().toISOString()
  let targetCount = 1

  if (existingIndex >= 0) {
    targetCount = (current[existingIndex].count || 1) + 1
    current[existingIndex] = {
      ...current[existingIndex],
      name: cleanName, // Giữ chữ hoa chữ thường chuẩn nhất
      price: price > 0 ? price : current[existingIndex].price,
      lastUsed: now,
      count: targetCount,
    }
  } else {
    current.unshift({
      name: cleanName,
      price: price || 0,
      lastUsed: now,
      count: 1,
    })
  }

  // Sắp xếp ưu tiên món dùng nhiều nhất / gần đây nhất
  current.sort((a, b) => {
    const countDiff = (b.count || 1) - (a.count || 1)
    if (countDiff !== 0) return countDiff
    return new Date(b.lastUsed || 0).getTime() - new Date(a.lastUsed || 0).getTime()
  })

  // Lưu tối đa 100 món
  const trimmed = current.slice(0, 100)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))

    // Đồng bộ lên Supabase ngầm
    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        const userId = data?.user?.id || null
        const foodId = cleanName.toLowerCase()
        return supabase!.from('food_suggestions').upsert({
          id: foodId,
          user_id: userId,
          name: cleanName,
          price: price || 0,
          count: targetCount,
          last_used_at: now,
        }, { onConflict: 'id' })
      }).catch(() => null)
    }
  } catch (err) {
    console.error('Failed to save remembered food:', err)
  }
}

export function removeRememberedFood(name: string) {
  const cleanName = name.toLowerCase().trim()
  const current = getRememberedFoods()
  const filtered = current.filter(
    (item) => item.name.toLowerCase() !== cleanName
  )
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))

    if (supabase) {
      void supabase.from('food_suggestions').delete().eq('id', cleanName).catch(() => null)
    }
  } catch (err) {
    console.error('Failed to remove remembered food:', err)
  }
}

export function syncRememberedFoodsFromLogs(logs: NutritionLog[]) {
  if (!logs || logs.length === 0) return
  const current = getRememberedFoods()
  const map = new Map<string, RememberedFood>()

  for (const item of current) {
    map.set(item.name.toLowerCase(), { ...item })
  }

  for (const log of logs) {
    if (!log.food_name || !log.food_name.trim()) continue
    const key = log.food_name.trim().toLowerCase()
    if (map.has(key)) {
      const exist = map.get(key)!
      if (log.price && log.price > 0) exist.price = log.price
      exist.count = (exist.count || 1) + 1
    } else {
      map.set(key, {
        name: log.food_name.trim(),
        price: log.price || 0,
        lastUsed: log.log_date,
        count: 1,
      })
    }
  }

  const result = Array.from(map.values())
  result.sort((a, b) => (b.count || 1) - (a.count || 1))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result.slice(0, 100)))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {}
}

export function useRememberedFoods(): RememberedFood[] {
  const [foods, setFoods] = useState<RememberedFood[]>(() => getRememberedFoods())

  useEffect(() => {
    let cancelled = false

    const loadRemote = async () => {
      if (!supabase) return
      try {
        const { data, error } = await supabase
          .from('food_suggestions')
          .select('*')
          .order('count', { ascending: false })
          .limit(100)

        if (!error && data && data.length > 0 && !cancelled) {
          const map = new Map<string, RememberedFood>()
          // 1. Món mặc định & local
          for (const item of getRememberedFoods()) {
            map.set(item.name.toLowerCase(), item)
          }
          // 2. Món từ Supabase
          for (const row of data) {
            const key = (row.name || '').toLowerCase()
            if (!key) continue
            map.set(key, {
              name: row.name,
              price: Number(row.price) || 0,
              count: row.count || 1,
              lastUsed: row.last_used_at || undefined,
            })
          }
          const merged = Array.from(map.values()).sort((a, b) => (b.count || 1) - (a.count || 1))
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, 100)))
          setFoods(merged.slice(0, 100))
        }
      } catch {}
    }

    void loadRemote()

    const handleUpdate = () => {
      setFoods(getRememberedFoods())
    }
    window.addEventListener(EVENT_NAME, handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      cancelled = true
      window.removeEventListener(EVENT_NAME, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return foods
}
