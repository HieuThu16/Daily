import { useEffect, useState, useCallback } from 'react'
import type { GoalItem, GoalMilestone } from '../types'
import { getRemoteAppSetting, saveAppSetting } from './userAppSettings'
import { supabase } from './supabase'

const STORAGE_KEY = 'daily_life_goals'
const EVENT_NAME = 'daily_life_goals_changed'

/**
 * Đọc danh sách mục tiêu từ LocalStorage
 */
export function getStoredGoals(): GoalItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return []
  } catch (err) {
    console.warn('Lỗi đọc danh sách mục tiêu:', err)
    return []
  }
}

/**
 * Ghi danh sách mục tiêu vào LocalStorage và đồng bộ Supabase
 */
export async function saveGoals(goals: GoalItem[]): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: goals }))
  } catch (err) {
    console.warn('Lỗi lưu LocalStorage mục tiêu:', err)
  }
  try {
    await saveAppSetting(STORAGE_KEY, goals)
  } catch (err) {
    console.warn('Lỗi đồng bộ mục tiêu lên Supabase:', err)
  }
}

/**
 * Thêm mục tiêu mới và đồng bộ sang bảng goals của Supabase
 */
export async function addGoal(input: Omit<GoalItem, 'id' | 'created_at'>): Promise<GoalItem> {
  const current = getStoredGoals()
  const newId = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const newGoal: GoalItem = {
    ...input,
    id: newId,
    created_at: new Date().toISOString(),
  }
  const updated = [newGoal, ...current]
  await saveGoals(updated)

  // Đồng bộ bảng goals của Supabase để liên kết khóa ngoại với tasks/todos
  if (supabase) {
    try {
      await supabase.from('goals').insert({
        id: newGoal.id,
        name: newGoal.title,
        note: newGoal.description || null,
        due_date: newGoal.target_date || null,
      })
    } catch (e) {
      console.warn('Đồng bộ sang bảng goals thất bại:', e)
    }
  }

  return newGoal
}

/**
 * Cập nhật một mục tiêu
 */
export async function updateGoal(id: string, updates: Partial<GoalItem>): Promise<GoalItem | null> {
  const current = getStoredGoals()
  let targetGoal: GoalItem | null = null
  const updated = current.map((g) => {
    if (g.id === id) {
      const merged = { ...g, ...updates }
      // Tự động kiểm tra trạng thái hoàn thành
      if ((merged.current_value ?? 0) >= (merged.target_value ?? 1) && merged.status !== 'COMPLETED') {
        merged.status = 'COMPLETED'
        merged.completed_at = new Date().toISOString()
      }
      targetGoal = merged
      return merged
    }
    return g
  })

  if (targetGoal) {
    await saveGoals(updated)

    if (supabase) {
      try {
        const payload: Record<string, unknown> = {}
        if (updates.title) payload.name = updates.title
        if (updates.description !== undefined) payload.note = updates.description
        if (updates.target_date !== undefined) payload.due_date = updates.target_date
        if (Object.keys(payload).length > 0) {
          await supabase.from('goals').update(payload).eq('id', id)
        }
      } catch (e) {
        console.warn('Cập nhật bảng goals thất bại:', e)
      }
    }
  }

  return targetGoal
}

/**
 * Bật/tắt trạng thái hoàn thành của 1 nấc thang nhỏ trong mục tiêu
 */
export async function toggleGoalMilestone(goalId: string, milestoneId: string): Promise<GoalItem | null> {
  const current = getStoredGoals()
  let targetGoal: GoalItem | null = null

  const updated = current.map((g) => {
    if (g.id === goalId) {
      const newMilestones = (g.milestones || []).map((m) => {
        if (m.id === milestoneId) {
          const nextCompleted = !m.completed
          return {
            ...m,
            completed: nextCompleted,
            completed_at: nextCompleted ? new Date().toISOString() : null,
          }
        }
        return m
      })

      const completedCount = newMilestones.filter((m) => m.completed).length
      const totalMilestones = newMilestones.length

      let nextValue = g.current_value ?? 0
      if (totalMilestones > 0) {
        nextValue = Math.round((completedCount / totalMilestones) * (g.target_value ?? 10))
      }

      const isAllDone = totalMilestones > 0 && completedCount === totalMilestones
      const nextStatus: GoalItem['status'] = isAllDone ? 'COMPLETED' : (completedCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED')

      const merged: GoalItem = {
        ...g,
        milestones: newMilestones,
        current_value: nextValue,
        status: nextStatus,
        completed_at: isAllDone ? (g.completed_at || new Date().toISOString()) : null,
      }
      targetGoal = merged
      return merged
    }
    return g
  })

  if (targetGoal) {
    await saveGoals(updated)
  }
  return targetGoal
}

/**
 * Thêm milestone trực tiếp vào mục tiêu
 */
export async function addGoalMilestone(goalId: string, title: string): Promise<GoalItem | null> {
  const current = getStoredGoals()
  let targetGoal: GoalItem | null = null

  const updated = current.map((g) => {
    if (g.id === goalId) {
      const newM: GoalMilestone = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: title.trim(),
        completed: false,
      }
      const newMilestones = [...(g.milestones || []), newM]
      const merged: GoalItem = {
        ...g,
        milestones: newMilestones,
      }
      targetGoal = merged
      return merged
    }
    return g
  })

  if (targetGoal) {
    await saveGoals(updated)
  }
  return targetGoal
}

