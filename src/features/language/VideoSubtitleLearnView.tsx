import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Play,
  Pause,
  Volume2,
  BookmarkPlus,
  Sparkles,
  RefreshCw,
  Languages,
  Repeat,
  Search,
  ArrowLeft,
  Eye,
  EyeOff,
  Youtube,
  Video,
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
  onStudyModeChange?: (isStudying: boolean) => void
}

export function VideoSubtitleLearnView({
  onSaveWordToVault,
  onSearchWordGlobal,
  onStudyModeChange,
}: VideoSubtitleLearnViewProps) {
  const { showToast } = useToast()

  // Navigation: null = Gallery View; VideoLesson = Study Room View
  const [activeLesson, setActiveLesson] = useState<VideoLesson | null>(null)

  // Notify parent component about study mode state
  useEffect(() => {
    onStudyModeChange?.(Boolean(activeLesson))
  }, [activeLesson, onStudyModeChange])

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

  // Subtitle cue index matching current video time
  const currentCues = activeLesson?.cues || []
  const activeCueIndex = useMemo(() => {
    if (!currentCues.length) return -1
    return currentCues.findIndex((c, i) => {
      const nextCue = currentCues[i + 1]
      const effectiveEnd = nextCue ? Math.min(nextCue.start, c.end + 0.6) : c.end + 1.5
      return currentTime >= c.start && currentTime < effectiveEnd
    })
  }, [currentCues, currentTime])

  // Initialize YouTube Player
  useEffect(() => {
    if (!activeLesson) return

    let isMounted = true
    let pollInterval: any = null

    const initPlayer = () => {
      if (!isMounted || !document.getElementById(playerContainerId)) return

      if (window.YT && window.YT.Player) {
        try {
          playerRef.current = new window.YT.Player(playerContainerId, {
            videoId: activeLesson.videoId,
            playerVars: {
              autoplay: 1,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                if (!isMounted) return
                playerRef.current?.setPlaybackRate(playbackSpeed)
                setIsPlaying(true)
              },
              onStateChange: (event: any) => {
                if (!isMounted) return
                if (event.data === 1) {
                  setIsPlaying(true)
                } else if (event.data === 2 || event.data === 0) {
                  setIsPlaying(false)
                }
              },
            },
          })

          pollInterval = setInterval(() => {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
              try {
                const time = playerRef.current.getCurrentTime() || 0
                setCurrentTime(time)

                if (loopingCueIndex !== null && currentCues[loopingCueIndex]) {
                  const targetCue = currentCues[loopingCueIndex]
                  if (time >= targetCue.end) {
                    playerRef.current.seekTo(targetCue.start, true)
                  }
                }
              } catch {}
            }
          }, 200)
        } catch (e) {
          console.warn('Lỗi khởi tạo YouTube Player:', e)
        }
      } else {
        setTimeout(initPlayer, 250)
      }
    }

    initPlayer()

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {}
        playerRef.current = null
      }
    }
  }, [activeLesson?.videoId, loopingCueIndex])

  // Auto-scroll subtitle card
  useEffect(() => {
    if (autoScroll && activeCueRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeCueIndex, autoScroll])

  // Seek to cue start time
  const handleSeekToCue = (startTime: number, cueIndex?: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(startTime, true)
      playerRef.current.playVideo()
      setIsPlaying(true)
      if (cueIndex !== undefined && loopingCueIndex !== null && loopingCueIndex !== cueIndex) {
        setLoopingCueIndex(null)
      }
    }
  }

  // Toggle playback play/pause
  const handleTogglePlay = () => {
    if (!playerRef.current) return
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo()
        setIsPlaying(false)
      } else {
        playerRef.current.playVideo()
        setIsPlaying(true)
      }
    } catch {}
  }

  // Change playback speed
  const handleChangeSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5]
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length
    const nextSpeed = speeds[nextIdx]
    setPlaybackSpeed(nextSpeed)
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      playerRef.current.setPlaybackRate(nextSpeed)
    }
    showToast(`⚡ Tốc độ phát: ${nextSpeed}x`)
  }

  // Toggle single cue loop
  const handleToggleLoop = (cueIndex: number) => {
    if (loopingCueIndex === cueIndex) {
      setLoopingCueIndex(null)
      showToast('Đã tắt lặp câu')
    } else {
      setLoopingCueIndex(cueIndex)
      const cue = currentCues[cueIndex]
      if (cue) {
        handleSeekToCue(cue.start)
        showToast(`🔁 Đang lặp câu #${cueIndex + 1}`)
      }
    }
  }

  // Handle custom YouTube URL
  const handleLoadCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = customYoutubeUrl.trim()
    if (!url) return

    let vid = ''
    const match1 = url.match(/[?&]v=([^&#]+)/)
    const match2 = url.match(/youtu\.be\/([^?&#]+)/)
    const match3 = url.match(/youtube\.com\/embed\/([^?&#]+)/)
    if (match1) vid = match1[1]
    else if (match2) vid = match2[1]
    else if (match3) vid = match3[1]
    else if (/^[a-zA-Z0-9_-]{11}$/.test(url)) vid = url

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

  // =========================================================================
  // VIEW 1: GALLERY & BROWSE LESSONS
  // =========================================================================
  if (!activeLesson) {
    return (
      <div className="video-learn-container">
        <form onSubmit={handleLoadCustomUrl} className="video-custom-url-bar">
          <div className="video-custom-url-input-wrap">
            <Youtube size={18} className="video-custom-url-icon" />
            <input
              type="text"
              value={customYoutubeUrl}
              onChange={(e) => setCustomYoutubeUrl(e.target.value)}
              placeholder="Dán link YouTube (https://youtube.com/watch?v=...) để học video bất kỳ..."
              className="video-custom-url-input"
            />
            {customYoutubeUrl && (
              <button
                type="button"
                className="video-custom-url-clear"
                onClick={() => setCustomYoutubeUrl('')}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="video-custom-url-btn"
            disabled={isLoadingCustomUrl || !customYoutubeUrl.trim()}
          >
            {isLoadingCustomUrl ? <RefreshCw size={14} className="spin-slow" /> : <Sparkles size={14} />}
            <span>{isLoadingCustomUrl ? 'Đang nạp...' : 'Tải phụ đề AI'}</span>
          </button>
        </form>

        <div className="video-filter-section">
          <div className="video-lang-filter-pills">
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('ALL')}
            >
              🌟 Tất cả ({VIDEO_LESSONS_DATABASE.length})
            </button>
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'en' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('en')}
            >
              🇺🇸 Tiếng Anh ({VIDEO_LESSONS_DATABASE.filter((x) => x.lang === 'en').length})
            </button>
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'zh' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('zh')}
            >
              🇨🇳 Tiếng Trung ({VIDEO_LESSONS_DATABASE.filter((x) => x.lang === 'zh').length})
            </button>
          </div>

          <div className="video-search-wrap">
            <Search size={15} className="video-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm chủ đề, lời thoại, bài học..."
              className="video-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="video-search-clear"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="video-category-scroll-wrap">
          {VIDEO_CATEGORIES.map((cat) => {
            const isSelected = activeCategoryFilter === cat.id
            const count =
              cat.id === 'ALL'
                ? VIDEO_LESSONS_DATABASE.length
                : VIDEO_LESSONS_DATABASE.filter((v) => v.category === cat.label).length

            if (count === 0 && cat.id !== 'ALL') return null

            return (
              <button
                key={cat.id}
                type="button"
                className={`video-category-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setActiveCategoryFilter(cat.id)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.label}</span>
                <span className="cat-count">({count})</span>
              </button>
            )
          })}
        </div>

        <div className="video-gallery-grid">
          {filteredLessons.length === 0 ? (
            <div className="video-empty-state">
              <Video size={44} color="#8b5cf6" style={{ margin: '0 auto 12px' }} />
              <h3>Không tìm thấy bài học nào phù hợp</h3>
              <p>Hãy thử tìm từ khóa khác hoặc xóa bộ lọc thể loại.</p>
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
              >
                <div className="video-card-thumb-wrap">
                  <img
                    src={`https://img.youtube.com/vi/${lesson.videoId}/mqdefault.jpg`}
                    alt={lesson.title}
                    className="video-card-thumb-img"
                  />
                  <div className="video-card-thumb-overlay">
                    <div className="video-card-play-icon">
                      <Play size={22} fill="#ffffff" color="#ffffff" />
                    </div>
                  </div>
                </div>

                <div className="video-card-content">
                  <h3 className="video-card-title">{lesson.title}</h3>
                  <div className="video-card-meta">
                    <span className="video-card-category-tag">{lesson.category}</span>
                    <span className="video-card-cues-count">
                      <Languages size={13} /> {lesson.cues.length} câu
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
      <div className="video-study-topbar">
        <button
          type="button"
          className="video-study-back-btn"
          onClick={() => {
            setActiveLesson(null)
            setLoopingCueIndex(null)
          }}
        >
          <ArrowLeft size={15} />
          <span>Quay lại</span>
        </button>

        <div className="video-study-title-group">
          <span className="video-study-cat-badge">{activeLesson.category}</span>
          <span className="video-study-lesson-title" title={activeLesson.title}>{activeLesson.title}</span>
        </div>

        <div className="video-study-toggles">
          <button
            type="button"
            className={`study-toggle-btn ${showVietnamese ? 'active' : ''}`}
            onClick={() => setShowVietnamese(!showVietnamese)}
          >
            {showVietnamese ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          {activeLesson.lang === 'zh' && (
            <button
              type="button"
              className={`study-toggle-btn ${showPinyin ? 'active' : ''}`}
              onClick={() => setShowPinyin(!showPinyin)}
            >
              {showPinyin ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          )}
        </div>
      </div>

      <div className="video-study-split-grid">
        <div className="video-study-player-column">
          <div className="video-study-player-box">
            <div className="video-study-aspect">
              <div id={playerContainerId} className="yt-iframe-instance" />
            </div>

            <div className="video-study-control-bar">
              <button
                type="button"
                className="study-play-btn"
                onClick={handleTogglePlay}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Tạm dừng' : 'Phát tiếp'}</span>
              </button>

              <button
                type="button"
                className="study-speed-btn"
                onClick={handleChangeSpeed}
              >
                ⚡ {playbackSpeed}x
              </button>

              {loopingCueIndex !== null && (
                <button
                  type="button"
                  className="study-loop-active-badge"
                  onClick={() => setLoopingCueIndex(null)}
                  title="Tắt lặp câu"
                >
                  <Repeat size={11} /> Đang lặp #{loopingCueIndex + 1} ✕
                </button>
              )}

              <label className="study-autoscroll-label">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                <span>Tự cuộn</span>
              </label>
            </div>
          </div>
        </div>

        <div className="video-study-script-column">
          <div className="video-study-script-card">
            <div className="video-study-script-header">
              <span className="study-script-header-title">
                <Languages size={14} color="#ec4899" />
                <span>Lời thoại ({currentCues.length} câu)</span>
              </span>
              <span className="study-script-hint">Chạm từ để tra • Chạm câu để nghe</span>
            </div>

            <div className="video-study-script-list">
              {currentCues.map((cue, index) => {
                const isActive = index === activeCueIndex
                const isLooping = index === loopingCueIndex

                return (
                  <div
                    key={index}
                    ref={isActive ? activeCueRef : null}
                    className={`study-script-item ${isActive ? 'is-active' : ''} ${isLooping ? 'is-looping' : ''}`}
                    onClick={() => handleSeekToCue(cue.start, index)}
                  >
                    <div className="study-script-item-top">
                      <span className="study-script-time">
                        {Math.floor(cue.start / 60)}:{(Math.floor(cue.start % 60)).toString().padStart(2, '0')}
                      </span>
                      <div className="study-script-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`study-cue-btn ${isLooping ? 'active' : ''}`}
                          onClick={() => handleToggleLoop(index)}
                        >
                          <Repeat size={12} />
                        </button>
                        <button
                          type="button"
                          className="study-cue-btn"
                          onClick={() => playLanguageSpeech(cue.text, activeLesson.lang)}
                        >
                          <Volume2 size={12} />
                        </button>
                        {onSaveWordToVault && (
                          <button
                            type="button"
                            className="study-cue-btn"
                            onClick={() => {
                              onSaveWordToVault(cue.vi || cue.text, cue.text)
                              showToast('Đã lưu!', 'success')
                            }}
                          >
                            <BookmarkPlus size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="study-script-orig-text">
                      <InteractiveSentence
                        text={cue.text}
                        lang={activeLesson.lang}
                        onWordClick={(w, l) => setLookupWord({ word: w, lang: l })}
                      />
                    </div>
                    {showPinyin && cue.pinyin && <div className="study-script-pinyin-text">{cue.pinyin}</div>}
                    {showVietnamese && cue.vi && <div className="study-script-vi-text">{cue.vi}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

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
