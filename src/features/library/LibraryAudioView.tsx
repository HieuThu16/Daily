import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CloudUpload,
  ListMusic,
  Music2,
  Pause,
  Pencil,
  Play,
  Repeat,
  Repeat1,
  Search,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Youtube,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Media } from '../../types'
import { MarqueeText } from './MarqueeText'
import { useOptionalAudioPlayer, type RepeatMode } from './AudioPlayerContext'
import { isItemInCollection, toggleSaveToCollection } from '../collection/collectionService'
import { useToast } from '../ToastContext'

export type LibraryCategory = {
  id: string
  label: string
  icon: LucideIcon
  color: string
  bg: string
}

type LibraryCategoryBarProps = {
  selectedType: string
  categories: readonly LibraryCategory[]
  onSelect: (id: string) => void
}

export function LibraryCategoryBar({ selectedType, categories, onSelect }: LibraryCategoryBarProps) {
  return (
    <div className="library-category-bar" role="group" aria-label="Thể loại thư viện">
      {categories.map((category) => {
        const Icon = category.icon
        const selected = selectedType === category.id
        return (
          <button
            key={category.id}
            type="button"
            className={`daily-icon-btn library-category-button${selected ? ' active' : ''}`}
            aria-label={category.label}
            aria-pressed={selected}
            title={category.label}
            onClick={() => onSelect(category.id)}
          >
            <span className="icon-box icon-box-sm" style={{ background: category.bg, color: category.color }}>
              <Icon size={14} />
            </span>
            <span className="library-category-label">{category.label}</span>
          </button>
        )
      })}
    </div>
  )
}

type LibraryAudioActionProps = {
  item: Media
  onListen: (item: Media) => void
  onAddMp3: (item: Media) => void
}

export function LibraryAudioAction({ item, onListen, onAddMp3 }: LibraryAudioActionProps) {
  // Sách/phim không có nút audio, nhưng vẫn phải chiếm ô của mình trong lưới
  if (item.type !== 'MUSIC' && item.type !== 'YOUTUBE') return <span className="library-audio-slot" aria-hidden="true" />

  if (!item.audio_url) {
    const label = `Thêm MP3 cho ${item.name}`
    return (
      <button
        type="button"
        className="library-audio-action library-audio-action-add"
        aria-label={label}
        title={label}
        onClick={() => onAddMp3(item)}
      >
        <CloudUpload size={19} />
      </button>
    )
  }

  const label = `Nghe ${item.name}`
  return (
    <button
      type="button"
      className="library-audio-action library-audio-action-listen"
      aria-label={label}
      title={label}
      onClick={() => onListen(item)}
    >
      <Play size={18} fill="currentColor" />
    </button>
  )
}

type LibraryAudioDetailProps = {
  item: Media
  playlist?: Media[]
  onSelectTrack?: (item: Media) => void
  onBack: () => void
  onEdit: (item: Media) => void
  onShareToAll?: (item: Media) => void
}