/**
 * Xóa một mục tiêu khỏi hệ thống
 */
export async function deleteGoal(id: string): Promise<void> {
  const current = getStoredGoals()
  const updated = current.filter((g) => g.id !== id)
  await saveGoals(updated)

  if (supabase) {
    try {
      const now = new Date().toISOString()
      await supabase.from('goals').update({ deleted_at: now }).eq('id', id)
      await supabase.from('todos').update({ goal_id: null }).eq('goal_id', id)
    } catch (e) {
      console.warn('Xóa mục tiêu trong database thất bại:', e)
    }
  }
}

/**
 * Tính toán độ cao leo trời hiện tại và danh hiệu tầng mây
 */
export function calculateAscensionProgress(goals: GoalItem[]): {
  currentAltitude: number
  targetAltitude: number
  percent: number
  tierName: string
  tierDescription: string
  tierIcon: string
  completedGoalsCount: number
  totalGoalsCount: number
} {
  if (goals.length === 0) {
    return {
      currentAltitude: 0,
      targetAltitude: 10000,
      percent: 0,
      tierName: 'Mặt Đất Yên Bình',
      tierDescription: 'Hãy đặt viên gạch mục tiêu đầu tiên để bắt đầu hành trình vút bay lên trời cao.',
      tierIcon: '🌱',
      completedGoalsCount: 0,
      totalGoalsCount: 0,
    }
  }

  let totalWeightedAltitude = 0
  let achievedAltitude = 0
  let completedCount = 0

  goals.forEach((g) => {
    const goalAltitude = g.altitude_meters || 1000
    totalWeightedAltitude += goalAltitude
    const curVal = g.current_value ?? 0
    const targetVal = g.target_value ?? 10
    const progressFraction = targetVal > 0 ? Math.min(1, Math.max(0, curVal / targetVal)) : 0
    achievedAltitude += goalAltitude * progressFraction
    if (g.status === 'COMPLETED' || progressFraction >= 1) {
      completedCount++
    }
  })

  const percent = totalWeightedAltitude > 0 ? Math.min(100, Math.round((achievedAltitude / totalWeightedAltitude) * 100)) : 0
  const curAlt = Math.round(achievedAltitude)

  // Xác định danh hiệu tầng trời tương ứng với độ cao
  let tierName = 'Tầng Mặt Đất & Gió Nhẹ'
  let tierDescription = 'Những bước chạy đà kiên định đầu tiên.'
  let tierIcon = '🌾'

  if (percent >= 100) {
    tierName = 'Tầng Thiên Giới & Bầu Trời Bất Tận'
    tierDescription = 'Đỉnh cao ước mơ! Chạm tới bầu trời sao lấp lánh và tự do tuyệt đối.'
    tierIcon = '👑'
  } else if (percent >= 80) {
    tierName = 'Tầng Bầu Trời Sao & Cực Quang'
    tierDescription = 'Vượt qua tầng mây dày, không gian lung linh rạng ngời ánh hào quang.'
    tierIcon = '🌌'
  } else if (percent >= 55) {
    tierName = 'Tầng Mây Bồng Bềnh (Biển Mây Trắng)'
    tierDescription = 'Đang lướt giữa đại dương mây trắng tinh khôi, nhìn ngắm chân trời rực rỡ.'
    tierIcon = '☁️'
  } else if (percent >= 30) {
    tierName = 'Tầng Đỉnh Núi Mây Mù'
    tierDescription = 'Vượt qua sườn dốc, chạm đến những dải sương mây đầu tiên.'
    tierIcon = '🏔️'
  } else if (percent > 0) {
    tierName = 'Tầng Khởi Hành Vút Bay'
    tierDescription = 'Khinh khí cầu và đôi cánh ước mơ bắt đầu cất cánh lên không trung.'
    tierIcon = '🎈'
  }

  return {
    currentAltitude: curAlt,
    targetAltitude: Math.max(totalWeightedAltitude, 10000),
    percent,
    tierName,
    tierDescription,
    tierIcon,
    completedGoalsCount: completedCount,
    totalGoalsCount: goals.length,
  }
}

/**
 * React hook quản lý mục tiêu và tự động cập nhật
 */
export function useGoals() {
  const [goals, setGoals] = useState<GoalItem[]>(() => getStoredGoals())
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setGoals(getStoredGoals())
  }, [])

  useEffect(() => {
    let alive = true
    void getRemoteAppSetting<GoalItem[]>(STORAGE_KEY, []).then((remote) => {
      if (alive) {
        setLoading(false)
        if (Array.isArray(remote)) {
          setGoals(remote)
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remote))
          } catch {}
        }
      }
    }).catch(() => {
      if (alive) setLoading(false)
    })

    const handleUpdate = () => {
      reload()
    }

    window.addEventListener(EVENT_NAME, handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      alive = false
      window.removeEventListener(EVENT_NAME, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [reload])

  return {
    goals,
    loading,
    addGoal,
    updateGoal,
    toggleMilestone: toggleGoalMilestone,
    addMilestone: addGoalMilestone,
    deleteGoal,
    reload,
  }
}
