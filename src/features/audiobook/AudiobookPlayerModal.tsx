import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  Clock,
  ListMusic,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react'
import type { Audiobook, AudiobookTrack } from '../../types/audiobook'
import { updateAudiobookProgress, getAudiobookProgress } from '../../lib/audiobookProgress'
import { deleteAudiobook } from '../../lib/audiobookRepository'
import { formatDurationHuman } from '../../lib/dilibCrawler'
import { WatchTogetherButton } from '../watch/WatchTogetherButton'
import { useToast } from '../ToastContext'

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Chuyển đổi URL audio sang link phát được (nâng cấp HTTPS và hỗ trợ qua proxy) */
export function getPlayableAudioUrl(rawUrl: string, forceProxy: boolean = false): string {
  if (!rawUrl) return ''
  let u = rawUrl.trim()
  if (u.startsWith('http://')) {
    u = u.replace('http://', 'https://')
  }
  if (forceProxy || u.includes('dtv-ebook.com.vn') || u.includes('dilib.vn')) {
    return `/api/link-preview?audio=1&url=${encodeURIComponent(u)}`
  }
  return u
}

export function AudiobookPlayerModal({
  audiobook,
  initialTrackIndex = 0,
  isOpen,
  onClose,
  onDeleted,
}: {
  audiobook: Audiobook | null
  initialTrackIndex?: number
  isOpen: boolean
  onClose: () => void
  onDeleted?: (id: string) => void
}) {
  const { showToast } = useToast()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [currentTrackIndex, setCurrentTrackIndex] = useState(initialTrackIndex)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlaybackError, setHasPlaybackError] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null)
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [useProxyFallback, setUseProxyFallback] = useState(false)

  // Khôi phục tiến độ đã nghe từ trước
  useEffect(() => {
    if (!audiobook) return
    const saved = getAudiobookProgress(audiobook.id)
    if (saved) {
      if (saved.trackIndex >= 0 && saved.trackIndex < audiobook.tracks.length) {
        setCurrentTrackIndex(saved.trackIndex)
      }
      if (saved.currentSeconds > 0) {
        setCurrentTime(saved.currentSeconds)
      }
    } else {
      setCurrentTrackIndex(initialTrackIndex)
    }
  }, [audiobook, initialTrackIndex])

  const currentTrack: AudiobookTrack | undefined = audiobook?.tracks[currentTrackIndex]

  // Đổi track và nạp audio với cơ chế fallback thông minh
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return
    setUseProxyFallback(false)
    setHasPlaybackError(false)
    const playUrl = getPlayableAudioUrl(currentTrack.url, false)
    audioRef.current.src = playUrl
    audioRef.current.load()
    if (isPlaying) {
      void audioRef.current.play().catch(() => {
        // Tự động thử qua proxy nếu direct play bị chặn
        const proxyUrl = getPlayableAudioUrl(currentTrack.url, true)
        if (audioRef.current && audioRef.current.src !== proxyUrl) {
          audioRef.current.src = proxyUrl
          audioRef.current.load()
          void audioRef.current.play().catch(() => {
            setIsPlaying(false)
            setHasPlaybackError(true)
          })
        } else {
          setIsPlaying(false)
          setHasPlaybackError(true)
        }
      })
    }
  }, [currentTrack])

  // Xử lý lỗi phát audio: Tự động chuyển sang audio proxy
  const handleAudioError = () => {
    if (!currentTrack || useProxyFallback) {
      setHasPlaybackError(true)
      showToast('⚠️ Không thể tải file âm thanh này.', 'error')
      setIsPlaying(false)
      return
    }

    console.warn('[AudiobookPlayer] Direct play error, switching to /api/link-preview proxy...')
    setUseProxyFallback(true)
    const proxyUrl = getPlayableAudioUrl(currentTrack.url, true)
    if (audioRef.current) {
      audioRef.current.src = proxyUrl
      audioRef.current.load()
      if (isPlaying) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false)
            setHasPlaybackError(true)
          })
      }
    }
  }

  // Play / Pause
  const togglePlay = () => {
    if (!audioRef.current) return
    setHasPlaybackError(false)
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Lỗi phát audio trực tiếp:', err)
          // Thử lại qua proxy
          if (!useProxyFallback && currentTrack) {
            setUseProxyFallback(true)
            const proxyUrl = getPlayableAudioUrl(currentTrack.url, true)
            if (audioRef.current) {
              audioRef.current.src = proxyUrl
              audioRef.current.load()
              audioRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {
                  setIsPlaying(false)
                  setHasPlaybackError(true)
                  showToast('Không thể phát file âm thanh này.', 'error')
                })
            }
          } else {
            setIsPlaying(false)
            setHasPlaybackError(true)
            showToast('Không thể phát audio này.', 'info')
          }
        })
    }
  }

  // Chuyển bài trước / sau
  const handlePrevTrack = useCallback(() => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex((prev) => prev - 1)
      setIsPlaying(true)
    }
  }, [currentTrackIndex])

  const handleNextTrack = useCallback(() => {
    if (audiobook && currentTrackIndex < audiobook.tracks.length - 1) {
      setCurrentTrackIndex((prev) => prev + 1)
      setIsPlaying(true)
    }
  }, [audiobook, currentTrackIndex])

  // Tua tới / lui 15 giây
  const skip = useCallback(
    (seconds: number) => {
      if (!audioRef.current) return
      audioRef.current.currentTime = Math.max(0, Math.min(duration || 10000, audioRef.current.currentTime + seconds))
    },
    [duration]
  )

  // Cập nhật tiến độ liên tục và lưu Supabase
  const handleTimeUpdate = () => {
    if (!audioRef.current || !audiobook) return
    const cur = audioRef.current.currentTime
    const dur = audioRef.current.duration || 0
    setCurrentTime(cur)
    if (dur > 0) setDuration(dur)

    // Cập nhật trạng thái vị trí trên Media Session API (Background playback)
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && dur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, dur),
          playbackRate: playbackRate || 1,
          position: Math.min(Math.max(0, cur), dur),
        })
      } catch {}
    }

    // Lưu tiến độ định kỳ mỗi 5s hoặc khi kết thúc
    if (Math.floor(cur) % 5 === 0 && dur > 0) {
      void updateAudiobookProgress(audiobook.id, {
        trackIndex: currentTrackIndex,
        trackTitle: currentTrack?.title,
        currentSeconds: cur,
        durationSeconds: dur,
        bookTitle: audiobook.title,
        author: audiobook.author,
        coverUrl: audiobook.cover,
      })
    }
  }

  // Kết thúc track -> tự chuyển bài tiếp
  const handleEnded = () => {
    if (!audiobook) return
    // Đánh dấu hoàn thành track này
    void updateAudiobookProgress(audiobook.id, {
      trackIndex: currentTrackIndex,
      trackTitle: currentTrack?.title,
      currentSeconds: duration || 1,
      durationSeconds: duration || 1,
      bookTitle: audiobook.title,
      author: audiobook.author,
      coverUrl: audiobook.cover,
    })

    if (currentTrackIndex < audiobook.tracks.length - 1) {
      setCurrentTrackIndex((prev) => prev + 1)
      setIsPlaying(true)
    } else {
      setIsPlaying(false)
      showToast('🎉 Đã nghe xong toàn bộ sách nói này!')
    }
  }

  // Đổi tốc độ phát
  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate)
    if (audioRef.current) audioRef.current.playbackRate = rate
  }

  // TÍCH HỢP MEDIA SESSION API CHO PHÁT NỀN VÀ TẮT MÀN HÌNH (BACKGROUND AUDIO)
  useEffect(() => {
    if (!audiobook || !currentTrack || !('mediaSession' in navigator)) return

    const artworkList = audiobook.cover
      ? [
          { src: audiobook.cover, sizes: '96x96', type: 'image/png' },
          { src: audiobook.cover, sizes: '128x128', type: 'image/png' },
          { src: audiobook.cover, sizes: '256x256', type: 'image/png' },
          { src: audiobook.cover, sizes: '512x512', type: 'image/png' },
        ]
      : []

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || audiobook.title,
      artist: audiobook.author || 'Thư Viện Sách Nói',
      album: audiobook.title,
      artwork: artworkList,
    })

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play()
      setIsPlaying(true)
    })

    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause()
      setIsPlaying(false)
    })

    navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack)
    navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack)

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      skip(-(details.seekOffset || 15))
    })

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      skip(details.seekOffset || 15)
    })

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime
        setCurrentTime(details.seekTime)
      }
    })

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
        navigator.mediaSession.setActionHandler('seekto', null)
      }
    }
  }, [audiobook, currentTrack, isPlaying, handlePrevTrack, handleNextTrack, skip])

  // Hẹn giờ tắt (Sleep Timer)
  useEffect(() => {
    if (!sleepTimerMinutes) {
      setSleepTimerRemaining(null)
      return
    }

    let remaining = sleepTimerMinutes * 60
    setSleepTimerRemaining(remaining)

    const interval = setInterval(() => {
      remaining -= 1
      setSleepTimerRemaining(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        audioRef.current?.pause()
        setIsPlaying(false)
        setSleepTimerMinutes(null)
        showToast('💤 Đã đến giờ tắt audio hẹn trước.')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [sleepTimerMinutes, showToast])

  if (!isOpen || !audiobook) return null

  const displayTotalDuration =
    audiobook.durationFormatted ||
    (audiobook.totalDuration ? formatDurationHuman(audiobook.totalDuration) : null)

  return (
    <div className="audiobook-player-overlay" onClick={onClose}>
      <div className="audiobook-player-modal" onClick={(e) => e.stopPropagation()}>
        {/* Hidden HTML5 Audio Element */}
        <audio
          ref={audioRef}
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onError={handleAudioError}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || 0)
              audioRef.current.playbackRate = playbackRate
            }
          }}
          onEnded={handleEnded}
        />

        {/* Header Bar */}
        <div className="audiobook-player-topbar">
          <button type="button" className="audiobook-player-btn-icon" onClick={onClose} title="Thu nhỏ">
            <ChevronDown size={22} />
          </button>
          <div className="audiobook-player-top-title">
            <span>Đang phát sách nói</span>
            <strong>{audiobook.title}</strong>
          </div>
          <WatchTogetherButton
            item={{
              kind: 'OTHER',
              refId: audiobook.id,
              title: audiobook.title,
              subtitle: audiobook.author,
              thumbnail: audiobook.cover,
              url: `/audiobooks`,
            }}
            className="audiobook-player-btn-icon"
            label={null}
            size={18}
            title="Xem chung cùng người thân"
          />
        </div>

        {/* Cover Art Visualizer */}
        <div className="audiobook-disc-container">
          <div className={`audiobook-disc ${isPlaying ? 'spinning' : ''}`}>
            {audiobook.cover ? (
              <img src={audiobook.cover} alt={audiobook.title} className="audiobook-disc-img" />
            ) : (
              <div className="audiobook-disc-placeholder">
                <Volume2 size={48} />
              </div>
            )}
            <div className="audiobook-disc-center" />
          </div>
        </div>

        {/* Title, Author & Total Duration Badge */}
        <div className="audiobook-track-info">
          <h2 className="audiobook-track-name">{currentTrack?.title || audiobook.title}</h2>
          <p className="audiobook-track-author">{audiobook.author}</p>
          <div className="audiobook-badges-row">
            <span className="audiobook-part-badge">
              Phần {currentTrackIndex + 1} / {audiobook.tracks.length}
            </span>
            {displayTotalDuration && (
              <span className="audiobook-total-dur-badge">
                <Clock size={12} style={{ display: 'inline', marginRight: 3 }} />
                Tổng {displayTotalDuration}
              </span>
            )}
            {useProxyFallback && (
              <span className="audiobook-proxy-badge" title="Đang truyền âm thanh qua server proxy an toàn">
                <Sparkles size={11} style={{ display: 'inline', marginRight: 2 }} />
                Proxy Stream
              </span>
            )}
          </div>

          {hasPlaybackError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                padding: '8px 12px',
                margin: '10px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: '0.78rem',
                color: '#fca5a5',
              }}
            >
              <span>⚠️ Link audio bị hỏng hoặc không tồn tại.</span>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Bạn có muốn xóa cuốn "${audiobook.title}" khỏi thư viện không?`)) {
                    await deleteAudiobook(audiobook.id)
                    showToast(`Đã xóa cuốn "${audiobook.title}" khỏi thư viện`)
                    onClose()
                    if (onDeleted) onDeleted(audiobook.id)
                  }
                }}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap',
                }}
              >
                🗑️ Xóa sách hỏng
              </button>
            </div>
          )}
        </div>

        {/* Interactive Seek Bar */}
        <div className="audiobook-seeker-area">
          <div className="audiobook-slider-wrap">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const target = Number(e.target.value)
                setCurrentTime(target)
                if (audioRef.current) audioRef.current.currentTime = target
              }}
              className="audiobook-progress-slider"
            />
          </div>
          <div className="audiobook-time-row">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="audiobook-controls-row">
          <button
            type="button"
            className="audiobook-ctrl-btn sec"
            onClick={handlePrevTrack}
            disabled={currentTrackIndex === 0}
            title="Phần trước"
          >
            <SkipBack size={20} />
          </button>

          <button type="button" className="audiobook-ctrl-btn sec" onClick={() => skip(-15)} title="Lùi 15 giây">
            <RotateCcw size={20} />
            <span className="audiobook-btn-mini-label">15s</span>
          </button>

          <button type="button" className="audiobook-ctrl-btn play-main" onClick={togglePlay} title={isPlaying ? 'Tạm dừng' : 'Phát'}>
            {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: 3 }} />}
          </button>

          <button type="button" className="audiobook-ctrl-btn sec" onClick={() => skip(15)} title="Tua tới 15 giây">
            <RotateCw size={20} />
            <span className="audiobook-btn-mini-label">15s</span>
          </button>

          <button
            type="button"
            className="audiobook-ctrl-btn sec"
            onClick={handleNextTrack}
            disabled={currentTrackIndex >= audiobook.tracks.length - 1}
            title="Phần tiếp theo"
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Bottom Utility Bar (Speed, Sleep Timer, Playlist) */}
        <div className="audiobook-utility-bar">
          {/* Tốc độ phát */}
          <div className="audiobook-speed-picker">
            {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                type="button"
                className={`audiobook-speed-chip ${playbackRate === rate ? 'active' : ''}`}
                onClick={() => changePlaybackRate(rate)}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Hẹn giờ ngủ */}
          <div className="audiobook-sleep-toggle">
            <button
              type="button"
              className={`audiobook-util-chip ${sleepTimerMinutes ? 'active' : ''}`}
              onClick={() => {
                if (!sleepTimerMinutes) setSleepTimerMinutes(15)
                else if (sleepTimerMinutes === 15) setSleepTimerMinutes(30)
                else if (sleepTimerMinutes === 30) setSleepTimerMinutes(45)
                else if (sleepTimerMinutes === 45) setSleepTimerMinutes(60)
                else setSleepTimerMinutes(null)
              }}
              title="Hẹn giờ tắt audio"
            >
              <Clock size={14} />
              <span>{sleepTimerRemaining ? `${Math.ceil(sleepTimerRemaining / 60)}p` : 'Hẹn giờ'}</span>
            </button>

            <button
              type="button"
              className={`audiobook-util-chip ${showPlaylist ? 'active' : ''}`}
              onClick={() => setShowPlaylist((v) => !v)}
              title="Danh sách các phần"
            >
              <ListMusic size={14} />
              <span>{audiobook.tracks.length} phần</span>
            </button>
          </div>
        </div>

        {/* Playlist Drawer */}
        {showPlaylist && (
          <div className="audiobook-playlist-drawer">
            <div className="audiobook-playlist-header">
              <h3>
                Danh sách các phần ({audiobook.tracks.length})
                {displayTotalDuration && <span style={{ fontSize: '0.8rem', opacity: 0.8, marginLeft: 6 }}>· {displayTotalDuration}</span>}
              </h3>
              <button type="button" onClick={() => setShowPlaylist(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="audiobook-playlist-items">
              {audiobook.tracks.map((t, idx) => {
                const isCurrent = idx === currentTrackIndex
                return (
                  <div
                    key={t.id || idx}
                    className={`audiobook-playlist-row ${isCurrent ? 'playing' : ''}`}
                    onClick={() => {
                      setCurrentTrackIndex(idx)
                      setIsPlaying(true)
                    }}
                  >
                    <span className="audiobook-playlist-num">{idx + 1}</span>
                    <span className="audiobook-playlist-title">{t.title}</span>
                    {t.durationFormatted && (
                      <span className="audiobook-playlist-dur">{t.durationFormatted}</span>
                    )}
                    {isCurrent && isPlaying && <Volume2 size={15} className="audiobook-playing-icon" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
