import { useEffect, useState } from 'react'
import {
  Volume2,
  BookmarkPlus,
  Search,
  X,
  Loader2,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import {
  translateAndGenerateBilingual,
  playLanguageSpeech,
  type LanguageDetail,
} from '../../lib/languageAI'
import { useToast } from '../ToastContext'

type QuickWordLookupModalProps = {
  word: string
  lang: 'en' | 'zh' | 'vi'
  onClose: () => void
  onFullSearch?: (word: string) => void
  onSaveToVault?: (term: string, meaning: string, details?: LanguageDetail) => void
}

export function QuickWordLookupModal({
  word,
  lang,
  onClose,
  onFullSearch,
  onSaveToVault,
}: QuickWordLookupModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<LanguageDetail | null>(null)
  const cleanWord = word.replace(/[.,!?;:"'()\[\]{}—–]/g, '').trim()

  useEffect(() => {
    let isMounted = true
    if (!cleanWord) return

    setLoading(true)
    translateAndGenerateBilingual(cleanWord)
      .then((res) => {
        if (isMounted) {
          setDetail(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.warn('Lỗi tra từ nhanh:', err)
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [cleanWord])

  const handlePronounce = () => {
    if (lang === 'zh' || detail?.chinese.text === cleanWord) {
      playLanguageSpeech(cleanWord, 'zh')
    } else {
      playLanguageSpeech(cleanWord, 'en')
    }
  }

  const handleSave = () => {
    if (onSaveToVault && detail) {
      onSaveToVault(detail.vietnamese, detail.english.text, detail)
      showToast(`Đã lưu "${cleanWord}" vào Sổ tay!`, 'success')
      onClose()
    }
  }

  return (
    <div className="quick-lookup-overlay" onClick={onClose}>
      <div className="quick-lookup-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="quick-lookup-header">
          <div className="quick-lookup-title-group">
            <span className="quick-lookup-badge">
              <Sparkles size={12} /> Tra Từ Nhanh
            </span>
            <span className="quick-lookup-lang-tag">
              {lang === 'zh' ? '🇨🇳 Tiếng Trung' : '🇺🇸 Tiếng Anh'}
            </span>
          </div>

          <button type="button" className="quick-lookup-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="quick-lookup-body">
          <div className="quick-lookup-word-row">
            <div style={{ flex: 1 }}>
              <h3 className="quick-lookup-word">{cleanWord}</h3>
              {detail && (
                <div className="quick-lookup-phonetic">
                  {lang === 'zh' || detail.chinese.text === cleanWord
                    ? detail.chinese.pinyin
                    : detail.english.phonetic}
                </div>
              )}
            </div>

            <button
              type="button"
              className="quick-lookup-speech-btn"
              onClick={handlePronounce}
              title="Nghe phát âm"
            >
              <Volume2 size={18} />
            </button>
          </div>

          {loading ? (
            <div className="quick-lookup-loading">
              <Loader2 size={20} className="tv-spin" />
              <span>Đang tra nghĩa ngữ cảnh...</span>
            </div>
          ) : detail ? (
            <div className="quick-lookup-definitions">
              {/* Nghĩa Tiếng Việt */}
              <div className="quick-def-box vi">
                <span className="quick-def-label">🇻🇳 Nghĩa:</span>
                <span className="quick-def-text">{detail.vietnamese}</span>
              </div>

              {/* Chi tiết Anh & Trung */}
              <div className="quick-def-grid">
                <div className="quick-def-box en">
                  <span className="quick-def-label">🇺🇸 Tiếng Anh:</span>
                  <span className="quick-def-text">{detail.english.text}</span>
                  {detail.english.explanation && (
                    <small className="quick-def-desc">{detail.english.explanation}</small>
                  )}
                </div>

                <div className="quick-def-box zh">
                  <span className="quick-def-label">🇨🇳 Tiếng Trung:</span>
                  <span className="quick-def-text">{detail.chinese.text} ({detail.chinese.pinyin})</span>
                  {detail.chinese.explanation && (
                    <small className="quick-def-desc">{detail.chinese.explanation}</small>
                  )}
                </div>
              </div>

              {/* Câu ví dụ tiêu biểu */}
              {detail.examples.length > 0 && (
                <div className="quick-lookup-example">
                  <span className="quick-example-label">
                    <BookOpen size={12} /> Ví dụ ngữ cảnh:
                  </span>
                  <p className="quick-example-orig">
                    {lang === 'zh' ? detail.examples[0].chinese : detail.examples[0].english}
                  </p>
                  <p className="quick-example-vi">{detail.examples[0].vietnamese}</p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '10px 0' }}>
              Không tìm thấy thông tin chi tiết của từ này.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="quick-lookup-actions">
          {onFullSearch && (
            <button
              type="button"
              className="quick-action-btn search"
              onClick={() => {
                onFullSearch(cleanWord)
                onClose()
              }}
            >
              <Search size={14} /> <span>Tra Toàn Diện</span>
            </button>
          )}

          {onSaveToVault && detail && (
            <button
              type="button"
              className="quick-action-btn save"
              onClick={handleSave}
            >
              <BookmarkPlus size={14} /> <span>Lưu Vào Sổ Tay</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
