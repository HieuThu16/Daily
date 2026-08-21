import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  autoMarkVideoWatching,
  cycleNextVideoStatus,
  getStoredVideoStatuses,
  getVideoStatus,
  getVideoStatusSets,
  setVideoStatus,
  type VideoStatus
} from './videoStatus'

describe('videoStatus logic', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lấy trạng thái rỗng khi chưa có dữ liệu trong localStorage', () => {
    const statuses = getStoredVideoStatuses()
    expect(statuses).toEqual({})
  })

  it('tính toán đúng statusSets từ Supabase watched và localStorage in_progress', () => {
    // Giả sử v1 đã xem (COMPLETED), v2 đang xem (IN_PROGRESS), v3 chưa xem (UNWATCHED)
    const supabaseWatched = new Set(['v1'])
    
    // Lưu v2 là IN_PROGRESS trong localStorage
    localStorage.setItem(
      'daily_video_statuses',
      JSON.stringify({
        'tvshow:v2': {
          video_id: 'v2',
          type: 'tvshow',
          status: 'IN_PROGRESS',
          updated_at: new Date().toISOString(),
        },
      })
    )

    const sets = getVideoStatusSets('tvshow', supabaseWatched)
    expect(sets.watchedSet.has('v1')).toBe(true)
    expect(sets.inProgressSet.has('v2')).toBe(true)
    expect(sets.statusMap.get('v1')).toBe('COMPLETED')
    expect(sets.statusMap.get('v2')).toBe('IN_PROGRESS')
    expect(sets.statusMap.get('v3')).toBeUndefined()
  })

  it('setVideoStatus cập nhật đúng localStorage và dispatch event', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    await setVideoStatus('vid123', 'tvshow', 'IN_PROGRESS', {
      title: 'Tập 1',
      channel_name: 'Kênh Test',
    })

    const local = getStoredVideoStatuses()
    expect(local['tvshow:vid123']).toBeDefined()
    expect(local['tvshow:vid123'].status).toBe('IN_PROGRESS')
    expect(local['tvshow:vid123'].title).toBe('Tập 1')
    expect(dispatchSpy).toHaveBeenCalled()
  })

  it('cycleNextVideoStatus chuyển chu kỳ UNWATCHED -> IN_PROGRESS -> COMPLETED -> UNWATCHED', async () => {
    const s1 = await cycleNextVideoStatus('v_cycle', 'review', 'UNWATCHED')
    expect(s1).toBe('IN_PROGRESS')

    const s2 = await cycleNextVideoStatus('v_cycle', 'review', 'IN_PROGRESS')
    expect(s2).toBe('COMPLETED')

    const s3 = await cycleNextVideoStatus('v_cycle', 'review', 'COMPLETED')
    expect(s3).toBe('UNWATCHED')
  })

  it('autoMarkVideoWatching chỉ chuyển sang IN_PROGRESS nếu video chưa hoàn thành (COMPLETED)', async () => {
    // Khi chưa xem
    const watchedSet = new Set<string>()
    await autoMarkVideoWatching('v_auto', 'tvshow', watchedSet)

    const local = getStoredVideoStatuses()
    expect(local['tvshow:v_auto']?.status).toBe('IN_PROGRESS')

    // Khi đã hoàn thành trong watchedSet, không đổi về IN_PROGRESS
    watchedSet.add('v_auto_done')
    await autoMarkVideoWatching('v_auto_done', 'tvshow', watchedSet)
    const localAfter = getStoredVideoStatuses()
    expect(localAfter['tvshow:v_auto_done']).toBeUndefined()
  })
})
