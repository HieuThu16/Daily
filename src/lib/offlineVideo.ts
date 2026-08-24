import { useCallback, useEffect, useState } from 'react'

/**
 * Kho video MP4 để ngoại tuyến, nằm trong OPFS (Origin Private File System)
 * của chính máy người dùng — không tốn dung lượng lẫn băng thông Supabase.
 *
 * File thật nằm trong OPFS, phần mô tả (tên, kênh, dung lượng…) nằm ở
 * localStorage cho nhẹ và đọc được ngay khi mở app.
 */

const META_KEY = 'daily_offline_videos'
const EVENT_NAME = 'daily_offline_videos_changed'
const DIR_NAME = 'videos'

export type OfflineVideo = {
  id: string
  fileName: string
  title: string
  channelName?: string
  /** Có khi tải từ một video YouTube đã lưu trong app. */
  videoId?: string
  sizeBytes: number
  durationSeconds?: number
  addedAt: string
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 MB'
  const mb = bytes / 1048576
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

/** Tên file an toàn cho OPFS: bỏ tên gốc, giữ đuôi. */
export function safeFileName(name: string, id: string): string {
  const ext = (name.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '.mp4').toLowerCase()
  return `${id}${ext}`
}

export function getOfflineVideos(): OfflineVideo[] {
  try {
    const raw = localStorage.getItem(META_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeMeta(list: OfflineVideo[]) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('[offlineVideo] không ghi được danh sách:', err)
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

/** Trình duyệt có cho lưu file thật không (iOS cũ và chế độ riêng tư thì không). */
export function offlineVideoSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
}

async function videosDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(DIR_NAME, { create: true })
}

/**
 * Xin trình duyệt giữ lại dữ liệu, đừng dọn khi máy hết chỗ.
 * Trả về true nếu được cấp — PWA đã cài thường được cấp thẳng.
 */
export async function keepStoragePersistent(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Còn bao nhiêu chỗ: {đã dùng, hạn mức} theo byte. */
export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  try {
    const est = await navigator.storage?.estimate?.()
    return { usage: est?.usage ?? 0, quota: est?.quota ?? 0 }
  } catch {
    return { usage: 0, quota: 0 }
  }
}

/** Chép một file MP4 vào kho ngoại tuyến. `onProgress` theo phần trăm. */
export async function saveOfflineVideo(
  file: File | Blob,
  meta: { title: string; channelName?: string; videoId?: string; fileName?: string; durationSeconds?: number },
  onProgress?: (percent: number) => void,
): Promise<OfflineVideo> {
  if (!offlineVideoSupported()) throw new Error('Trình duyệt này không cho lưu video vào máy.')

  const id = `ov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const fileName = safeFileName(meta.fileName ?? (file as File).name ?? 'video.mp4', id)

  const dir = await videosDir()
  const handle = await dir.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()

  // Ghi theo mẻ để thanh tiến độ nhích và không ngốn RAM với file lớn.
  const CHUNK = 4 * 1024 * 1024
  let written = 0
  try {
    while (written < file.size) {
      const slice = file.slice(written, Math.min(written + CHUNK, file.size))
      await writable.write(await slice.arrayBuffer())
      written += slice.size
      onProgress?.(Math.round((written / file.size) * 100))
    }
    await writable.close()
  } catch (err) {
    await (writable as any).abort?.()
    await dir.removeEntry(fileName).catch(() => {})
    throw err
  }

  const row: OfflineVideo = {
    id,
    fileName,
    title: meta.title,
    channelName: meta.channelName,
    videoId: meta.videoId,
    sizeBytes: file.size,
    durationSeconds: meta.durationSeconds,
    addedAt: new Date().toISOString(),
  }
  writeMeta([row, ...getOfflineVideos()])
  return row
}

/** URL blob để đưa vào thẻ <video>. Nhớ gọi URL.revokeObjectURL khi xong. */
export async function offlineVideoUrl(video: OfflineVideo): Promise<string> {
  const dir = await videosDir()
  const handle = await dir.getFileHandle(video.fileName)
  const file = await handle.getFile()
  return URL.createObjectURL(file)
}

export async function deleteOfflineVideo(id: string): Promise<void> {
  const list = getOfflineVideos()
  const found = list.find((v) => v.id === id)
  if (found) {
    try {
      const dir = await videosDir()
      await dir.removeEntry(found.fileName)
    } catch (err) {
      console.warn('[offlineVideo] không xoá được file:', err)
    }
  }
  writeMeta(list.filter((v) => v.id !== id))
}

export function useOfflineVideos(): { videos: OfflineVideo[]; refresh: () => void } {
  const [videos, setVideos] = useState<OfflineVideo[]>(() => getOfflineVideos())
  const refresh = useCallback(() => setVideos(getOfflineVideos()), [])

  useEffect(() => {
    window.addEventListener(EVENT_NAME, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(EVENT_NAME, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  return { videos, refresh }
}

/**
 * Đưa thẻ <video> vào khung nổi Picture-in-Picture.
 * File nằm cùng nguồn với app nên gọi thẳng được — khác hẳn iframe YouTube.
 */
export async function enterPictureInPicture(video: HTMLVideoElement): Promise<boolean> {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
      return false
    }
    if (!document.pictureInPictureEnabled || (video as any).disablePictureInPicture) return false
    await video.requestPictureInPicture()
    return true
  } catch (err) {
    console.warn('[offlineVideo] không mở được khung nổi:', err)
    return false
  }
}

/** Hiện tên video trên màn hình khoá / thanh thông báo và nhận nút tua. */
export function bindMediaSession(video: HTMLVideoElement, meta: OfflineVideo) {
  const ms = navigator.mediaSession
  if (!ms) return
  ms.metadata = new MediaMetadata({
    title: meta.title,
    artist: meta.channelName ?? 'Video ngoại tuyến',
  })
  ms.setActionHandler('play', () => void video.play())
  ms.setActionHandler('pause', () => video.pause())
  ms.setActionHandler('seekbackward', () => {
    video.currentTime = Math.max(0, video.currentTime - 10)
  })
  ms.setActionHandler('seekforward', () => {
    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10)
  })
}
