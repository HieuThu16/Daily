import { useEffect, useRef, useState, useCallback } from 'react'
import {
  RotateCcw,
  SkipBack,
  SkipForward,
  Video,
  ExternalLink,
  Loader2,
  Tv,
  X,
} from 'lucide-react'

declare global {
  interface Window {
    YG?: any
    onYouglishAPIReady?: () => void
  }
}

type NativeSpeakerVideoPlayerProps = {
  initialQuery: string
  initialLanguage?: 'english' | 'chinese'
  onQueryChange?: (q: string) => void
  compact?: boolean
  onClose?: () => void
}

export function NativeSpeakerVideoPlayer({
  initialQuery,
  initialLanguage = 'english',
  compact = false,
  onClose,
}: NativeSpeakerVideoPlayerProps) {
  const [query, setQuery] = useState(initialQuery)
  const [language, setLanguage] = useState<'english' | 'chinese'>(initialLanguage)
  const [accent, setAccent] = useState<'all' | 'us' | 'uk' | 'aus'>('all')
  const [speed, setSpeed] = useState<number>(1)

  // Widget status
  const [isLoading, setIsLoading] = useState(true)
  const [totalResults, setTotalResults] = useState<number>(0)
  const [currentTrack, setCurrentTrack] = useState<number>(1)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const widgetRef = useRef<any>(null)
  const containerId = useRef(`yg-widget-${Math.random().toString(36).slice(2, 9)}`).current
  const isWidgetReady = useRef(false)

  // Sync initial query if changed
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery)
    }
  }, [initialQuery])

  useEffect(() => {
    if (initialLanguage && initialLanguage !== language) {
      setLanguage(initialLanguage)
    }
  }, [initialLanguage])

  // Initialize YouGlish script & widget
  const initWidget = useCallback(() => {
    if (!window.YG || !document.getElementById(containerId)) return

    try {
      if (widgetRef.current) {
        try {
          widgetRef.current.destroy?.()
        } catch {}
      }

      const widget = new window.YG.Widget(containerId, {
        width: '100%',
        components: 68, // Display video + captions + controls
        autoStart: 1,
        events: {
          onFetchDone: (event: any) => {
            setIsLoading(false)
            if (event && typeof event.totalResult === 'number') {
              setTotalResults(event.totalResult)
              if (event.totalResult === 0) {
                setErrorMsg(`Không tìm thấy video nào nói chính xác cụm: "${query}". Bạn thử từ ngắn hơn nhé!`)
              } else {
                setErrorMsg(null)
              }
            }
          },
          onVideoChange: (event: any) => {
            setIsLoading(false)
            if (event && typeof event.currentTrack === 'number') {
              setCurrentTrack(event.currentTrack)
            }
          },
          onError: () => {
            setIsLoading(false)
          },
        },
      })

      widgetRef.current = widget
      isWidgetReady.current = true

      // Trigger first search
      if (query.trim()) {
        setIsLoading(true)
        setErrorMsg(null)
        const accParam = language === 'english' && accent !== 'all' ? accent : undefined
        widget.fetch(query.trim(), language, accParam)
      }
    } catch (err) {
      console.warn('[NativeSpeakerVideo] Lỗi tạo widget YouGlish:', err)
      setIsLoading(false)
    }
  }, [containerId, query, language, accent])

  useEffect(() => {
    // Load YouGlish embed script if not loaded
    const scriptId = 'youglish-widget-api-script'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://youglish.com/public/emb/widget.js'
      script.async = true
      document.body.appendChild(script)

      window.onYouglishAPIReady = () => {
        initWidget()
      }
    } else if (window.YG) {
      initWidget()
    }

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.destroy?.()
        } catch {}
      }
    }
  }, [initWidget])

  // Fetch when query / language / accent changes
  const handleSearchPhrase = (targetPhrase: string, targetLang = language, targetAcc = accent) => {
    const q = targetPhrase.trim()
    if (!q) return
    setIsLoading(true)
    setErrorMsg(null)
    setCurrentTrack(1)

    if (widgetRef.current && isWidgetReady.current) {
      try {
        const accParam = targetLang === 'english' && targetAcc !== 'all' ? targetAcc : undefined
        widgetRef.current.fetch(q, targetLang, accParam)
      } catch {
        initWidget()
      }
    } else {
      initWidget()
    }
  }

  // Navigation handlers
  const handleNextTrack = () => {
    if (widgetRef.current) {
      setIsLoading(true)
      widgetRef.current.next()
    }
  }

  const handlePrevTrack = () => {
    if (widgetRef.current) {
      setIsLoading(true)
      widgetRef.current.previous()
    }
  }

  const handleReplayPhrase = () => {
    if (widgetRef.current) {
      widgetRef.current.replay()
    }
  }

  const handleReplayPrevious5s = () => {
    if (widgetRef.current) {
      widgetRef.current.replayPrevious?.() || widgetRef.current.replay()
    }
  }

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    if (widgetRef.current) {
      widgetRef.current.setSpeed?.(newSpeed)
    }
  }

  return (
    <div className={`native-video-wrapper ${compact ? 'is-compact' : ''}`}>
      {/* Header bar */}
      <div className="native-video-header">
        <div className="native-video-title-row">
          <div className="native-video-badge">
            <Video size={14} className="native-video-pulse" />
            <span>Người Bản Xứ Nói Video</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="native-video-lang-switch">
              <button
                type="button"
                className={`native-lang-chip ${language === 'english' ? 'active' : ''}`}
                onClick={() => {
                  setLanguage('english')
                  handleSearchPhrase(query, 'english', accent)
                }}
              >
                🇺🇸 Tiếng Anh
              </button>
              <button
                type="button"
                className={`native-lang-chip ${language === 'chinese' ? 'active' : ''}`}
                onClick={() => {
                  setLanguage('chinese')
                  handleSearchPhrase(query, 'chinese', 'all')
                }}
              >
                🇨🇳 Tiếng Trung
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                className="native-close-btn"
                onClick={onClose}
                title="Đóng khung video"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Accent Filter for English */}
        {language === 'english' && (
          <div className="native-accent-bar">
            <span className="native-accent-label">Giọng bản xứ:</span>
            {([
              { id: 'all', label: 'Tất cả' },
              { id: 'us', label: 'Mỹ 🇺🇸' },
              { id: 'uk', label: 'Anh 🇬🇧' },
              { id: 'aus', label: 'Úc 🇦🇺' },
            ] as const).map((acc) => (
              <button
                key={acc.id}
                type="button"
                className={`native-accent-btn ${accent === acc.id ? 'active' : ''}`}
                onClick={() => {
                  setAccent(acc.id)
                  handleSearchPhrase(query, 'english', acc.id)
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video Container Box */}
      <div className="native-player-container">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="native-loading-overlay">
            <Loader2 size={28} className="tv-spin" />
            <span>Đang tìm clip người bản xứ nói câu này...</span>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="native-error-banner">
            <Tv size={18} />
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{errorMsg}</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.74rem', opacity: 0.8 }}>
                Mẹo: Hãy thử tìm từng cụm từ 2-4 chữ (ví dụ: &quot;book a room&quot;, &quot;hotel reservation&quot;) để có nhiều clip thực tế hơn!
              </p>
            </div>
          </div>
        )}

        {/* YouGlish Embed Container */}
        <div id={containerId} className="native-youglish-target" />
      </div>

      {/* Interactive Control & Action Bar */}
      <div className="native-controls-bar">
        {/* Left: Track Navigation */}
        <div className="native-track-nav">
          <button
            type="button"
            className="native-ctrl-btn"
            onClick={handlePrevTrack}
            disabled={currentTrack <= 1 || isLoading}
            title="Xem clip trước"
          >
            <SkipBack size={15} />
            <span className="hide-on-xs">Trước</span>
          </button>

          <div className="native-track-counter">
            <span>Clip</span>
            <strong>{currentTrack}</strong>
            <span>/</span>
            <span>{totalResults > 0 ? (totalResults > 999 ? '999+' : totalResults) : '5+'}</span>
          </div>

          <button
            type="button"
            className="native-ctrl-btn"
            onClick={handleNextTrack}
            disabled={isLoading || (totalResults > 0 && currentTrack >= totalResults)}
            title="Chuyển sang video tiếp theo"
          >
            <span className="hide-on-xs">Tiếp</span>
            <SkipForward size={15} />
          </button>
        </div>

        {/* Center: Replay sentence & speed */}
        <div className="native-action-pills">
          <button
            type="button"
            className="native-pill-action replay"
            onClick={handleReplayPhrase}
            title="Phát lại đúng câu này"
          >
            <RotateCcw size={14} />
            <span>Nghe lại</span>
          </button>

          <button
            type="button"
            className="native-pill-action prev5s"
            onClick={handleReplayPrevious5s}
            title="Lùi lại 5 giây"
          >
            <span>-5s</span>
          </button>

          {/* Speed Toggle: 0.75x -> 1.0x -> 1.25x */}
          <button
            type="button"
            className="native-pill-action speed"
            onClick={() => {
              const nextSpeed = speed === 1 ? 0.75 : speed === 0.75 ? 1.25 : 1
              handleSpeedChange(nextSpeed)
            }}
            title="Tốc độ nói"
          >
            <span>{speed}x</span>
          </button>
        </div>
      </div>

      {/* Target query indicator */}
      <div className="native-query-footer">
        <span className="native-query-label">Đang phát âm cụm:</span>
        <strong className="native-query-text">&quot;{query}&quot;</strong>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query + (language === 'english' ? ' pronunciation' : ' 中文 发音'))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="native-yt-link"
          title="Tìm thêm trên YouTube"
        >
          <ExternalLink size={12} /> YouTube
        </a>
      </div>
    </div>
  )
}
