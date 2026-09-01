import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Play,
  Pause,
  Volume2,
  BookmarkPlus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Tv,
  Languages,
  BookOpen,
  Repeat,
  Search,
  X,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react'
import { InteractiveSentence } from './InteractiveSentence'
import { QuickWordLookupModal } from './QuickWordLookupModal'
import { useToast } from '../ToastContext'
import { playLanguageSpeech, type LanguageDetail } from '../../lib/languageAI'
import {
  VIDEO_LESSONS_DATABASE,
  VIDEO_CATEGORIES,
  type VideoLesson,
} from './videoLessonsData'

// Ensure YouTube Iframe API is loaded
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

type VideoSubtitleLearnViewProps = {
  onSaveWordToVault?: (term: string, meaning: string, details?: LanguageDetail) => void
  onSearchWordGlobal?: (word: string) => void
}

export function VideoSubtitleLearnView({
  onSaveWordToVault,
  onSearchWordGlobal,
}: VideoSubtitleLearnViewProps) {
  const { showToast } = useToast()

  // Navigation: null = Gallery View; VideoLesson = Study Room View
  const [activeLesson, setActiveLesson] = useState<VideoLesson | null>(null)

  // Gallery Filters State
  const [activeLangFilter, setActiveLangFilter] = useState<'ALL' | 'en' | 'zh'>('ALL')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState('')
  const [isLoadingCustomUrl, setIsLoadingCustomUrl] = useState(false)

  // Study Room State
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [autoScroll, setAutoScroll] = useState(true)
  const [loopingCueIndex, setLoopingCueIndex] = useState<number | null>(null)
  const [showVietnamese, setShowVietnamese] = useState(true)
  const [showPinyin, setShowPinyin] = useState(true)

  // Interactive Quick Lookup Modal State
  const [lookupWord, setLookupWord] = useState<{ word: string; lang: 'en' | 'zh' | 'vi' } | null>(null)

  // YouTube Player Ref
  const playerRef = useRef<any>(null)
  const playerContainerId = 'yt-study-room-iframe'
  const activeCueRef = useRef<HTMLDivElement | null>(null)
  const isPlayerReadyRef = useRef(false)

  // Filter lessons for Gallery View
  const filteredLessons = useMemo(() => {
    return VIDEO_LESSONS_DATABASE.filter((lesson) => {
      if (activeLangFilter !== 'ALL' && lesson.lang !== activeLangFilter) {
        return false
      }
      if (activeCategoryFilter !== 'ALL') {
        const catObj = VIDEO_CATEGORIES.find((c) => c.id === activeCategoryFilter)
        if (catObj && lesson.category !== catObj.label) {
          return false
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = lesson.title.toLowerCase().includes(q)
        const matchCategory = lesson.category.toLowerCase().includes(q)
        const matchCue = lesson.cues.some(
          (c) => c.text.toLowerCase().includes(q) || (c.vi && c.vi.toLowerCase().includes(q))
        )
        return matchTitle || matchCategory || matchCue
      }
      return true
    })
  }, [activeLangFilter, activeCategoryFilter, searchQuery])

  // Subtitle cue index matching current video time with smooth boundary bridging
  const currentCues = activeLesson?.cues || []
  const activeCueIndex = useMemo(() => {
    if (!currentCues.length) return -1
    return currentCues.findIndex((c, i) => {
      const nextCue = currentCues[i + 1]
      const effectiveEnd = nextCue ? Math.min(nextCue.start, c.end + 0.6) : c.end + 1.5
      return currentTime >= c.start && currentTime < effectiveEnd
    })
  }, [currentCues, currentTime])

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
    }
  }, [])

  // Initialize YouTube Player when entering Study Room
  useEffect(() => {
    if (!activeLesson) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {}
        playerRef.current = null
      }
      isPlayerReadyRef.current = false
      return
    }

    let isMounted = true
    let pollInterval: any = null

    const initPlayer = () => {
      if (!isMounted || !document.getElementById(playerContainerId)) return

      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {}
      }

      try {
        playerRef.current = new window.YT.Player(playerContainerId, {
          videoId: activeLesson.videoId,
          playerVars: {
            autoplay: 1,
            enablejsapi: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (!isMounted) return
              isPlayerReadyRef.current = true
              setIsPlaying(true)
            },
            onStateChange: (event: any) => {
              if (!isMounted) return
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
              if (event.data === 1) {
                setIsPlaying(true)
              } else if (event.data === 2 || event.data === 0) {
                setIsPlaying(false)
              }
            },
          },
        })
      } catch (err) {
        console.warn('YT Player init fallback:', err)
      }
    }

    if (window.YT && window.YT.Player) {
      setTimeout(initPlayer, 50)
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initPlayer()
      }
    }

    // High frequency time sync poller (every 200ms)
    pollInterval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const t = playerRef.current.getCurrentTime() || 0
          setCurrentTime(t)

          // Check if looping a specific sentence
          if (loopingCueIndex !== null && currentCues[loopingCueIndex]) {
            const cue = currentCues[loopingCueIndex]
            if (t >= cue.end) {
              playerRef.current.seekTo(cue.start, true)
            }
          }
        } catch {}
      }
    }, 200)

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {}
        playerRef.current = null
      }
      isPlayerReadyRef.current = false
    }
  }, [activeLesson, loopingCueIndex])

  // Auto-scroll to active subtitle cue
  useEffect(() => {
    if (autoScroll && activeCueRef.current) {
      activeCueRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeCueIndex, autoScroll])

  // Extract YouTube ID
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
    return match ? match[1] : null
  }

  // Handle Custom YouTube Link Submission
  const handleFetchCustomYoutube = async () => {
    const vid = extractVideoId(customYoutubeUrl.trim())
    if (!vid) {
      showToast('⚠️ Vui lòng nhập đường link YouTube hợp lệ!', 'info')
      return
    }

    setIsLoadingCustomUrl(true)
    try {
      const res = await fetch(`/api/youtube-transcript?v=${encodeURIComponent(vid)}&sl=en&tl=vi`)
      if (!res.ok) throw new Error('Không lấy được phụ đề')
      const data = await res.json()
      if (Array.isArray(data.cues) && data.cues.length > 0) {
        const customLesson: VideoLesson = {
          id: `custom-${vid}`,
          title: `Video YouTube (${vid})`,
          titleVi: `Video YouTube (${vid})`,
          videoId: vid,
          lang: data.sourceLang?.startsWith('zh') ? 'zh' : 'en',
          level: 'Trung cấp',
          category: '🗣️ Giao tiếp đời sống',
          duration: 'Tự động',
          channel: 'YouTube',
          isOfficial: Boolean(data.isOfficial),
          cues: data.cues,
        }
        setActiveLesson(customLesson)
        setLoopingCueIndex(null)
        setCurrentTime(0)
        showToast('🎉 Nạp thành công bài học video!', 'success')
      } else {
        showToast('Video này không có phụ đề văn bản, bạn thử bài học mẫu nhé!', 'info')
      }
    } catch {
      showToast('Không lấy được phụ đề tự động từ link này.', 'info')
    } finally {
      setIsLoadingCustomUrl(false)
    }
  }

  // Seek video on user tap
  const handleSeekToCue = (timeSec: number, index?: number) => {
    setCurrentTime(timeSec)
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(timeSec, true)
        playerRef.current.playVideo()
      } catch {}
    }
    if (index !== undefined && loopingCueIndex === index) {
      setLoopingCueIndex(null)
    }
  }

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (playerRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.pauseVideo()
        } else {
          playerRef.current.playVideo()
        }
      } catch {}
    }
    setIsPlaying(!isPlaying)
  }

  // Change Playback Speed
  const handleChangeSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 0.75 : playbackSpeed === 0.75 ? 1.25 : 1
    setPlaybackSpeed(nextSpeed)
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(nextSpeed)
      } catch {}
    }
    showToast(`Tốc độ: ${nextSpeed}x`, 'info')
  }

  // Toggle Looping Cue
  const handleToggleLoop = (index: number) => {
    if (loopingCueIndex === index) {
      setLoopingCueIndex(null)
      showToast('Đã tắt lặp câu', 'info')
    } else {
      setLoopingCueIndex(index)
      handleSeekToCue(currentCues[index].start)
      showToast(`Đang lặp câu #${index + 1} để luyện nói`, 'success')
    }
  }

  // =========================================================================
  // VIEW 1: DISCOVERY / GALLERY VIEW
  // =========================================================================
  if (!activeLesson) {
    return (
      <div className="video-gallery-container">
        {/* 1. Header Hero / Stats Banner */}
        <div className="video-gallery-hero">
          <div className="video-gallery-hero-text">
            <h2 className="video-gallery-title">
              <Sparkles size={20} color="#ec4899" />
              <span>Học Ngoại Ngữ Qua Video</span>
            </h2>
            <p className="video-gallery-desc">
              Phát video khớp lời từng giây · Tra cứu từ vựng tức thì · Luyện phát âm cùng người bản xứ
            </p>
          </div>

          {/* Quick Stats */}
          <div className="video-gallery-stats">
            <span className="gallery-stat-badge">
              <strong>{VIDEO_LESSONS_DATABASE.length}</strong> bài học mẫu
            </span>
            <span className="gallery-stat-badge">
              <strong>8</strong> chủ đề
            </span>
          </div>
        </div>

        {/* 2. Custom YouTube Link Input */}
        <div className="video-custom-input-card">
          <div className="video-custom-input-inner">
            <Tv size={18} color="#a855f7" />
            <input
              type="text"
              value={customYoutubeUrl}
              onChange={(e) => setCustomYoutubeUrl(e.target.value)}
              placeholder="Dán link YouTube (Anh/Trung) để tạo bài học riêng…"
              className="video-custom-url-input"
            />
            <button
              type="button"
              className="video-custom-submit-btn"
              onClick={handleFetchCustomYoutube}
              disabled={isLoadingCustomUrl || !customYoutubeUrl.trim()}
            >
              {isLoadingCustomUrl ? <Loader2 size={14} className="tv-spin" /> : <Sparkles size={14} />}
              <span>Nạp Video</span>
            </button>
          </div>
        </div>

        {/* 3. Language Selector & Search Box */}
        <div className="video-filter-toolbar">
          {/* Language Selector */}
          <div className="video-lang-toggle-group">
            <button
              type="button"
              className={`video-lang-btn ${activeLangFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('ALL')}
            >
              Tất cả ({VIDEO_LESSONS_DATABASE.length})
            </button>
            <button
              type="button"
              className={`video-lang-btn ${activeLangFilter === 'en' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('en')}
            >
              🇺🇸 Tiếng Anh
            </button>
            <button
              type="button"
              className={`video-lang-btn ${activeLangFilter === 'zh' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('zh')}
            >
              🇨🇳 Tiếng Trung
            </button>
          </div>

          {/* Search Box */}
          <div className="video-gallery-search-box">
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo chủ đề, tiêu đề, từ khóa..."
              className="video-gallery-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="video-gallery-search-clear"
                onClick={() => setSearchQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* 4. Horizontal Category Filter Pills */}
        <div className="video-category-scroll-bar">
          {VIDEO_CATEGORIES.map((cat) => {
            const isCatActive = activeCategoryFilter === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                className={`video-category-pill ${isCatActive ? 'active' : ''}`}
                onClick={() => setActiveCategoryFilter(cat.id)}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* 5. Video Lessons Grid Gallery */}
        <div className="video-gallery-grid">
          {filteredLessons.length === 0 ? (
            <div className="video-empty-state">
              <BookOpen size={36} color="var(--text-muted)" />
              <p>Không tìm thấy bài học nào phù hợp với bộ lọc hiện tại.</p>
              <button
                type="button"
                className="video-reset-filter-btn"
                onClick={() => {
                  setActiveLangFilter('ALL')
                  setActiveCategoryFilter('ALL')
                  setSearchQuery('')
                }}
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : (
            filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                role="button"
                tabIndex={0}
                className="video-gallery-card"
                onClick={() => {
                  setActiveLesson(lesson)
                  setLoopingCueIndex(null)
                  setCurrentTime(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveLesson(lesson)
                    setLoopingCueIndex(null)
                    setCurrentTime(0)
                  }
                }}
              >
                {/* Thumbnail & Badges */}
                <div className="video-card-thumb-wrap">
                  <img
                    src={`https://img.youtube.com/vi/${lesson.videoId}/mqdefault.jpg`}
                    alt={lesson.title}
                    className="video-card-thumb-img"
                    loading="lazy"
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                  <div className="video-card-thumb-overlay">
                    <div className="video-card-play-icon">
                      <Play size={22} fill="#ffffff" color="#ffffff" />
                    </div>
                  </div>
                  <span className="video-card-lang-badge">
                    {lesson.lang === 'zh' ? '🇨🇳 Tiếng Trung' : '🇺🇸 Tiếng Anh'}
                  </span>
                  {lesson.duration && (
                    <span className="video-card-duration-badge">{lesson.duration}</span>
                  )}
                </div>

                {/* Card Content */}
                <div className="video-card-content">
                  <div className="video-card-meta-row">
                    <span className="video-card-category-tag">{lesson.category}</span>
                    <span className="video-card-level-tag">{lesson.level}</span>
                  </div>

                  <h3 className="video-card-title">{lesson.title}</h3>

                  <div className="video-card-footer">
                    <span className="video-card-cues-count">
                      <Languages size={13} /> {lesson.cues.length} câu song ngữ
                    </span>
                    <span className="video-card-action-btn">
                      Học ngay <span style={{ marginLeft: 2 }}>→</span>
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: DEDICATED VIDEO STUDY ROOM
  // =========================================================================
  return (
    <div className="video-study-room-container">
      {/* 1. Sticky Navigation Topbar */}
      <div className="video-study-topbar">
        <button
          type="button"
          className="video-study-back-btn"
          onClick={() => {
            setActiveLesson(null)
            setLoopingCueIndex(null)
          }}
        >
          <ArrowLeft size={16} />
          <span>Danh sách bài học</span>
        </button>

        <div className="video-study-title-group">
          <span className="video-study-cat-badge">{activeLesson.category}</span>
          <h3 className="video-study-lesson-title">{activeLesson.title}</h3>
        </div>

        {/* Subtitle Display Toggles */}
        <div className="video-study-toggles">
          <button
            type="button"
            className={`study-toggle-btn ${showVietnamese ? 'active' : ''}`}
            onClick={() => setShowVietnamese(!showVietnamese)}
            title="Bật/tắt dịch tiếng Việt"
          >
            {showVietnamese ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Dịch TV</span>
          </button>
          {activeLesson.lang === 'zh' && (
            <button
              type="button"
              className={`study-toggle-btn ${showPinyin ? 'active' : ''}`}
              onClick={() => setShowPinyin(!showPinyin)}
              title="Bật/tắt phiên âm Pinyin"
            >
              {showPinyin ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>Pinyin</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Player & Subtitle Script Split Screen */}
      <div className="video-study-split-grid">
        {/* Left/Top: YouTube Player Container */}
        <div className="video-study-player-column">
          <div className="video-study-player-box">
            <div className="video-study-aspect">
              <div id={playerContainerId} className="yt-iframe-instance" />
            </div>

            {/* Playback Control Bar */}
            <div className="video-study-control-bar">
              <button
                type="button"
                className="study-play-btn"
                onClick={handleTogglePlay}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                <span>{isPlaying ? 'Tạm dừng' : 'Phát tiếp'}</span>
              </button>

              <button
                type="button"
                className="study-speed-btn"
                onClick={handleChangeSpeed}
              >
                ⚡ {playbackSpeed}x
              </button>

              <label className="study-autoscroll-label">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                <span>Tự cuộn</span>
              </label>

              {loopingCueIndex !== null && (
                <button
                  type="button"
                  className="study-loop-active-badge"
                  onClick={() => setLoopingCueIndex(null)}
                  title="Tắt chế độ lặp câu"
                >
                  <Repeat size={12} /> Đang lặp #{loopingCueIndex + 1} ✕
                </button>
              )}
            </div>

            {/* Subtitle Quality Notice */}
            <div className="video-study-quality-note">
              {activeLesson.isOfficial ? (
                <span className="quality-pill official">
                  <CheckCircle2 size={13} /> Phụ đề chuẩn gốc từ Video
                </span>
              ) : (
                <span className="quality-pill ai">
                  <Sparkles size={13} /> Phụ đề song ngữ thông minh AI
                </span>
              )}
              <span className="quality-hint">💡 Chạm vào từng từ để tra nghĩa nhanh</span>
            </div>
          </div>
        </div>

        {/* Right/Bottom: Synchronized Subtitle Script Stream */}
        <div className="video-study-script-column">
          <div className="video-study-script-card">
            <div className="video-study-script-header">
              <span className="study-script-header-title">
                <Languages size={15} color="#ec4899" />
                <span>Kịch Bản Lời Thoại Song Ngữ ({currentCues.length})</span>
              </span>
              <span className="study-script-hint">Bấm câu để nhảy tới đoạn nói</span>
            </div>

            <div className="video-study-script-list">
              {currentCues.map((cue, index) => {
                const isActive = index === activeCueIndex
                const isLooping = index === loopingCueIndex
                const min = Math.floor(cue.start / 60)
                const sec = Math.floor(cue.start % 60)
                const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`

                return (
                  <div
                    key={index}
                    ref={isActive ? activeCueRef : null}
                    className={`study-script-item ${isActive ? 'is-active' : ''} ${isLooping ? 'is-looping' : ''}`}
                    onClick={() => handleSeekToCue(cue.start, index)}
                  >
                    {/* Timestamp & Per-line Action Toolbar */}
                    <div className="study-script-item-top">
                      <span className="study-script-time">{timeStr}</span>
                      <div className="study-script-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`study-cue-btn ${isLooping ? 'active' : ''}`}
                          onClick={() => handleToggleLoop(index)}
                          title="Lặp lại câu này để luyện nói"
                        >
                          <Repeat size={12} />
                        </button>

                        <button
                          type="button"
                          className="study-cue-btn"
                          onClick={() => playLanguageSpeech(cue.text, activeLesson.lang)}
                          title="Nghe phát âm chuẩn"
                        >
                          <Volume2 size={12} />
                        </button>

                        {onSaveWordToVault && (
                          <button
                            type="button"
                            className="study-cue-btn"
                            onClick={() => {
                              onSaveWordToVault(cue.vi || cue.text, cue.text)
                              showToast('Đã lưu câu vào Sổ tay!', 'success')
                            }}
                            title="Lưu câu này vào Sổ tay"
                          >
                            <BookmarkPlus size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interactive Text with Clickable Tokens */}
                    <div className="study-script-orig-text">
                      <InteractiveSentence
                        text={cue.text}
                        lang={activeLesson.lang}
                        onWordClick={(w, l) => setLookupWord({ word: w, lang: l })}
                      />
                    </div>

                    {/* Pinyin (For Chinese) */}
                    {showPinyin && cue.pinyin && (
                      <div className="study-script-pinyin-text">{cue.pinyin}</div>
                    )}

                    {/* Vietnamese Translation */}
                    {showVietnamese && cue.vi && (
                      <div className="study-script-vi-text">{cue.vi}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Interactive Quick Word Lookup Modal Popup */}
      {lookupWord && (
        <QuickWordLookupModal
          word={lookupWord.word}
          lang={lookupWord.lang}
          onClose={() => setLookupWord(null)}
          onFullSearch={onSearchWordGlobal}
          onSaveToVault={onSaveWordToVault}
        />
      )}
    </div>
  )
}
