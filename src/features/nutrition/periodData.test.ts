import { describe, expect, it } from 'vitest'
import {
  aggregateSleepByDate,
  filterFoodLogs,
  getPeriodRange,
  groupLogsByDate,
  summarizeFood,
  summarizeSleep,
  type NutritionLog,
  type SleepLog,
} from './periodData'

const foodLogs: NutritionLog[] = [
  { id: '1', meal_slot: 'MORNING', food_name: 'Phở', price: 40_000, log_date: '2026-08-10', log_time: '07:00' },
  { id: '2', meal_slot: 'LUNCH', food_name: 'Cơm', price: 55_000, log_date: '2026-08-10', log_time: '12:00' },
  { id: '3', meal_slot: 'LUNCH', food_name: 'Bún', price: 45_000, log_date: '2026-08-12', log_time: '11:30' },
  { id: '4', meal_slot: 'EVENING', food_name: 'Cháo', price: 30_000, log_date: '2026-08-12', log_time: '19:00' },
]

const sleepLogs: SleepLog[] = [
  { id: 's1', sleep_start: '22:00', sleep_end: '02:00', log_date: '2026-08-10', duration_minutes: 240 },
  { id: 's2', sleep_start: '02:30', sleep_end: '06:30', log_date: '2026-08-10', duration_minutes: 240 },
  { id: 's3', sleep_start: '23:00', sleep_end: '05:00', log_date: '2026-08-12', duration_minutes: 360 },
]

describe('getPeriodRange', () => {
  it('returns seven days ending on the anchor for week mode', () => {
    expect(getPeriodRange('2026-08-12', 'week')).toEqual({
      start: '2026-08-06',
      end: '2026-08-12',
      days: ['2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12'],
    })
  })

  it('returns the full selected calendar month', () => {
    const range = getPeriodRange('2026-02-15', 'month')
    expect(range.start).toBe('2026-02-01')
    expect(range.end).toBe('2026-02-28')
    expect(range.days).toHaveLength(28)
  })
})

describe('food period aggregation', () => {
  it('filters exactly one meal slot', () => {
    expect(filterFoodLogs(foodLogs, 'LUNCH').map((log) => log.id)).toEqual(['2', '3'])
  })

  it('summarizes filtered logs across all calendar days', () => {
    expect(summarizeFood(filterFoodLogs(foodLogs, 'LUNCH'), ['2026-08-10', '2026-08-11', '2026-08-12'])).toEqual({
      total: 100_000,
      averagePerDay: 33_333,
      itemCount: 2,
      byDate: { '2026-08-10': 55_000, '2026-08-11': 0, '2026-08-12': 45_000 },
    })
  })

  it('groups newest dates first', () => {
    expect(groupLogsByDate(foodLogs).map(([date]) => date)).toEqual(['2026-08-12', '2026-08-10'])
  })
})

describe('sleep period aggregation', () => {
  it('aggregates multiple sleeps on the same date for charting', () => {
    expect(aggregateSleepByDate(sleepLogs, ['2026-08-10', '2026-08-11', '2026-08-12'])).toEqual({
      '2026-08-10': 480,
      '2026-08-11': 0,
      '2026-08-12': 360,
    })
  })

  it('averages by recorded date and counts dates meeting 7h30', () => {
    expect(summarizeSleep(sleepLogs)).toEqual({
      totalMinutes: 840,
      averagePerNight: 420,
      recordedNights: 2,
      targetNights: 1,
    })
  })
})
