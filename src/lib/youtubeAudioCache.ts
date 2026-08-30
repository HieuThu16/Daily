import { useState, useEffect } from 'react'

const AUDIO_META_KEY = 'daily_youtube_offline_audios'
const AUDIO_EVENT_NAME = 'daily_youtube_offline_audios_changed'
const DIR_NAME = 'youtube_audios'

export type OfflineAudioItem = {
  videoId: string
  title: string
  channelName?: string
  thumbnail?: string
  fileName: string
  sizeBytes: number
  durationSeconds?: number
  savedAt: string
}

export function formatAudioBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const mb = bytes / 1048576
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export function getOfflineAudiosList(): OfflineAudioItem[] {
  try {
    const raw = localStorage.getItem(AUDIO_META_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function getOfflineAudioItem(videoId: string): OfflineAudioItem | null {
  const list = getOfflineAudiosList()
  return list.find((a) => a.videoId === videoId) || null
}

function writeAudioMeta(list: OfflineAudioItem[]) {
  try {
    localStorage.setItem(AUDIO_META_KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('[youtubeAudioCache] Không ghi được meta:', err)
  }
  window.dispatchEvent(new CustomEvent(AUDIO_EVENT_NAME))
}

function isOPFSSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
}

async function getAudiosDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOPFSSupported()) return null
  try {
    const root = await navigator.storage.getDirectory()
    return await root.getDirectoryHandle(DIR_NAME, { create: true })
  } catch {
    return null
  }
}

/** Tải thông tin audio URL từ backend API */
export async function fetchYoutubeAudioInfo(videoId: string): Promise<{
  audioUrl: string
  proxyUrl: string
  title?: string
  uploader?: string
  duration?: number
  mimeType?: string
}> {
  const res = await fetch(`/api/youtube-audio?videoId=${encodeURIComponent(videoId)}`)
  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.error || `Không lấy được audio từ YouTube (Mã ${res.status})`)
  }
  const data = await res.json()
  if (!data.success || !data.audioUrl) {
    throw new Error(data.error || 'Không tìm thấy đường link audio')
  }
  return data
}

/**
 * Tải audio từ YouTube về máy và lưu vào bộ nhớ OPFS / Cache
 */
export async function downloadAndSaveYoutubeAudio(
  videoId: string,
  meta: { title: string; channelName?: string; thumbnail?: string; durationSeconds?: number },
  onProgress?: (percent: number) => void
): Promise<OfflineAudioItem> {
  onProgress?.(10)
  const info = await fetchYoutubeAudioInfo(videoId)
  onProgress?.(30)

  // Tải stream audio về dạng blob
  const downloadUrl = info.proxyUrl || info.audioUrl
  const audioRes = await fetch(downloadUrl)
  if (!audioRes.ok) throw new Error('Không thể tải file audio từ server')

  const total = Number(audioRes.headers.get('content-length')) || 0
  let blob: Blob

  if (audioRes.body && total > 0 && typeof ReadableStream !== 'undefined') {
    const reader = audioRes.body.getReader()
    let received = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.length
        onProgress?.(30 + Math.round((received / total) * 60))
      }
    }
    blob = new Blob(chunks as any, { type: info.mimeType || 'audio/mp4' })
  } else {
    blob = await audioRes.blob()
  }
  onProgress?.(95)

  const fileName = `${videoId}.mp4`
  const dir = await getAudiosDir()

  if (dir) {
    const fileHandle = await dir.getFileHandle(fileName, { create: true })
    // @ts-ignore
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
  } else {
    // Fallback Cache API
    if (typeof caches !== 'undefined') {
      const cache = await caches.open('youtube_audio_blobs')
      await cache.put(`/offline_audio/${videoId}`, new Response(blob))
    }
  }

  const item: OfflineAudioItem = {
    videoId,
    title: meta.title || info.title || 'YouTube Audio',
    channelName: meta.channelName || info.uploader,
    thumbnail: meta.thumbnail,
    fileName,
    sizeBytes: blob.size,
    durationSeconds: meta.durationSeconds || info.duration,
    savedAt: new Date().toISOString(),
  }

  const existing = getOfflineAudiosList().filter((a) => a.videoId !== videoId)
  writeAudioMeta([item, ...existing])
  onProgress?.(100)
  return item
}

/** Lấy Object URL của audio đã lưu để phát */
export async function getOfflineAudioPlayUrl(videoId: string): Promise<string | null> {
  const item = getOfflineAudioItem(videoId)
  if (!item) return null

  const dir = await getAudiosDir()
  if (dir) {
    try {
      const fileHandle = await dir.getFileHandle(item.fileName)
      const file = await fileHandle.getFile()
      return URL.createObjectURL(file)
    } catch {}
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('youtube_audio_blobs')
      const match = await cache.match(`/offline_audio/${videoId}`)
      if (match) {
        const blob = await match.blob()
        return URL.createObjectURL(blob)
      }
    } catch {}
  }

  return null
}

/** Xóa audio khỏi máy để giải phóng dung lượng */
export async function deleteOfflineAudio(videoId: string): Promise<void> {
  const item = getOfflineAudioItem(videoId)
  if (!item) return

  const dir = await getAudiosDir()
  if (dir) {
    try {
      await dir.removeEntry(item.fileName)
    } catch {}
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('youtube_audio_blobs')
      await cache.delete(`/offline_audio/${videoId}`)
    } catch {}
  }

  const list = getOfflineAudiosList().filter((a) => a.videoId !== videoId)
  writeAudioMeta(list)
}

/** React hook theo dõi trạng thái audio của video */
export function useOfflineAudioState(videoId: string) {
  const [item, setItem] = useState<OfflineAudioItem | null>(() => getOfflineAudioItem(videoId))

  useEffect(() => {
    setItem(getOfflineAudioItem(videoId))

    const handler = () => {
      setItem(getOfflineAudioItem(videoId))
    }

    window.addEventListener(AUDIO_EVENT_NAME, handler)
    return () => window.removeEventListener(AUDIO_EVENT_NAME, handler)
  }, [videoId])

  return {
    isSaved: Boolean(item),
    audioItem: item,
    sizeLabel: item ? formatAudioBytes(item.sizeBytes) : null,
  }
}
