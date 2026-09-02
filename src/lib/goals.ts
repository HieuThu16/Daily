import { useEffect, useState, useCallback } from 'react'
import type { GoalItem } from '../types'
import { getRemoteAppSetting, saveAppSetting } from './userAppSettings'

const STORAGE_KEY = 'daily_life_goals'
const EVENT_NAME = 'daily_life_goals_changed'

export const INITIAL_SAMPLE_GOALS: GoalItem[] = [
  {
    id: 'goal_sample_1',
    title: 'Đọc 20 cuốn sách tinh hoa & phát triển bản thân',
    description: 'Nâng cao tư duy, mở rộng nhân sinh quan và tích lũy tri thức mỗi tuần.',
    category: 'GROWTH',
    category_label: 'Phát triển bản thân',
    target_date: '2026-12-31',
    current_value: 6,
    target_value: 20,
    unit: 'cuốn sách',
    altitude_meters: 2200,
    color: '#38bdf8',
    icon: '📚',
    status: 'IN_PROGRESS',
    created_at: new Date().toISOString(),
    milestones: [
      { id: 'm1', title: 'Hoàn thành 5 cuốn sách đầu tiên (Xây dựng thói quen)', completed: true, completed_at: new Date().toISOString() },
      { id: 'm2', title: 'Đọc 10 cuốn sách về tư duy tài chính & tâm lý', completed: false },
      { id: 'm3', title: 'Đọc 15 cuốn sách & ghi chép nhật ký bài học', completed: false },
      { id: 'm4', title: 'Chạm mốc 20 cuốn sách & tổng kết năm', completed: false },
    ],
  },
  {
    id: 'goal_sample_2',
    title: 'Chạy bộ 300km & Chinh phục cự ly 21km Half-Marathon',
    description: 'Rèn luyện sức bền, sự kiên trì và kỷ luật thép qua từng bước chân.',
    category: 'HEALTH',
    category_label: 'Sức khỏe & Thể chất',
    target_date: '2026-10-30',
    current_value: 120,
    target_value: 300,
    unit: 'km',
    altitude_meters: 3500,
    color: '#34d399',
    icon: '🏃',
    status: 'IN_PROGRESS',
    created_at: new Date().toISOString(),
    milestones: [
      { id: 'm1', title: 'Chạy liên tục 5km không nghỉ', completed: true, completed_at: new Date().toISOString() },
      { id: 'm2', title: 'Chinh phục cự ly 10km đường dài', completed: true, completed_at: new Date().toISOString() },
      { id: 'm3', title: 'Hoàn thành bài chạy thử 15km', completed: false },
      { id: 'm4', title: 'Chạy đủ 21.1km Half-Marathon về đích', completed: false },
    ],
  },
  {
    id: 'goal_sample_3',
    title: 'Xây dựng Quỹ Tự Do Tài Chính 100 Triệu',
    description: 'Tạo lập nền tảng an tâm tài chính và dòng tiền đầu tư dài hạn.',
    category: 'WEALTH',
    category_label: 'Tài chính & Thịnh vượng',
    target_date: '2026-12-31',
    current_value: 45,
    target_value: 100,
    unit: 'triệu VNĐ',
    altitude_meters: 5000,
    color: '#fbbf24',
    icon: '💎',
    status: 'IN_PROGRESS',
    created_at: new Date().toISOString(),
    milestones: [
      { id: 'm1', title: 'Tích lũy 25 triệu quỹ khẩn cấp đầu tiên', completed: true, completed_at: new Date().toISOString() },
      { id: 'm2', title: 'Đạt mốc 50 triệu & mở tài khoản tích lũy sinh lời', completed: false },
      { id: 'm3', title: 'Đạt mốc 75 triệu', completed: false },
      { id: 'm4', title: 'Chạm mốc 100 triệu tròn vẹn', completed: false },
    ],
  },
  {
    id: 'goal_sample_4',
    title: 'Giao tiếp Tiếng Anh tự tin & Học 1000 từ vựng cốt lõi',
    description: 'Làm chủ ngôn ngữ toàn cầu, sẵn sàng kết nối và làm việc quốc tế.',
    category: 'GROWTH',
    category_label: 'Ngôn ngữ & Kiến thức',
    target_date: '2026-11-15',
    current_value: 450,
    target_value: 1000,
    unit: 'từ vựng',
    altitude_meters: 4200,
    color: '#818cf8',
    icon: '🌍',
    status: 'IN_PROGRESS',
    created_at: new Date().toISOString(),
    milestones: [
      { id: 'm1', title: 'Học chắc 300 từ vựng thông dụng nhất', completed: true, completed_at: new Date().toISOString() },
      { id: 'm2', title: 'Luyện phản xạ nghe nói hằng ngày 30 ngày liên tục', completed: false },
      { id: 'm3', title: 'Hoàn thành 700 từ vựng và xem phim không cần sub', completed: false },
      { id: 'm4', title: 'Chinh phục 1000 từ vựng & tự tin trò chuyện', completed: false },
    ],
  },
]

/**
 * Đọc danh sách mục tiêu từ LocalStorage
 */
export function getStoredGoals(): GoalItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_SAMPLE_GOALS
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    return INITIAL_SAMPLE_GOALS
  } catch (err) {
    console.warn('Lỗi đọc danh sách mục tiêu:', err)
    return INITIAL_SAMPLE_GOALS
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
 * Thêm mục tiêu mới
 */
export async function addGoal(input: Omit<GoalItem, 'id' | 'created_at'>): Promise<GoalItem> {
  const current = getStoredGoals()
  const newGoal: GoalItem = {
    ...input,
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  }
  const updated = [newGoal, ...current]
  await saveGoals(updated)
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
      if (merged.current_value >= merged.target_value && merged.status !== 'COMPLETED') {
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
      const newMilestones = g.milestones.map((m) => {
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

      // Cập nhật giá trị tiến độ tỉ lệ theo milestone nếu có
      let nextValue = g.current_value
      if (totalMilestones > 0) {
        nextValue = Math.round((completedCount / totalMilestones) * g.target_value)
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
 * Xóa một mục tiêu
 */
export async function deleteGoal(id: string): Promise<void> {
  const current = getStoredGoals()
  const filtered = current.filter((g) => g.id !== id)
  await saveGoals(filtered)
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
      tierName: 'Mặt đất yên bình',
      tierDescription: 'Bắt đầu hành trình đặt những viên gạch đầu tiên vươn tới trời cao.',
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
    const progressFraction = g.target_value > 0 ? Math.min(1, Math.max(0, g.current_value / g.target_value)) : 0
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

  const reload = useCallback(() => {
    setGoals(getStoredGoals())
  }, [])

  useEffect(() => {
    let alive = true
    void getRemoteAppSetting<GoalItem[]>(STORAGE_KEY, INITIAL_SAMPLE_GOALS).then((remote) => {
      if (alive && Array.isArray(remote) && remote.length > 0) {
        setGoals(remote)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remote))
        } catch {}
      }
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
    addGoal,
    updateGoal,
    toggleMilestone: toggleGoalMilestone,
    deleteGoal,
    reload,
  }
}
