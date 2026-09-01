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
} from 'lucide-react'
import { InteractiveSentence } from './InteractiveSentence'
import { QuickWordLookupModal } from './QuickWordLookupModal'
import { useToast } from '../ToastContext'
import { playLanguageSpeech, type LanguageDetail } from '../../lib/languageAI'
import {
  VIDEO_LESSONS_DATABASE,
  VIDEO_CATEGORIES,
  type VideoLesson,
  type SubtitleCue,
} from './videoLessonsData'

type VideoSubtitleLearnViewProps = {
  onSaveWordToVault?: (term: string, meaning: string, details?: LanguageDetail) => void
  onSearchWordGlobal?: (word: string) => void
}

export function VideoSubtitleLearnView({
  onSaveWordToVault,
  onSearchWordGlobal,
}: VideoSubtitleLearnViewProps) {
  const { showToast } = useToast()

  // Video & Filter State
  const [selectedLesson, setSelectedLesson] = useState<VideoLesson>(VIDEO_LESSONS_DATABASE[0])
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('')
  const [isLoadingCues, setIsLoadingCues] = useState(false)
  const [activeLangFilter, setActiveLangFilter] = useState<'ALL' | 'en' | 'zh'>('ALL')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL')
  const [videoSearchQuery, setVideoSearchQuery] = useState('')

  // Playback & Subtitle State
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loopingIndex, setLoopingIndex] = useState<number | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)

  // Interactive Quick Lookup Modal State
  const [lookupWord, setLookupWord] = useState<{ word: string; lang: 'en' | 'zh' | 'vi' } | null>(null)

  // Cues list currently active
  const [currentCues, setCurrentCues] = useState<SubtitleCue[]>(selectedLesson.cues)
  const [isOfficialSubs, setIsOfficialSubs] = useState(selectedLesson.isOfficial ?? true)

  const activeCueIndex = useMemo(() => {
    return currentCues.findIndex((c) => currentTime >= c.start && currentTime < c.end)
  }, [currentCues, currentTime])

  const activeCueRef = useRef<HTMLDivElement | null>(null)
  const playerIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Auto-scroll to active cue
  useEffect(() => {
    if (autoScroll && activeCueRef.current) {
      activeCueRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeCueIndex, autoScroll])

  // Update cues when lesson changes
  useEffect(() => {
    setCurrentCues(selectedLesson.cues)
    setIsOfficialSubs(selectedLesson.isOfficial ?? true)
    setCurrentTime(0)
    setLoopingIndex(null)
  }, [selectedLesson])

  // Simulated playback timer for smooth time sync
  useEffect(() => {
    let timer: any
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.25 * playbackSpeed
          // If looping a specific line
          if (loopingIndex !== null && currentCues[loopingIndex]) {
            const cue = currentCues[loopingIndex]
            if (next >= cue.end) {
              return cue.start
            }
          }
          return next
        })
      }, 250)
    }
    return () => clearInterval(timer)
  }, [isPlaying, playbackSpeed, loopingIndex, currentCues])

  // Parse YouTube video ID from URL
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
    return match ? match[1] : null
  }

  // Handle Fetching Subtitles from custom YouTube URL
  const handleFetchYoutubeSubs = async () => {
    const vid = extractVideoId(youtubeInputUrl.trim())
    if (!vid) {
      showToast('⚠️ Vui lòng nhập link YouTube hợp lệ!', 'info')
      return
    }

    setIsLoadingCues(true)
    try {
      const res = await fetch(`/api/youtube-transcript?v=${encodeURIComponent(vid)}&sl=en&tl=vi`)
      if (!res.ok) {
        throw new Error('Không lấy được phụ đề')
      }
      const data = await res.json()
      if (Array.isArray(data.cues) && data.cues.length > 0) {
        const customLesson: VideoLesson = {
          id: `custom-${vid}`,
          title: `Video YouTube (${vid})`,
          videoId: vid,
          lang: data.sourceLang?.startsWith('zh') ? 'zh' : 'en',
          level: 'Trung cấp',
          category: '🗣️ Giao tiếp đời sống',
          isOfficial: Boolean(data.isOfficial),
          cues: data.cues,
        }
        setSelectedLesson(customLesson)
        showToast('🎉 Đã nạp thành công phụ đề song ngữ!', 'success')
      } else {
        showToast('Video này không có sẵn phụ đề văn bản.', 'info')
      }
    } catch {
      showToast('Không lấy được phụ đề tự động. Bạn hãy chọn các bài học mẫu có sẵn nhé!', 'info')
    } finally {
      setIsLoadingCues(false)
    }
  }

  // Seek video to specific timestamp
  const handleSeek = (timeSec: number, index?: number) => {
    setCurrentTime(timeSec)
    setIsPlaying(true)
    if (index !== undefined && loopingIndex === index) {
      setLoopingIndex(null)
    }
  }

  // Toggle looping for a cue
  const handleToggleLoopCue = (index: number) => {
    if (loopingIndex === index) {
      setLoopingIndex(null)
      showToast('Đã tắt chế độ lặp câu', 'info')
    } else {
      setLoopingIndex(index)
      setCurrentTime(currentCues[index].start)
      setIsPlaying(true)
      showToast(`Đang lặp câu #${index + 1} để luyện nói`, 'success')
    }
  }

  // Filter lessons based on language, category, and search query
  const filteredLessons = useMemo(() => {
    return VIDEO_LESSONS_DATABASE.filter((lesson) => {
      // 1. Language Filter
      if (activeLangFilter !== 'ALL' && lesson.lang !== activeLangFilter) {
        return false
      }

      // 2. Category Filter
      if (activeCategoryFilter !== 'ALL') {
        const catObj = VIDEO_CATEGORIES.find((c) => c.id === activeCategoryFilter)
        if (catObj && lesson.category !== catObj.label) {
          return false
        }
      }

      // 3. Search Query
      if (videoSearchQuery.trim()) {
        const q = videoSearchQuery.toLowerCase()
        const matchTitle = lesson.title.toLowerCase().includes(q)
        const matchCategory = lesson.category.toLowerCase().includes(q)
        const matchCue = lesson.cues.some(
          (c) => c.text.toLowerCase().includes(q) || (c.vi && c.vi.toLowerCase().includes(q))
        )
        return matchTitle || matchCategory || matchCue
      }

      return true
    })
  }, [activeLangFilter, activeCategoryFilter, videoSearchQuery])

  return (
    <div className="video-learn-container">
      {/* 1. Header Search & Custom YouTube Link Input Bar */}
      <div className="video-learn-toolbar">
        <div className="video-learn-input-wrap">
          <Tv size={16} color="var(--purple, #a855f7)" />
          <input
            type="text"
            className="video-learn-input"
            value={youtubeInputUrl}
            onChange={(e) => setYoutubeInputUrl(e.target.value)}
            placeholder="Dán link YouTube (Anh/Trung) để nạp phụ đề…"
          />
          <button
            type="button"
            className="video-learn-fetch-btn"
            onClick={handleFetchYoutubeSubs}
            disabled={isLoadingCues || !youtubeInputUrl.trim()}
          >
            {isLoadingCues ? <Loader2 size={13} className="tv-spin" /> : <Sparkles size={13} />}
            <span>Nạp Video</span>
          </button>
        </div>
      </div>

      {/* 2. Category Filter Pills & Language Toggles */}
      <div className="video-preset-section">
        {/* Top Header: Title & Language Toggle */}
        <div className="video-preset-header">
          <span className="video-preset-title">
            <BookOpen size={14} color="#ec4899" />
            <span>Kho Bài Học Tuyển Chọn ({filteredLessons.length})</span>
          </span>

          {/* Language Selector */}
          <div className="video-lang-filter-group">
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('ALL')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'en' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('en')}
            >
              🇺🇸 Tiếng Anh
            </button>
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'zh' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('zh')}
            >
              🇨🇳 Tiếng Trung
            </button>
          </div>
        </div>

        {/* Search Bar for Lessons */}
        <div className="video-lesson-search-row">
          <div className="video-lesson-search-box">
            <Search size={14} className="video-lesson-search-icon" />
            <input
              type="text"
              value={videoSearchQuery}
              onChange={(e) => setVideoSearchQuery(e.target.value)}
              placeholder="Tìm theo chủ đề, tiêu đề hoặc từ khóa câu nói..."
              className="video-lesson-search-input"
            />
            {videoSearchQuery && (
              <button
                type="button"
                className="video-lesson-search-clear"
                onClick={() => setVideoSearchQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Category Horizontal Scrollable Bar */}
        <div className="video-category-pills-bar">
          {VIDEO_CATEGORIES.map((cat) => {
            const isCatActive = activeCategoryFilter === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                className={`video-category-chip ${isCatActive ? 'active' : ''}`}
                onClick={() => setActiveCategoryFilter(cat.id)}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Horizontal Lesson Cards Carousel */}
        <div className="video-preset-carousel">
          {filteredLessons.length === 0 ? (
            <div className="video-empty-notice">
              <span>Không tìm thấy bài học nào phù hợp với bộ lọc hiện tại.</span>
            </div>
          ) : (
            filteredLessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                className={`video-preset-card ${selectedLesson.id === lesson.id ? 'is-active' : ''}`}
                onClick={() => setSelectedLesson(lesson)}
              >
                {/* Video Thumbnail Preview */}
                <div className="video-preset-thumb-wrap">
                  <img
                    src={`https://img.youtube.com/vi/${lesson.videoId}/mqdefault.jpg`}
                    alt={lesson.title}
                    className="video-preset-thumb"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback if image load fails
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                  <span className="video-preset-thumb-badge">
                    {lesson.lang === 'zh' ? '🇨🇳 Trung' : '🇺🇸 Anh'}
                  </span>
                  {lesson.duration && (
                    <span className="video-preset-duration">{lesson.duration}</span>
                  )}
                </div>

                <div className="video-preset-meta">
                  <span className="video-preset-tag">{lesson.category}</span>
                  <span className="video-preset-level">{lesson.level}</span>
                </div>

                <h4 className="video-preset-name">{lesson.title}</h4>

                <div className="video-preset-footer">
                  <span>{lesson.cues.length} câu song ngữ</span>
                  <span className="video-preset-select-hint">
                    {selectedLesson.id === lesson.id ? '▶ Đang học' : 'Chọn học'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 3. Main Video Player & Synchronized Subtitles Grid */}
      <div className="video-player-subtitles-layout">
        {/* Left/Top: YouTube Player */}
        <div className="video-player-frame-box">
          <div className="video-aspect-wrapper">
            <iframe
              key={selectedLesson.videoId}
              ref={playerIframeRef}
              src={`https://www.youtube.com/embed/${selectedLesson.videoId}?enablejsapi=1&autoplay=0&rel=0`}
              title={selectedLesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="video-iframe"
            />
          </div>

          {/* Player Mini Controls */}
          <div className="video-player-mini-bar">
            <button
              type="button"
              className="video-mini-play-btn"
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
            </button>

            <button
              type="button"
              className="video-mini-speed-btn"
              onClick={() => {
                const next = playbackSpeed === 1 ? 0.75 : playbackSpeed === 0.75 ? 1.25 : 1
                setPlaybackSpeed(next)
                showToast(`Tốc độ: ${next}x`, 'info')
              }}
            >
              ⚡ {playbackSpeed}x
            </button>

            <label className="video-autoscroll-toggle">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              <span>Tự cuộn</span>
            </label>

            {loopingIndex !== null && (
              <button
                type="button"
                className="video-looping-badge"
                onClick={() => setLoopingIndex(null)}
                title="Nhấn để tắt lặp câu"
              >
                <Repeat size={12} /> Lặp câu #{loopingIndex + 1} ✕
              </button>
            )}
          </div>

          {/* Subtitle Source Quality Note */}
          <div className="video-subs-quality-note">
            {isOfficialSubs ? (
              <span className="quality-badge official">
                <CheckCircle2 size={13} /> Phụ đề chuẩn gốc từ Video
              </span>
            ) : (
              <span className="quality-badge ai">
                <Sparkles size={13} /> Phụ đề song ngữ tự động qua AI
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              💡 Nhấn vào từng từ trong phụ đề để tra nghĩa nhanh
            </span>
          </div>
        </div>

        {/* Right/Bottom: Synchronized Interactive Subtitles Transcript */}
        <div className="video-transcript-box">
          <div className="video-transcript-header">
            <span className="video-transcript-title">
              <Languages size={14} color="var(--purple, #a855f7)" />
              <span>Phụ Đề Song Ngữ Khớp Lời ({currentCues.length})</span>
            </span>
            <span className="video-transcript-hint">Bấm câu để nhảy tới đoạn nói</span>
          </div>

          <div className="video-transcript-list">
            {currentCues.map((cue, index) => {
              const isActive = index === activeCueIndex
              const isLooping = index === loopingIndex
              const min = Math.floor(cue.start / 60)
              const sec = Math.floor(cue.start % 60)
              const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`

              return (
                <div
                  key={index}
                  ref={isActive ? activeCueRef : null}
                  className={`transcript-cue-item ${isActive ? 'is-active' : ''} ${isLooping ? 'is-looping' : ''}`}
                  onClick={() => handleSeek(cue.start, index)}
                >
                  <div className="transcript-cue-head">
                    <span className="transcript-time-badge">{timeStr}</span>
                    <div className="transcript-cue-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`cue-action-btn ${isLooping ? 'active' : ''}`}
                        onClick={() => handleToggleLoopCue(index)}
                        title="Lặp lại câu này để luyện nói"
                      >
                        <Repeat size={12} />
                      </button>

                      <button
                        type="button"
                        className="cue-action-btn"
                        onClick={() => playLanguageSpeech(cue.text, selectedLesson.lang)}
                        title="Nghe phát âm chuẩn"
                      >
                        <Volume2 size={12} />
                      </button>

                      {onSaveWordToVault && (
                        <button
                          type="button"
                          className="cue-action-btn"
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

                  {/* Original Text with Interactive Clickable Words */}
                  <div className="transcript-orig-text">
                    <InteractiveSentence
                      text={cue.text}
                      lang={selectedLesson.lang}
                      onWordClick={(w, l) => setLookupWord({ word: w, lang: l })}
                    />
                  </div>

                  {/* Pinyin (for Chinese) */}
                  {cue.pinyin && <div className="transcript-pinyin-text">{cue.pinyin}</div>}

                  {/* Vietnamese Meaning */}
                  {cue.vi && <div className="transcript-vi-text">{cue.vi}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quick Word Lookup Modal Popup */}
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
