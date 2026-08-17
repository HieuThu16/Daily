import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileText, Loader2, Search, X } from 'lucide-react'
import { searchBookContent, type BookSearchResult } from '../../lib/book/repository'
import type { BookChapterMeta } from '../../types'

type BookSearchModalProps = {
  isOpen: boolean
  onClose: () => void
  documentId: string | null
  chapters: BookChapterMeta[]
  activeChapterIdx: number
  currentChapterContent?: string
  onSelectResult: (result: {
    chapterIdx: number
    matchText: string
    snippet: string
    chapterContent?: string
  }) => void
}

export function BookSearchModal({
  isOpen,
  onClose,
  documentId,
  chapters,
  activeChapterIdx,
  currentChapterContent,
  onSelectResult,
}: BookSearchModalProps) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'all' | 'current'>('all')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    } else {
      setQuery('')
      setResults([])
      setHasSearched(false)
    }
  }, [isOpen])

  const executeSearch = async (searchTerm: string, currentScope: 'all' | 'current') => {
    const trimmed = searchTerm.trim()
    if (!trimmed) {
      setResults([])
      setHasSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setHasSearched(true)

    try {
      if (currentScope === 'current') {
        // Tìm trong chương hiện tại
        const activeChapter = chapters[activeChapterIdx]
        const content = currentChapterContent || ''
        const lowerContent = content.toLowerCase()
        const lowerQ = trimmed.toLowerCase()
        const localResults: BookSearchResult[] = []
        let pos = 0
        let matchIdx = 0

        while ((pos = lowerContent.indexOf(lowerQ, pos)) !== -1) {
          matchIdx++
          const start = Math.max(0, pos - 45)
          const end = Math.min(content.length, pos + trimmed.length + 55)
          const before = (start > 0 ? '…' : '') + content.slice(start, pos)
          const matchText = content.slice(pos, pos + trimmed.length)
          const after = content.slice(pos + trimmed.length, end) + (end < content.length ? '…' : '')

          localResults.push({
            chapterIdx: activeChapterIdx,
            chapterTitle: activeChapter?.title || `Chương ${activeChapterIdx + 1}`,
            chapterId: activeChapter?.id || '',
            matchIndex: matchIdx,
            snippetBefore: before,
            matchText,
            snippetAfter: after,
            fullMatchText: content.slice(Math.max(0, pos - 20), Math.min(content.length, pos + trimmed.length + 20)),
            chapterContent: content,
          })

          pos += Math.max(1, trimmed.length)
          if (matchIdx >= 50) break
        }
        setResults(localResults)
      } else {
        // Tìm trong toàn bộ sách qua Supabase repository
        if (documentId) {
          const res = await searchBookContent(documentId, trimmed)
          setResults(res)
        } else {
          // Fallback nếu chưa có documentId
          setResults([])
        }
      }
    } catch (err) {
      console.error('Lỗi tìm kiếm sách:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!val.trim()) {
      setResults([])
      setHasSearched(false)
      setLoading(false)
      return
    }

    searchTimeoutRef.current = setTimeout(() => {
      void executeSearch(val, scope)
    }, 350)
  }

  const handleScopeChange = (newScope: 'all' | 'current') => {
    setScope(newScope)
    if (query.trim()) {
      void executeSearch(query, newScope)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      void executeSearch(query, scope)
    }
  }

  if (!isOpen) return null

  return (
    <div className="book-search-overlay" onClick={onClose}>
      <div
        className="book-search-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tìm kiếm trong sách"
      >
        {/* Thanh tìm kiếm */}
        <div className="book-search-header">
          <div className="book-search-input-wrapper">
            <Search size={18} className="book-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="book-search-input"
              placeholder="Nhập từ hoặc cụm từ cần tìm..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button
                type="button"
                className="book-search-clear-btn"
                onClick={() => {
                  setQuery('')
                  setResults([])
                  setHasSearched(false)
                  inputRef.current?.focus()
                }}
                aria-label="Xoá tìm kiếm"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button type="button" className="book-search-close-btn" onClick={onClose} aria-label="Đóng tìm kiếm">
            <X size={20} />
          </button>
        </div>

        {/* Phạm vi tìm kiếm */}
        <div className="book-search-scope-bar">
          <span className="book-search-scope-label">Phạm vi:</span>
          <button
            type="button"
            className={`book-search-scope-btn ${scope === 'all' ? 'active' : ''}`}
            onClick={() => handleScopeChange('all')}
          >
            <BookOpen size={14} /> Toàn bộ sách ({chapters.length} chương)
          </button>
          <button
            type="button"
            className={`book-search-scope-btn ${scope === 'current' ? 'active' : ''}`}
            onClick={() => handleScopeChange('current')}
          >
            <FileText size={14} /> Chương {activeChapterIdx + 1}
          </button>
        </div>

        {/* Kết quả tìm kiếm */}
        <div className="book-search-body">
          {loading && (
            <div className="book-search-status">
              <Loader2 size={24} className="book-search-spinner" />
              <span>Đang tìm kiếm trong nội dung sách…</span>
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="book-search-status">
              <p className="book-search-empty-text">Không tìm thấy kết quả nào khớp với &ldquo;{query}&rdquo;.</p>
              <span className="book-search-empty-hint">Hãy thử với từ khoá ngắn hơn hoặc kiểm tra chính tả.</span>
            </div>
          )}

          {!loading && !hasSearched && !query && (
            <div className="book-search-status book-search-guide">
              <Search size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Tìm kiếm văn bản trong sách</p>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                Nhập từ khoá để tra cứu vị trí các câu chữ trong toàn bộ cuốn sách. Nhấn vào kết quả để chuyển ngay đến vị trí đó mà không ghi đè tiến trình đọc.
              </span>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="book-search-results-container">
              <div className="book-search-count">
                Tìm thấy <strong>{results.length}</strong> kết quả{' '}
                {scope === 'all' ? 'trong toàn bộ sách' : `trong Chương ${activeChapterIdx + 1}`}:
              </div>
              <div className="book-search-list">
                {results.map((res, index) => (
                  <button
                    key={`${res.chapterIdx}-${res.matchIndex}-${index}`}
                    type="button"
                    className="book-search-result-item"
                    onClick={() => {
                      onSelectResult({
                        chapterIdx: res.chapterIdx,
                        matchText: res.matchText,
                        snippet: res.fullMatchText,
                        chapterContent: res.chapterContent,
                      })
                      onClose()
                    }}
                  >
                    <div className="book-search-item-header">
                      <span className="book-search-item-chapter">
                        Chương {res.chapterIdx + 1}: {res.chapterTitle}
                      </span>
                      <span className="book-search-item-badge">#{res.matchIndex}</span>
                    </div>
                    <div className="book-search-snippet">
                      {res.snippetBefore}
                      <mark className="book-search-highlight">{res.matchText}</mark>
                      {res.snippetAfter}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="book-search-footer">
          <span className="book-search-tip">
            💡 Nhấn vào kết quả để di chuyển tới vị trí đó. Tiến trình đọc của bạn sẽ không bị ghi đè.
          </span>
        </div>
      </div>
    </div>
  )
}
