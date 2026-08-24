import { useEffect } from 'react'
import { supabase } from './supabase'

export type VideoStatus = 'UNWATCHED' | 'IN_PROGRESS' | 'COMPLETED'
export type VideoSectionType = 'tvshow' | 'review'

export interface VideoStatusRecord {
  video_id: string
  type: VideoSectionType
  status: VideoStatus
  platform?: string
  series_key?: string | null
  title?: string
  channel_name?: string
  updated_at: string
}

const STORAGE_KEY = 'daily_video_statuses'
const STATUS_EVENT = 'daily_video_status_changed'

/**
 * Đọc toàn bộ bản ghi trạng thái video từ LocalStorage
 */
export function getStoredVideoStatuses(): Record<string, VideoStatusRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (err) {
    console.error('Failed to read video statuses from storage:', err)
    return {}
  }
}

/**
 * Lấy trạng thái hiện tại của một video
 */
export function getVideoStatus(
  videoId: string,
  type: VideoSectionType,
  watchedSet?: Set<string>
): VideoStatus {
  if (watchedSet && watchedSet.has(videoId)) {
    return 'COMPLETED'
  }
  const records = getStoredVideoStatuses()
  const key = `${type}:${videoId}`
  if (records[key]) {
    return records[key].status
  }
  return 'UNWATCHED'
}

/**
 * Lấy sets trạng thái theo loại (tvshow hoặc review)
 */
export function getVideoStatusSets(
  type: VideoSectionType,
  supabaseWatchedIds: Set<string> = new Set()
): {
  watchedSet: Set<string>
  inProgressSet: Set<string>
  statusMap: Map<string, VideoStatus>
} {
  const records = getStoredVideoStatuses()
  const watchedSet = new Set<string>(supabaseWatchedIds)
  const inProgressSet = new Set<string>()
  const statusMap = new Map<string, VideoStatus>()

  // 1. Thêm tất cả ID từ Supabase watched vào watchedSet
  for (const id of supabaseWatchedIds) {
    watchedSet.add(id)
    statusMap.set(id, 'COMPLETED')
  }

  // 2. Thêm các bản ghi từ local storage
  for (const record of Object.values(records)) {
    if (record && record.type === type) {
      if (record.status === 'COMPLETED') {
        watchedSet.add(record.video_id)
        inProgressSet.delete(record.video_id)
        statusMap.set(record.video_id, 'COMPLETED')
      } else if (record.status === 'IN_PROGRESS') {
        // Chỉ coi là in-progress nếu chưa được đánh dấu là completed
        if (!watchedSet.has(record.video_id)) {
          inProgressSet.add(record.video_id)
          statusMap.set(record.video_id, 'IN_PROGRESS')
        }
      } else if (record.status === 'UNWATCHED') {
        watchedSet.delete(record.video_id)
        inProgressSet.delete(record.video_id)
        statusMap.set(record.video_id, 'UNWATCHED')
      }
    }
  }

  return { watchedSet, inProgressSet, statusMap }
}

/**
 * Cập nhật trạng thái xem cho video và đồng bộ Supabase + LocalStorage
 */
export async function setVideoStatus(
  videoId: string,
  type: VideoSectionType,
  status: VideoStatus,
  meta?: {
    platform?: string
    series_key?: string | null
    title?: string
    channel_name?: string
  }
): Promise<void> {
  const records = getStoredVideoStatuses()
  const key = `${type}:${videoId}`
  const now = new Date().toISOString()
  const platform = meta?.platform || 'youtube'

  if (status === 'UNWATCHED') {
    delete records[key]
  } else {
    records[key] = {
      video_id: videoId,
      type,
      status,
      platform,
      series_key: meta?.series_key ?? null,
      title: meta?.title,
      channel_name: meta?.channel_name,
      updated_at: now,
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch (err) {
    console.error('Failed to save video status to storage:', err)
  }

  // Phát event thông báo UI cập nhật tức thì
  window.dispatchEvent(
    new CustomEvent(STATUS_EVENT, {
      detail: { videoId, type, status },
    })
  )

  // Đồng bộ với bảng Supabase (review_watched hoặc tvshow_watched)
  const watchedTable = type === 'review' ? 'review_watched' : 'tvshow_watched'

  try {
    if (status === 'COMPLETED') {
      await supabase?.from(watchedTable).upsert({
        platform,
        video_id: videoId,
        series_key: meta?.series_key ?? null,
        watched_at: now,
      })
    } else if (status === 'IN_PROGRESS') {
      // Khi đang xem, xoá khỏi watched nếu đã từng xem xong
      await supabase?.from(watchedTable).delete().eq('platform', platform).eq('video_id', videoId)
    } else if (status === 'UNWATCHED') {
      await supabase?.from(watchedTable).delete().eq('platform', platform).eq('video_id', videoId)
    }
  } catch (err) {
    console.warn('Supabase watched sync error (non-fatal):', err)
  }
}

/**
 * Chuyển trạng thái kế tiếp theo chu kỳ: UNWATCHED -> IN_PROGRESS -> COMPLETED -> UNWATCHED
 */
export async function cycleNextVideoStatus(
  videoId: string,
  type: VideoSectionType,
  currentStatus: VideoStatus,
  meta?: {
    platform?: string
    series_key?: string | null
    title?: string
    channel_name?: string
  }
): Promise<VideoStatus> {
  let nextStatus: VideoStatus
  if (currentStatus === 'UNWATCHED') {
    nextStatus = 'IN_PROGRESS'
  } else if (currentStatus === 'IN_PROGRESS') {
    nextStatus = 'COMPLETED'
  } else {
    nextStatus = 'UNWATCHED'
  }

  await setVideoStatus(videoId, type, nextStatus, meta)
  return nextStatus
}

/**
 * Tự động chuyển sang trạng thái "Đang xem" khi người dùng bắt đầu mở video
 */
export async function autoMarkVideoWatching(
  videoId: string,
  type: VideoSectionType,
  watchedSet?: Set<string>,
  meta?: {
    platform?: string
    series_key?: string | null
    title?: string
    channel_name?: string
  }
): Promise<void> {
  const currentStatus = getVideoStatus(videoId, type, watchedSet)
  if (currentStatus === 'UNWATCHED') {
    await setVideoStatus(videoId, type, 'IN_PROGRESS', meta)
  }
}

/**
 * Hook lắng nghe thay đổi trạng thái video trong component
 */
export function useVideoStatusListener(callback: () => void) {
  useEffect(() => {
    const handler = () => callback()
    window.addEventListener(STATUS_EVENT, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(STATUS_EVENT, handler)
      window.removeEventListener('storage', handler)
    }
  }, [callback])
}
