import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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

const CLIENT_PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.drgns.space',
  'https://api.piped.privacydev.net',
  'https://pipedapi.tokhmi.xyz',
  'https://piped-api.lunar.icu',
]

const CLIENT_COBALT_INSTANCES = [
  'https://co.wuk.sh/api/json',
  'https://api.cobalt.tools/api/json',
  'https://cobalt.api.kwiatekm.me/api/json',
]

/**
 * Tải thông tin audio URL từ chuỗi API chuẩn y hệt tính năng Nhạc:
 * 1. Supabase Edge Function 'youtube-to-mp3' (Lưu MP3 chuẩn vĩnh viễn)
 * 2. Vercel Serverless Function '/api/youtube-audio' (Innertube / Piped / Cobalt / Vevioz)
 * 3. Client Piped Instances
 * 4. Client Cobalt Instances
 * 5. Proxy Stream URL fallback
 */
export async function fetchYoutubeAudioInfo(videoId: string): Promise<{
  audioUrl: string
  proxyUrl: string
  title?: string
  uploader?: string
  duration?: number
  mimeType?: string
  source?: string
}> {
  const cleanVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!cleanVideoId) {
    throw new Error('Video ID không hợp lệ')
  }

  // 1. Thử gọi Supabase Edge Function 'youtube-to-mp3' (API chuẩn của Nhạc)
  if (supabase?.functions?.invoke) {
    try {
      const invokePromise = supabase.functions.invoke('youtube-to-mp3', {
        body: { youtubeUrl: `https://www.youtube.com/watch?v=${cleanVideoId}` },
      })
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Edge function timeout')), 4000))
      const res: any = await Promise.race([invokePromise, timeoutPromise])
      if (!res.error && res.data?.audioUrl) {
        return {
          audioUrl: res.data.audioUrl,
          proxyUrl: res.data.audioUrl,
          mimeType: 'audio/mpeg',
          source: 'supabase-mp3',
        }
      }
    } catch (e) {
      console.warn('[youtube-to-mp3 edge function failed, falling back to serverless]', e)
    }
  }

  // 2. Thử gọi API Serverless Vercel (/api/youtube-audio)
  try {
    const res = await fetch(`/api/youtube-audio?videoId=${encodeURIComponent(cleanVideoId)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.audioUrl) {
        return {
          audioUrl: data.audioUrl,
          proxyUrl: data.proxyUrl || data.audioUrl,
          title: data.title,
          uploader: data.uploader,
          duration: data.duration,
          mimeType: data.mimeType || 'audio/mp4',
          source: data.source || 'serverless',
        }
      }
    }
  } catch {}

  // 3. Client-side fallback: Gọi trực tiếp Piped API từ trình duyệt
  for (const piped of CLIENT_PIPED_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${piped}/streams/${encodeURIComponent(cleanVideoId)}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) {
        const data = await res.json()
        const audioStreams = (data.audioStreams || []).sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
        const best = audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4') || s.format === 'M4A') || audioStreams[0]
        if (best?.url) {
          return {
            audioUrl: best.url,
            proxyUrl: best.url,
            title: data.title,
            uploader: data.uploader,
            duration: data.duration,
            mimeType: best.mimeType || 'audio/mp4',
            source: 'piped',
          }
        }
      }
    } catch {}
  }

  // 4. Client-side fallback: Cobalt API
  for (const cobaltUrl of CLIENT_COBALT_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4500)
      const cobaltRes = await fetch(cobaltUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${cleanVideoId}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
        }),
      })
      clearTimeout(timeout)
      if (cobaltRes.ok) {
        const cData = await cobaltRes.json()
        if (cData?.url) {
          return {
            audioUrl: cData.url,
            proxyUrl: cData.url,
            mimeType: 'audio/mpeg',
            source: 'cobalt',
          }
        }
      }
    } catch {}
  }

  // 5. Fallback cuối cùng: Proxy Stream Vercel Endpoint
  return {
    audioUrl: `/api/youtube-audio?videoId=${encodeURIComponent(cleanVideoId)}&stream=true`,
    proxyUrl: `/api/youtube-audio?videoId=${encodeURIComponent(cleanVideoId)}&stream=true`,
    mimeType: 'audio/mp4',
    source: 'proxy-stream',
  }
}

/**
 * Biến video YouTube thành Audio và phát ngay trong Audio Player toàn hệ thống
 * (Không sử dụng phát nền video mini player iframe).
 */
export async function playYoutubeAsAudio(
  video: {
    videoId: string
    title: string
    channelName?: string | null
    thumbnail?: string | null
    duration?: number | null
  },
  audioPlayer: { playTrack: (track: any, queue?: any[]) => void },
  callbacks?: {
    onStart?: () => void
    onProgress?: (pct: number) => void
    showToast?: (msg: string, type?: 'info' | 'success' | 'delete') => void
  }
): Promise<boolean> {
  callbacks?.onStart?.()
  callbacks?.showToast?.('⏳ Đang chuyển video thành Audio...', 'info')

  try {
    // 1. Nếu đã có file offline trong máy -> phát ngay lập tức
    const offlineUrl = await getOfflineAudioPlayUrl(video.videoId)
    if (offlineUrl) {
      audioPlayer.playTrack({
        id: `yt-${video.videoId}`,
        type: 'MUSIC',
        name: video.title,
        audio_url: offlineUrl,
        cover_url: video.thumbnail || undefined,
        artist: video.channelName || 'YouTube Audio',
        status: 'IN_PROGRESS',
        is_favorite: false,
        description: null,
      })
      callbacks?.showToast?.('🎧 Đang phát Audio offline!')
      return true
    }

    callbacks?.onProgress?.(30)
    // 2. Chuyển đổi YouTube sang Audio qua API
    const info = await fetchYoutubeAudioInfo(video.videoId)
    callbacks?.onProgress?.(80)

    const playUrl = info.proxyUrl || info.audioUrl
    if (!playUrl) {
      throw new Error('Không lấy được link stream audio')
    }

    // 3. Phát ngay trong Trình phát nhạc toàn hệ thống (HTML5 Audio tag)
    audioPlayer.playTrack({
      id: `yt-${video.videoId}`,
      type: 'MUSIC',
      name: video.title || info.title || 'YouTube Audio',
      audio_url: playUrl,
      cover_url: video.thumbnail || undefined,
      artist: video.channelName || info.uploader || 'YouTube Audio',
      status: 'IN_PROGRESS',
      is_favorite: false,
      description: null,
    })
    callbacks?.onProgress?.(100)
    callbacks?.showToast?.('🎧 Đang phát Audio (hỗ trợ tắt màn hình & chạy ngầm)!', 'success')

    // 4. Lưu nền vào bộ nhớ máy nếu hỗ trợ (không chặn phát nhạc)
    void downloadAndSaveYoutubeAudio(video.videoId, {
      title: video.title,
      channelName: video.channelName || undefined,
      thumbnail: video.thumbnail || undefined,
      durationSeconds: video.duration || undefined,
    }).catch(() => {
      // Lưu ngầm không thành công vẫn phát trực tiếp bình thường
    })

    return true
  } catch (err: any) {
    console.error('[playYoutubeAsAudio error]:', err)
    callbacks?.showToast?.(
      '⚠️ Không thể chuyển video này thành audio. Hãy thử video khác hoặc kiểm tra kết nối mạng.',
      'delete'
    )
    return false
  }
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
  let audioRes = await fetch(downloadUrl).catch(async () => {
    // Nếu proxyUrl bị chặn CORS, thử tải trực tiếp audioUrl
    return await fetch(info.audioUrl).catch(() => null)
  })
  if (!audioRes || !audioRes.ok) {
    // Fallback sang endpoint proxy serverless
    audioRes = await fetch(`/api/youtube-audio?videoId=${encodeURIComponent(videoId)}&stream=true`).catch(() => null)
  }
  if (!audioRes || !audioRes.ok) throw new Error('Không thể tải file audio từ server')

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
