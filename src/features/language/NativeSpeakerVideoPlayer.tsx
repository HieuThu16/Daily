import { useEffect, useState } from 'react'
import {
  Video,
  ExternalLink,
  Loader2,
  X,
  Languages,
} from 'lucide-react'

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
  onClose,
}: NativeSpeakerVideoPlayerProps) {
  const [query, setQuery] = useState(initialQuery)
  const [language, setLanguage] = useState<'english' | 'chinese'>(initialLanguage)
  const [accent, setAccent] = useState<'all' | 'us' | 'uk' | 'aus'>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Sync initial query if changed
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery)
      setIsLoading(true)
    }
  }, [initialQuery])

  useEffect(() => {
    if (initialLanguage && initialLanguage !== language) {
      setLanguage(initialLanguage)
      setIsLoading(true)
    }
  }, [initialLanguage])

  // Build clean YouGlish embed URL
  const embedUrl = `https://youglish.com/embed/${encodeURIComponent(query.trim())}/${language}?accent=${accent}&slideshow=1`

  return (
    <div className="native-video-wrapper">
      {/* Header Bar */}
      <div className="native-video-header">
        <div className="native-video-title-row">
          <div className="native-video-badge">
            <Video size={14} />
            <span>NGƯỜI BẢN XỨ NÓI VIDEO</span>
          </div>

          <div className="native-video-switch-group">
            <button
              type="button"
              className={`native-lang-chip ${language === 'english' ? 'active' : ''}`}
              onClick={() => {
                setLanguage('english')
                setIsLoading(true)
              }}
            >
              🇺🇸 Tiếng Anh
            </button>
            <button
              type="button"
              className={`native-lang-chip ${language === 'chinese' ? 'active' : ''}`}
              onClick={() => {
                setLanguage('chinese')
                setIsLoading(true)
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

        {/* Accent Selector (Chỉ dành cho tiếng Anh) */}
        {language === 'english' && (
          <div className="native-accents-row">
            <span className="native-accent-label">
              <Languages size={12} /> Giọng:
            </span>
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
                  setIsLoading(true)
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Safe Isolated Video Container Box */}
      <div className="native-player-container" style={{ minHeight: 280, position: 'relative' }}>
        {/* Loading Overlay */}
        {isLoading && (
          <div className="native-loading-overlay">
            <Loader2 size={26} className="tv-spin" />
            <span>Đang tải video thực tế người bản xứ nói &quot;{query}&quot;...</span>
          </div>
        )}

        <iframe
          key={`${query}-${language}-${accent}`}
          src={embedUrl}
          title={`YouGlish ${query}`}
          width="100%"
          height="280"
          frameBorder="0"
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
          style={{
            borderRadius: 14,
            background: '#0a0a0f',
            border: 'none',
            display: 'block',
          }}
        />
      </div>

      {/* Target query indicator */}
      <div className="native-query-footer">
        <span className="native-query-label">Đang phát âm cụm:</span>
        <strong className="native-query-text">&quot;{query}&quot;</strong>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query + (language === 'english' ? ' pronunciation in real life' : ' 怎么读'))}`}
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
