import { beforeEach, describe, expect, it } from 'vitest'
import {
  addGoal,
  calculateAscensionProgress,
  deleteGoal,
  getStoredGoals,
  saveGoals,
  toggleGoalMilestone,
  addGoalMilestone,
} from './goals'
import type { GoalItem } from '../types'

describe('goals library module', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('trả về danh sách rỗng khi chưa có dữ liệu (không set cứng)', () => {
    const goals = getStoredGoals()
    expect(goals).toEqual([])
  })

  it('thêm mục tiêu mới thành công', async () => {
    const newGoal = await addGoal({
      title: 'Học lập trình Rust',
      category: 'GROWTH',
      target_value: 10,
      current_value: 0,
      unit: 'dự án',
      status: 'NOT_STARTED',
      altitude_meters: 2000,
      milestones: [{ id: 'm1', title: 'Hoàn thành Rust Book', completed: false }],
    })

    const all = getStoredGoals()
    expect(all.some((g) => g.id === newGoal.id)).toBe(true)
    expect(all[0].title).toBe('Học lập trình Rust')
  })

  it('toggle milestone cập nhật tiến độ tự động', async () => {
    const goal: GoalItem = {
      id: 'g_test_1',
      title: 'Tập thể hình',
      category: 'HEALTH',
      current_value: 0,
      target_value: 100,
      unit: 'ngày',
      status: 'NOT_STARTED',
      altitude_meters: 1000,
      created_at: new Date().toISOString(),
      milestones: [
        { id: 'm1', title: 'Tập tuần 1', completed: false },
        { id: 'm2', title: 'Tập tuần 2', completed: false },
      ],
    }
    await saveGoals([goal])

    const updated = await toggleGoalMilestone('g_test_1', 'm1')
    expect(updated?.milestones[0].completed).toBe(true)
    expect(updated?.current_value).toBe(50) // 1/2 milestones = 50%
    expect(updated?.status).toBe('IN_PROGRESS')

    const completed = await toggleGoalMilestone('g_test_1', 'm2')
    expect(completed?.milestones[1].completed).toBe(true)
    expect(completed?.current_value).toBe(100)
    expect(completed?.status).toBe('COMPLETED')
  })

  it('thêm milestone vào mục tiêu', async () => {
    const goal: GoalItem = {
      id: 'g_add_m',
      title: 'Học ngoại ngữ',
      category: 'GROWTH',
      current_value: 0,
      target_value: 10,
      unit: 'bài',
      status: 'NOT_STARTED',
      altitude_meters: 1500,
      created_at: new Date().toISOString(),
      milestones: [],
    }
    await saveGoals([goal])

    const updated = await addGoalMilestone('g_add_m', 'Học bảng chữ cái')
    expect(updated?.milestones.length).toBe(1)
    expect(updated?.milestones[0].title).toBe('Học bảng chữ cái')
  })

  it('xóa mục tiêu khỏi danh sách', async () => {
    const goal: GoalItem = {
      id: 'g_del_1',
      title: 'Mục tiêu tạm',
      category: 'GROWTH',
      current_value: 0,
      target_value: 1,
      unit: 'lần',
      status: 'NOT_STARTED',
      altitude_meters: 500,
      created_at: new Date().toISOString(),
      milestones: [],
    }
    await saveGoals([goal])
    expect(getStoredGoals().some((g) => g.id === 'g_del_1')).toBe(true)

    await deleteGoal('g_del_1')
    expect(getStoredGoals().some((g) => g.id === 'g_del_1')).toBe(false)
  })

  it('tính toán đúng độ cao leo trời và danh hiệu tầng mây', () => {
    const goals: GoalItem[] = [
      {
        id: 'g1',
        title: 'Mục tiêu 1',
        category: 'GROWTH',
        current_value: 10,
        target_value: 10,
        unit: 'bước',
        status: 'COMPLETED',
        altitude_meters: 5000,
        created_at: new Date().toISOString(),
        milestones: [],
      },
      {
        id: 'g2',
        title: 'Mục tiêu 2',
        category: 'HEALTH',
        current_value: 0,
        target_value: 10,
        unit: 'km',
        status: 'NOT_STARTED',
        altitude_meters: 5000,
        created_at: new Date().toISOString(),
        milestones: [],
      },
    ]

    const stats = calculateAscensionProgress(goals)
    expect(stats.currentAltitude).toBe(5000)
    expect(stats.targetAltitude).toBe(10000)
    expect(stats.percent).toBe(50)
    expect(stats.completedGoalsCount).toBe(1)
    expect(stats.totalGoalsCount).toBe(2)
  })
})
