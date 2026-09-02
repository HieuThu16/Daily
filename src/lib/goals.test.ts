import { beforeEach, describe, expect, it } from 'vitest'
import {
  addGoal,
  calculateAscensionProgress,
  deleteGoal,
  getStoredGoals,
  saveGoals,
  toggleGoalMilestone,
  INITIAL_SAMPLE_GOALS,
} from './goals'
import type { GoalItem } from '../types'

describe('goals library module', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('trả về danh sách mẫu khi chưa có dữ liệu', () => {
    const goals = getStoredGoals()
    expect(goals.length).toBeGreaterThan(0)
    expect(goals[0].title).toBe(INITIAL_SAMPLE_GOALS[0].title)
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
        unit: 'bước',
        status: 'NOT_STARTED',
        altitude_meters: 5000,
        created_at: new Date().toISOString(),
        milestones: [],
      },
    ]

    const progress = calculateAscensionProgress(goals)
    expect(progress.currentAltitude).toBe(5000)
    expect(progress.percent).toBe(50)
    expect(progress.completedGoalsCount).toBe(1)
    expect(progress.totalGoalsCount).toBe(2)
    expect(progress.tierName).toBe('Tầng Đỉnh Núi Mây Mù')
  })
})
