import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatAudioBytes,
  getOfflineAudiosList,
  getOfflineAudioItem,
  fetchYoutubeAudioInfo,
  playYoutubeAsAudio,
} from './youtubeAudioCache'

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('not configured') }),
    },
  },
}))

describe('youtubeAudioCache unit tests', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('formatAudioBytes formats sizes accurately', () => {
    expect(formatAudioBytes(0)).toBe('0 MB')
    expect(formatAudioBytes(500 * 1024)).toBe('500 KB')
    expect(formatAudioBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatAudioBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB')
  })

  it('getOfflineAudiosList and getOfflineAudioItem return correctly from localStorage', () => {
    expect(getOfflineAudiosList()).toEqual([])
    expect(getOfflineAudioItem('test1234567')).toBeNull()

    const mockItem = {
      videoId: 'test1234567',
      title: 'Bài nhạc thử nghiệm',
      fileName: 'test1234567.mp4',
      sizeBytes: 1048576,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('daily_youtube_offline_audios', JSON.stringify([mockItem]))

    expect(getOfflineAudiosList()).toHaveLength(1)
    expect(getOfflineAudioItem('test1234567')?.title).toBe('Bài nhạc thử nghiệm')
  })

  it('fetchYoutubeAudioInfo returns audio stream from serverless API', async () => {
    const mockData = {
      success: true,
      audioUrl: 'https://rr2---sn-4g5ednss.googlevideo.com/videoplayback?itag=140',
      proxyUrl: '/api/youtube-audio?videoId=dQw4w9WgXcQ&stream=true',
      title: 'Never Gonna Give You Up',
      uploader: 'Rick Astley',
      duration: 213,
      mimeType: 'audio/mp4',
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as any)

    const res = await fetchYoutubeAudioInfo('dQw4w9WgXcQ')
    expect(res.audioUrl).toBe(mockData.audioUrl)
    expect(res.title).toBe('Never Gonna Give You Up')
  })

  it('playYoutubeAsAudio plays track in global audioPlayer without using video mini player', async () => {
    const mockData = {
      success: true,
      audioUrl: 'https://stream.audio/sample.mp3',
      proxyUrl: '/api/youtube-audio?videoId=sample12345&stream=true',
      title: 'Bài hát mẫu',
      uploader: 'Kênh Ca Nhạc',
      duration: 180,
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockData,
      blob: async () => new Blob(['dummy audio content']),
      headers: new Headers({ 'content-length': '1024' }),
    } as any)

    const playedTracks: any[] = []
    const mockAudioPlayer = {
      playTrack: (track: any) => {
        playedTracks.push(track)
      },
    }

    const toastMsgs: string[] = []
    const mockToast = (msg: string) => {
      toastMsgs.push(msg)
    }

    const ok = await playYoutubeAsAudio(
      {
        videoId: 'sample12345',
        title: 'Bài hát mẫu',
        channelName: 'Kênh Ca Nhạc',
        thumbnail: 'https://img.youtube.com/vi/sample12345/hqdefault.jpg',
        duration: 180,
      },
      mockAudioPlayer,
      { showToast: mockToast }
    )

    expect(ok).toBe(true)
    expect(playedTracks).toHaveLength(1)
    expect(playedTracks[0].id).toBe('yt-sample12345')
    expect(playedTracks[0].type).toBe('MUSIC')
    expect(playedTracks[0].name).toBe('Bài hát mẫu')
    expect(playedTracks[0].artist).toBe('Kênh Ca Nhạc')
    expect(playedTracks[0].audio_url).toBe(mockData.proxyUrl)
  })

  it('deleteOfflineAudio removes audio item and updates localStorage', async () => {
    const { deleteOfflineAudio } = await import('./youtubeAudioCache')
    const mockItem = {
      videoId: 'delete123',
      title: 'Xóa bài này',
      fileName: 'delete123.mp4',
      sizeBytes: 2048,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('daily_youtube_offline_audios', JSON.stringify([mockItem]))
    expect(getOfflineAudiosList()).toHaveLength(1)

    await deleteOfflineAudio('delete123')
    expect(getOfflineAudiosList()).toHaveLength(0)
  })

  it('playYoutubeAsAudio calls onProgress with percentage and status text', async () => {
    const mockData = {
      success: true,
      audioUrl: 'https://stream.audio/sample2.mp3',
      proxyUrl: '/api/youtube-audio?videoId=sample999&stream=true',
      title: 'Bài hát tiến độ',
      uploader: 'Kênh Test',
      duration: 120,
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockData,
      blob: async () => new Blob(['dummy audio content']),
      headers: new Headers({ 'content-length': '1024' }),
    } as any)

    const progressUpdates: { pct: number; text?: string }[] = []
    const mockAudioPlayer = { playTrack: vi.fn() }

    await playYoutubeAsAudio(
      {
        videoId: 'sample999',
        title: 'Bài hát tiến độ',
      },
      mockAudioPlayer,
      {
        onProgress: (pct, text) => {
          progressUpdates.push({ pct, text })
        },
      }
    )

    expect(progressUpdates.length).toBeGreaterThanOrEqual(3)
    expect(progressUpdates[0].pct).toBe(10)
    expect(progressUpdates[progressUpdates.length - 1].pct).toBe(100)
    expect(mockAudioPlayer.playTrack).toHaveBeenCalled()
  })
})
