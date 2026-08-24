import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ListMusic, Music2, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { useAudioPlayer } from './AudioPlayerContext'
import { MarqueeText } from './MarqueeText'
import { WatchTogetherButton } from '../watch/WatchTogetherButton'

type MiniPlayerPosition = {
  top: number | null
  left: number | null
  bottom: number | null
  right: number | null
}

export function GlobalMiniPlayer() {
  const { currentTrack, playlist, isPlaying, volume, isMuted, repeatMode, togglePlay, nextTrack, prevTrack, playTrack, setVolume, toggleMute, toggleRepeat, closePlayer } = useAudioPlayer()
  const [showQueuePopover, setShowQueuePopover] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const popoverRef = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState<MiniPlayerPosition>(() => {
    const saved = localStorage.getItem('miniPlayerPosition')
    if (saved) {
      try {
        return JSON.parse(saved) as MiniPlayerPosition
      } catch {
        localStorage.removeItem('miniPlayerPosition')
      }
    }
    // Vị trí mặc định: góc dưới bên phải
    return { 
      bottom: 20, 
      right: 20,
      top: null,
      left: null
    }
  })
  const playerRef = useRef<HTMLElement | null>(null)
  const positionRef = useRef(position)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)

  // Đóng popover danh sách khi click ra ngoài
  useEffect(() => {
    if (!showQueuePopover && !showVolume) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowQueuePopover(false)
        setShowVolume(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showQueuePopover, showVolume])

  // Handle drag movement
  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!playerRef.current || !drag || e.pointerId !== drag.pointerId) return
      
      const playerWidth = playerRef.current.offsetWidth
      const playerHeight = playerRef.current.offsetHeight
      
      // Tính toán vị trí mới dựa trên con trỏ chuột
      const newLeft = e.clientX - drag.offsetX
      const newTop = e.clientY - drag.offsetY
      
      // Giới hạn trong viewport
      const maxLeft = window.innerWidth - playerWidth
      const maxTop = window.innerHeight - playerHeight
      
      const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft))
      const clampedTop = Math.max(0, Math.min(newTop, maxTop))
      
      // Tính bottom và right từ top và left
      const bottom = window.innerHeight - clampedTop - playerHeight
      const right = window.innerWidth - clampedLeft - playerWidth
      
      const nextPosition = {
        top: clampedTop,
        left: clampedLeft,
        bottom,
        right
      }
      positionRef.current = nextPosition
      setPosition(nextPosition)
    }

    const handlePointerEnd = (e: PointerEvent) => {
      if (dragRef.current?.pointerId !== e.pointerId) return
      dragRef.current = null
      setIsDragging(false)
      localStorage.setItem('miniPlayerPosition', JSON.stringify(positionRef.current))
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerEnd)
    document.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerEnd)
      document.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [isDragging])

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!playerRef.current) return
    
    const rect = playerRef.current.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
    setIsDragging(true)
    
    // Đóng các popover khi bắt đầu kéo
    setShowQueuePopover(false)
    setShowVolume(false)
  }

  // Không có bài hát nào đang mở thì không hiển thị
  if (!currentTrack) return null

  // Khi đang ở đúng trang /music, người dùng đang ở giao diện Thư viện Nhạc đầy đủ nên có thể ẩn thanh mini
  const isMusicRoute = location.pathname === '/music'

  const creator = currentTrack.type === 'MUSIC' ? currentTrack.artist : currentTrack.channel

  const openFullPlayer = () => {
    setShowQueuePopover(false)
    navigate('/music')
  }

  const queueList = playlist.length > 0 ? playlist : [currentTrack]

  return (
    <aside
      ref={(el) => {
        playerRef.current = el
        popoverRef.current = el
      }}
      className={`global-mini-player ${isMusicRoute ? 'is-on-music-page' : ''} ${isDragging ? 'is-dragging' : ''}`}
      aria-label="Trình phát nhạc thu nhỏ"
      style={{
        ...(position.top !== null && position.top !== undefined
          ? { top: `${position.top}px`, bottom: 'auto' }
          : { bottom: `${position.bottom ?? 20}px`, top: 'auto' }),
        ...(position.left !== null && position.left !== undefined
          ? { left: `${position.left}px`, right: 'auto' }
          : { right: `${position.right ?? 20}px`, left: 'auto' }),
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      {/* Popover danh sách phát nổi phía trên */}
      {showQueuePopover && (
        <div className="mini-playlist-popover" onClick={(e) => e.stopPropagation()}>
          <div className="mini-playlist-popover-head">
            <div className="mini-popover-title">
              <ListMusic size={15} className="text-cyan" />
              <span>Danh sách phát ({queueList.length})</span>
            </div>
            <button
              type="button"
              className="mini-popover-close-btn"
              onClick={() => setShowQueuePopover(false)}
              title="Đóng danh sách"
              aria-label="Đóng danh sách"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mini-playlist-popover-list">
            {queueList.map((track, idx) => {
              const isCurrent = track.id === currentTrack.id
              const trackCreator = track.type === 'MUSIC' ? track.artist : track.channel

              return (
                <div
                  key={track.id}
                  className={`mini-popover-row ${isCurrent ? 'is-playing' : ''}`}
                  onClick={() => {
                    playTrack(track, queueList)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      playTrack(track, queueList)
                    }
                  }}
                >
                  <div className="mini-popover-idx">
                    {isCurrent && isPlaying ? (
                      <span className="mini-live-wave" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <div className="mini-popover-info">
                    <strong className="mini-popover-name">{track.name}</strong>
                    {trackCreator && <small className="mini-popover-artist">{trackCreator}</small>}
                  </div>

                  {isCurrent && (
                    <span className="mini-popover-badge">{isPlaying ? 'Đang phát' : 'Đã chọn'}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vùng bấm mở lại trình phát đầy đủ */}
      <div
        className="mini-player-main-info"
        onPointerDown={handleDragStart}
        onDoubleClick={openFullPlayer}
        role="button"
        tabIndex={0}
        aria-label={`Kéo để di chuyển hoặc nhấp đúp để mở trình phát đầy đủ - ${currentTrack.name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openFullPlayer()
          }
        }}
      >
        <div className={`mini-vinyl-art ${isPlaying ? 'is-spinning' : ''}`}>
          {currentTrack.cover_url ? (
            <img src={currentTrack.cover_url} alt="" className="mini-vinyl-img" />
          ) : (
            <Music2 size={16} />
          )}
        </div>

        <div className="mini-player-copy">
          <MarqueeText className="mini-track-title" text={currentTrack.name} />
          <small className="mini-track-artist">{creator || 'Đang phát nhạc'}</small>
        </div>
      </div>

      {/* Cụm điều khiển mini */}
      <div className="mini-player-actions">
        {/* Nút quay lại bài trước */}
        <button
          type="button"
          className="mini-ctrl-btn"
          onClick={(e) => {
            e.stopPropagation()
            prevTrack()
          }}
          title="Bài trước"
          aria-label="Bài trước"
        >
          <SkipBack size={16} fill="currentColor" />
        </button>

        <button
          type="button"
          className="mini-ctrl-btn mini-play-btn"
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          title={isPlaying ? 'Tạm dừng' : 'Phát'}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>

        <button
          type="button"
          className="mini-ctrl-btn"
          onClick={(e) => {
            e.stopPropagation()
            nextTrack()
          }}
          title="Bài tiếp theo"
          aria-label="Bài tiếp theo"
        >
          <SkipForward size={16} fill="currentColor" />
        </button>

        {/* Nút lặp lại */}
        <button
          type="button"
          className={`mini-ctrl-btn ${repeatMode !== 'OFF' ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            toggleRepeat()
          }}
          title={repeatMode === 'OFF' ? 'Lặp lại: Tắt' : repeatMode === 'ALL' ? 'Lặp lại: Tất cả' : 'Lặp lại: Bài này'}
          aria-label={repeatMode === 'OFF' ? 'Lặp lại: Tắt' : repeatMode === 'ALL' ? 'Lặp lại: Tất cả' : 'Lặp lại: Bài này'}
        >
          {repeatMode === 'ONE' ? <Repeat1 size={16} /> : <Repeat size={16} />}
        </button>

        {/* Volume control: icon toggle + inline slider popover */}
        <div className="mini-volume-wrapper">
          {showVolume && (
            <div className="mini-volume-popover" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="mini-vol-mute-btn"
                onClick={() => toggleMute()}
                title={isMuted || volume === 0 ? 'Bật âm' : 'Tắt tiếng'}
                aria-label={isMuted || volume === 0 ? 'Bật âm' : 'Tắt tiếng'}
              >
                {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                className="mini-volume-slider"
                min={0}
                max={1}
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Âm lượng"
                style={{ '--vol-percent': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
              />
              <span className="mini-vol-label">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>
          )}
          <button
            type="button"
            className={`mini-ctrl-btn mini-vol-toggle-btn ${showVolume ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setShowVolume(!showVolume)
              if (showQueuePopover) setShowQueuePopover(false)
            }}
            title="Chỉnh âm lượng"
            aria-label="Chỉnh âm lượng"
          >
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        <button
          type="button"
          className={`mini-ctrl-btn mini-queue-btn ${showQueuePopover ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setShowQueuePopover(!showQueuePopover)
            if (showVolume) setShowVolume(false)
          }}
          title="Xem danh sách phát"
          aria-label="Xem danh sách phát"
        >
          <ListMusic size={16} />
        </button>

        <WatchTogetherButton
          className="mini-ctrl-btn"
          label=""
          size={16}
          item={() =>
            currentTrack
              ? {
                  kind: 'MUSIC' as const,
                  refId: currentTrack.id,
                  title: currentTrack.name,
                  subtitle: currentTrack.artist ?? undefined,
                  thumbnail: currentTrack.cover_url ?? null,
                  url: currentTrack.audio_url ?? null,
                }
              : null
          }
        />

        <button
          type="button"
          className="mini-ctrl-btn mini-close-btn"
          onClick={(e) => {
            e.stopPropagation()
            closePlayer()
          }}
          title="Đóng trình phát"
          aria-label="Đóng trình phát"
        >
          <X size={15} />
        </button>
      </div>
    </aside>
  )
}