const statusLabels: Record<Media['status'], string> = {
  PLANNED: 'Sẽ nghe',
  IN_PROGRESS: 'Đang nghe',
  COMPLETED: 'Đã nghe',
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function LibraryAudioDetail({
  item,
  playlist = [],
  onSelectTrack,
  onBack,
  onEdit,
  onShareToAll,
}: LibraryAudioDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Kết nối với Global Audio Player nếu có Provider
  const globalPlayer = useOptionalAudioPlayer()

  // Fallback local state nếu chạy trong môi trường test độc lập không có Provider
  const localAudioRef = useRef<HTMLAudioElement | null>(null)
  const [localTrack, setLocalTrack] = useState<Media>(item)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [localVolume, setLocalVolume] = useState(1)
  const [localMuted, setLocalMuted] = useState(false)
  const [localShuffle, setLocalShuffle] = useState(false)
  const [localRepeat, setLocalRepeat] = useState<RepeatMode>('ALL')
  const [localError, setLocalError] = useState(false)

  const isGlobal = Boolean(globalPlayer)

  // Danh sách bài hát hoàn chỉnh
  const queue = useMemo(() => {
    const sourceList = isGlobal && globalPlayer?.playlist.length ? globalPlayer.playlist : playlist
    if (sourceList.length > 0 && sourceList.some((t) => t.id === item.id)) {
      return sourceList
    }
    return [item, ...sourceList.filter((t) => t.id !== item.id)]
  }, [playlist, item, isGlobal, globalPlayer?.playlist])

  // Khởi động phát bài hát khi mở màn hình chi tiết
  useEffect(() => {
    if (globalPlayer) {
      if (globalPlayer.currentTrack?.id !== item.id) {
        globalPlayer.playTrack(item, queue)
      }
    } else {
      setLocalTrack(item)
      setLocalCurrentTime(0)
      if (localAudioRef.current && item.audio_url) {
        localAudioRef.current.load?.()
        const p = localAudioRef.current.play?.()
        if (p && typeof p.then === 'function') {
          p.then(() => setLocalPlaying(true)).catch(() => setLocalPlaying(false))
        } else {
          setLocalPlaying(true)
        }
      }
    }
  }, [item.id])

  const currentTrack = isGlobal && globalPlayer?.currentTrack ? globalPlayer.currentTrack : localTrack
  const isPlaying = isGlobal && globalPlayer ? globalPlayer.isPlaying : localPlaying
  const currentTime = isGlobal && globalPlayer ? globalPlayer.currentTime : localCurrentTime
  const duration = isGlobal && globalPlayer ? globalPlayer.duration : localDuration
  const volume = isGlobal && globalPlayer ? globalPlayer.volume : localVolume
  const isMuted = isGlobal && globalPlayer ? globalPlayer.isMuted : localMuted
  const isShuffle = isGlobal && globalPlayer ? globalPlayer.isShuffle : localShuffle
  const repeatMode = isGlobal && globalPlayer ? globalPlayer.repeatMode : localRepeat
  const audioError = isGlobal && globalPlayer ? globalPlayer.audioError : localError

  const [searchQuery, setSearchQuery] = useState('')
  const [showQueue, setShowQueue] = useState(true)
  const { showToast } = useToast()
  const [isCollected, setIsCollected] = useState(() => isItemInCollection('MUSIC', currentTrack.id))

  useEffect(() => {
    setIsCollected(isItemInCollection('MUSIC', currentTrack.id))
  }, [currentTrack.id])

  const handleToggleCollect = async () => {
    const res = await toggleSaveToCollection({
      item_type: 'MUSIC',
      item_id: currentTrack.id,
      title: currentTrack.name,
      subtitle: currentTrack.artist || 'Bài hát',
      image_url: currentTrack.cover_url || null,
      url: `/music`,
      category: currentTrack.genre || 'Nhạc',
    })
    setIsCollected(res.added)
    showToast(res.added ? '✨ Đã lưu vào Bộ sưu tập thẻ 3D!' : '🗑️ Đã bỏ khỏi Bộ sưu tập')
  }

  // Focus tiêu đề khi đổi bài
  useEffect(() => {
    headingRef.current?.focus()
  }, [currentTrack.id])

  const currentIndex = queue.findIndex((t) => t.id === currentTrack.id)
  const nextTrackItem =
    currentIndex >= 0 && currentIndex < queue.length - 1
      ? queue[currentIndex + 1]
      : queue.length > 1 && repeatMode === 'ALL'
        ? queue[0]
        : null

  const switchTrack = (track: Media) => {
    if (globalPlayer) {
      globalPlayer.playTrack(track, queue)
    } else {
      setLocalTrack(track)
      setLocalCurrentTime(0)
    }
    if (onSelectTrack) onSelectTrack(track)
  }

  const handleTogglePlay = () => {
    if (globalPlayer) {
      globalPlayer.togglePlay()
    } else if (localAudioRef.current) {
      if (localPlaying) {
        localAudioRef.current.pause?.()
        setLocalPlaying(false)
      } else {
        const p = localAudioRef.current.play?.()
        if (p && typeof p.then === 'function') {
          p.then(() => setLocalPlaying(true)).catch(() => setLocalPlaying(false))
        } else {
          setLocalPlaying(true)
        }
      }
    }
  }

  const handleNext = () => {
    if (globalPlayer) {
      globalPlayer.nextTrack()
    } else {
      if (currentIndex < queue.length - 1) {
        switchTrack(queue[currentIndex + 1])
      } else if (repeatMode === 'ALL') {
        switchTrack(queue[0])
      }
    }
  }

  const handlePrev = () => {
    if (globalPlayer) {
      globalPlayer.prevTrack()
    } else {
      if (currentIndex > 0) {
        switchTrack(queue[currentIndex - 1])
      } else if (repeatMode === 'ALL') {
        switchTrack(queue[queue.length - 1])
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (globalPlayer) {
      globalPlayer.seek(time)
    } else {
      setLocalCurrentTime(time)
      if (localAudioRef.current) localAudioRef.current.currentTime = time
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (globalPlayer) {
      globalPlayer.setVolume(val)
    } else {
      setLocalVolume(val)
      if (localAudioRef.current) {
        localAudioRef.current.volume = val
        setLocalMuted(val === 0)
      }
    }
  }

  const toggleMute = () => {
    if (globalPlayer) {
      globalPlayer.toggleMute()
    } else if (localAudioRef.current) {
      if (localMuted) {
        localAudioRef.current.volume = localVolume || 0.5
        setLocalMuted(false)
      } else {
        localAudioRef.current.volume = 0
        setLocalMuted(true)
      }
    }
  }

  const toggleRepeat = () => {
    if (globalPlayer) {
      globalPlayer.toggleRepeat()
    } else {
      setLocalRepeat((prev) => (prev === 'OFF' ? 'ALL' : prev === 'ALL' ? 'ONE' : 'OFF'))
    }
  }

  const toggleShuffle = () => {
    if (globalPlayer) {
      globalPlayer.toggleShuffle()
    } else {
      setLocalShuffle((prev) => !prev)
    }
  }

  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return queue
    const q = searchQuery.toLowerCase()
    return queue.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q)) ||
        (t.music_genre && t.music_genre.toLowerCase().includes(q)),
    )
  }, [queue, searchQuery])

  const creator = currentTrack.type === 'MUSIC' ? currentTrack.artist : currentTrack.channel
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <section className="library-audio-detail web-music-player" aria-labelledby="library-audio-title">
      {/* Fallback audio element khi chạy độc lập không có global provider */}
      {!isGlobal && (
        <audio
          ref={localAudioRef}
          key={currentTrack.id}
          src={currentTrack.audio_url || undefined}
          preload="auto"
          onPlay={() => setLocalPlaying(true)}
          onPause={() => setLocalPlaying(false)}
          onTimeUpdate={() => {
            if (localAudioRef.current) setLocalCurrentTime(localAudioRef.current.currentTime)
          }}
          onLoadedMetadata={() => {
            if (localAudioRef.current) setLocalDuration(localAudioRef.current.duration)
          }}
          onEnded={handleNext}
          onError={() => {
            setLocalError(true)
            setLocalPlaying(false)
          }}
        />
      )}

      {/* Top Navigation Bar */}
      <div className="music-player-topbar">
        <button type="button" className="library-audio-back" aria-label="Quay lại thư viện" onClick={onBack}>
          <ArrowLeft size={17} />
          Quay lại
        </button>

        <div className="music-player-topbar-title">
          <span className="player-badge-live">
            <span className={`live-pulse-dot ${isPlaying ? 'is-active' : ''}`} />
            {isPlaying ? 'Đang phát' : 'Tạm dừng'}
          </span>
        </div>

        <button
          type="button"
          className={`music-queue-toggle-btn ${showQueue ? 'is-active' : ''}`}
          onClick={() => setShowQueue(!showQueue)}
          title="Danh sách bài hát"
        >
          <ListMusic size={17} />
          <span>{queue.length}</span>
        </button>
      </div>

      <div className="music-player-main-card">
        {/* Vinyl Record & Artwork Section */}
        <div className="music-vinyl-container">
          <div className={`music-vinyl-disc ${isPlaying ? 'is-spinning' : ''}`}>
            <div className="vinyl-groove-lines" />
            <div className="vinyl-center-label">
              {currentTrack.cover_url ? (
                <img src={currentTrack.cover_url} alt="" className="vinyl-cover-img" />
              ) : (
                <div className="vinyl-fallback-icon">
                  <Music2 size={38} />
                </div>
              )}
              <div className="vinyl-spindle-hole" />
            </div>
          </div>

          {/* Equalizer sound bars visualizer */}
          {isPlaying && (
            <div className="music-eq-bars" aria-hidden="true">
              <span className="eq-bar eq-1" />
              <span className="eq-bar eq-2" />
              <span className="eq-bar eq-3" />
              <span className="eq-bar eq-4" />
            </div>
          )}
        </div>

        {/* Song Info & Tags */}
        <div className="library-audio-heading music-track-info">
          <span>{currentTrack.type === 'MUSIC' ? 'Bài nhạc' : 'YouTube Audio'}</span>
          <h2 id="library-audio-title" ref={headingRef} tabIndex={-1}>
            <MarqueeText text={currentTrack.name} />
          </h2>
          <p>{creator || 'Chưa cập nhật nghệ sĩ / kênh'}</p>
        </div>

        <div className="library-audio-meta">
          {currentTrack.music_genre && <span className="genre-pill">{currentTrack.music_genre}</span>}
          <span className="status-pill">{statusLabels[currentTrack.status]}</span>
          {currentTrack.shared_by && <span className="shared-pill">🎵 Do {currentTrack.shared_by} chia sẻ</span>}
          {currentTrack.log_date && (
            <span>
              {currentTrack.log_date}
              {currentTrack.log_time ? ` • ${currentTrack.log_time}` : ''}
            </span>
          )}
          {currentTrack.is_favorite && <span>❤️ Yêu thích</span>}
        </div>

        {audioError && (
          <div className="music-player-error" role="alert">
            <p>⚠️ File audio hiện không phát được. Hãy mở YouTube hoặc tải lại MP3.</p>
          </div>
        )}

        {/* Seek Progress Bar */}
        <div className="music-player-seek-area">
          <div className="seek-time-label">{formatTime(currentTime)}</div>
          <div className="seek-slider-wrapper">
            <input
              type="range"
              className="music-seek-slider"
              min={0}
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              aria-label="Tiến độ bài hát"
              style={{ '--seek-percent': `${progressPercent}%` } as React.CSSProperties}
            />
          </div>
          <div className="seek-time-label duration">{formatTime(duration)}</div>
        </div>

        {/* Main Controls: Shuffle, Prev, Play/Pause, Next, Repeat */}
        <div className="music-player-controls-row">
          <button
            type="button"
            className={`music-ctrl-btn small ${isShuffle ? 'is-active' : ''}`}
            onClick={toggleShuffle}
            title={isShuffle ? 'Tắt phát ngẫu nhiên' : 'Bật phát ngẫu nhiên'}
            aria-label="Phát ngẫu nhiên"
          >
            <Shuffle size={18} />
          </button>

          <button
            type="button"
            className="music-ctrl-btn skip"
            onClick={handlePrev}
            title="Bài trước đó"
            aria-label="Bài trước đó"
          >
            <SkipBack size={22} fill="currentColor" />
          </button>

          <button
            type="button"
            className="music-ctrl-btn play-main"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Tạm dừng' : 'Phát'}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="play-icon-offset" />}
          </button>

          <button
            type="button"
            className="music-ctrl-btn skip"
            onClick={handleNext}
            title="Bài tiếp theo"
            aria-label="Bài tiếp theo"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>

          <button
            type="button"
            className={`music-ctrl-btn small ${repeatMode !== 'OFF' ? 'is-active' : ''}`}
            onClick={toggleRepeat}
            title={`Lặp lại: ${repeatMode === 'OFF' ? 'Tắt' : repeatMode === 'ALL' ? 'Toàn bộ danh sách' : '1 bài duy nhất'}`}
            aria-label="Lặp lại"
          >
            {repeatMode === 'ONE' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>

        {/* Volume & Utility Actions */}
        <div className="music-player-secondary-row">
          <div className="music-volume-box">
            <button
              type="button"
              className="volume-toggle-btn"
              onClick={toggleMute}
              title={isMuted ? 'Bật âm' : 'Tắt âm'}
            >
              {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              className="music-volume-slider"
              min={0}
              max={1}
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              aria-label="Âm lượng"
            />
          </div>

          <div className="music-detail-quick-actions">
            {currentTrack.youtube_url && (
              <a
                href={currentTrack.youtube_url}
                target="_blank"
                rel="noreferrer"
                className="music-quick-action-btn"
                aria-label="Mở trên YouTube"
                title="Mở trên YouTube"
              >
                <Youtube size={15} />
                <span>YouTube</span>
              </a>
            )}
            {currentTrack.type === 'MUSIC' && Boolean(currentTrack.audio_url) && onShareToAll && (
              <button
                type="button"
                className="music-quick-action-btn"
                onClick={() => onShareToAll(currentTrack)}
                title="Chia sẻ cho mọi người"
              >
                <Share2 size={15} />
                <span>Chia sẻ</span>
              </button>
            )}
            <button
              type="button"
              className={`music-quick-action-btn ${isCollected ? 'active' : ''}`}
              onClick={handleToggleCollect}
              title={isCollected ? 'Đã lưu vào bộ sưu tập' : 'Lưu vào bộ sưu tập thẻ 3D'}
              style={{
                color: isCollected ? '#06b6d4' : undefined,
                borderColor: isCollected ? '#06b6d4' : undefined,
              }}
            >
              <Sparkles size={14} />
              <span>{isCollected ? 'Đã sưu tầm' : 'Sưu tầm'}</span>
            </button>
            <button
              type="button"
              className="music-quick-action-btn"
              onClick={() => onEdit(currentTrack)}
              title="Chỉnh sửa bài hát"
            >
              <Pencil size={14} />
              <span>Sửa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Playlist / Up Next Interactive Section */}
      {showQueue && (
        <div className="music-playlist-card">
          <div className="music-playlist-header">
            <div className="music-playlist-title">
              <ListMusic size={18} className="text-cyan" />
              <h3>Danh sách phát ({queue.length})</h3>
            </div>
            {nextTrackItem && (
              <div className="music-next-preview" title={`Bài tiếp theo: ${nextTrackItem.name}`}>
                <small>Tiếp theo:</small>
                <strong>{nextTrackItem.name}</strong>
              </div>
            )}
          </div>

          {queue.length > 4 && (
            <div className="music-playlist-search">
              <Search size={14} />
              <input
                type="search"
                placeholder="Tìm bài trong danh sách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          <div className="music-playlist-items">
            {filteredQueue.map((track, idx) => {
              const isCurrent = track.id === currentTrack.id
              const trackCreator = track.type === 'MUSIC' ? track.artist : track.channel

              return (
                <div
                  key={track.id}
                  className={`music-playlist-row ${isCurrent ? 'is-playing' : ''}`}
                  onClick={() => switchTrack(track)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      switchTrack(track)
                    }
                  }}
                >
                  <div className="music-playlist-idx">
                    {isCurrent && isPlaying ? (
                      <div className="playlist-mini-eq">
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <div className="music-playlist-meta">
                    <strong className="track-title">{track.name}</strong>
                    <div className="track-sub">
                      {trackCreator && <small>{trackCreator}</small>}
                      {track.music_genre && <span className="track-genre-tag">{track.music_genre}</span>}
                      {track.shared_by && <span className="track-shared-tag">Do {track.shared_by}</span>}
                    </div>
                  </div>

                  <div className="music-playlist-action">
                    {isCurrent ? (
                      <span className="now-playing-pill">{isPlaying ? 'Đang phát' : 'Đã chọn'}</span>
                    ) : (
                      <Play size={14} fill="currentColor" className="playlist-play-icon" />
                    )}
                  </div>
                </div>
              )
            })}

            {filteredQueue.length === 0 && (
              <p className="music-playlist-empty">Không tìm thấy bài hát phù hợp trong danh sách.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
