import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Search,
  Sparkles,
  Loader2,
  Layers,
  StopCircle,
  User,
  CheckSquare,
  Square,
  Target,
} from 'lucide-react'
import { Modal } from '../shared'
import {
  UNIFIED_CATEGORIES,
  searchMultiSource,
  crawlUnified,
  fetchUnifiedDetail,
  saveDilibBook,
  getSuggestedAuthors,
  type UnifiedBookCategory,
  type UnifiedSearchResult,
  type CrawlReport,
  type CrawlerSource,
  type CrawlerBookFormat,
  type CrawlerScope,
  type CrawlProgressInfo,
} from '../../lib/dilibCrawler'
import { useToast } from '../ToastContext'

export function DilibCrawlerModal({
  isOpen,
  onClose,
  onFinished,
  initialMode = 'COUNT',
}: {
  isOpen: boolean
  onClose: () => void
  onFinished?: () => void
  initialMode?: 'COUNT' | 'CATEGORY' | 'AUTHOR' | 'SEARCH'
}) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'COUNT' | 'CATEGORY' | 'AUTHOR' | 'SEARCH'>(initialMode)
  const [selectedSource, setSelectedSource] = useState<CrawlerSource>('ALL')
  const [selectedFormat, setSelectedFormat] = useState<CrawlerBookFormat>('ALL')

  // 1. Target Count Mode State
  const [targetCount, setTargetCount] = useState<number>(10)
  const [customTargetInput, setCustomTargetInput] = useState<string>('')
  const [countScope, setCountScope] = useState<CrawlerScope>('ALL_LIBRARY')
  const [countCategory, setCountCategory] = useState<UnifiedBookCategory>(UNIFIED_CATEGORIES[0])
  const [countAuthor, setCountAuthor] = useState<string>('')
  const [countSearchQuery, setCountSearchQuery] = useState<string>('')

  // 2. Category Tab State
  const [selectedCategory, setSelectedCategory] = useState<UnifiedBookCategory>(UNIFIED_CATEGORIES[0])
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryTargetCount, setCategoryTargetCount] = useState<number>(10)
  const [maxMinutes, setMaxMinutes] = useState<number>(0)

  // 3. Author Tab State
  const [authorInput, setAuthorInput] = useState('')
  const [selectedAuthor, setSelectedAuthor] = useState('')
  const [isSearchingAuthor, setIsSearchingAuthor] = useState(false)
  const [authorBooks, setAuthorBooks] = useState<UnifiedSearchResult[]>([])
  const [selectedAuthorUrls, setSelectedAuthorUrls] = useState<Set<string>>(new Set())

  // 4. Book Title Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult[]>([])
  const [selectedSearchUrls, setSelectedSearchUrls] = useState<Set<string>>(new Set())

  // 5. Crawling State
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgressInfo | null>(null)
  const [crawlReport, setCrawlReport] = useState<CrawlReport | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Gợi ý tác giả trực tiếp theo input
  const authorSuggestions = useMemo(() => {
    return getSuggestedAuthors(authorInput)
  }, [authorInput])

  // Lọc thể loại chuẩn theo từ khóa
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return UNIFIED_CATEGORIES
    return UNIFIED_CATEGORIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
    )
  }, [categorySearch])

  // Tìm kiếm sách theo tác giả trên cả 2 nguồn
  const handleSelectAuthor = async (authorName: string) => {
    setSelectedAuthor(authorName)
    setAuthorInput(authorName)
    setIsSearchingAuthor(true)
    setAuthorBooks([])
    setSelectedAuthorUrls(new Set())

    try {
      const results = await searchMultiSource(authorName, selectedSource, 1)
      setAuthorBooks(results)
      setSelectedAuthorUrls(new Set(results.map((r) => r.url)))
    } catch (err) {
      console.warn('Lỗi tìm sách theo tác giả:', err)
    } finally {
      setIsSearchingAuthor(false)
    }
  }

  // Tự động tìm kiếm sách theo tên sách khi gõ
  useEffect(() => {
    if (activeTab !== 'SEARCH') return
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchMultiSource(q, selectedSource, 1)
      setSearchResults(res)
      setIsSearching(false)
    }, 320)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedSource, activeTab])

  // Bắt đầu cào theo Chế độ Số Cuốn Mục Tiêu
  const handleStartCountCrawl = async () => {
    const finalTarget = customTargetInput ? parseInt(customTargetInput, 10) || targetCount : targetCount
    if (finalTarget <= 0) {
      showToast('Vui lòng chọn số lượng cuốn lớn hơn 0', 'info')
      return
    }

    setIsCrawling(true)
    setCrawlReport(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const report = await crawlUnified({
        targetCount: finalTarget,
        bookFormat: selectedFormat,
        scope: countScope,
        category: countScope === 'CATEGORY' ? countCategory : undefined,
        author: countScope === 'AUTHOR' ? countAuthor || 'Dale Carnegie' : undefined,
        searchQuery: countScope === 'SEARCH' ? countSearchQuery || 'Sách hay' : undefined,
        source: selectedSource,
        signal: controller.signal,
        onProgress: (p) => setCrawlProgress(p),
      })
      setCrawlReport(report)
      const formatMsg =
        selectedFormat === 'AUDIO' ? 'Sách nói' : selectedFormat === 'READ' ? 'Sách đọc PDF' : 'Sách đa định dạng'
      showToast(`🎉 Cào hoàn tất! Đã thu thập đủ ${report.matchedCount} cuốn ${formatMsg}.`)
      onFinished?.()
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast(`❌ Lỗi cào: ${err?.message || err}`, 'error')
      }
    } finally {
      setIsCrawling(false)
      setCrawlProgress(null)
    }
  }

  // Bắt đầu cào danh mục
  const handleStartCategoryCrawl = async () => {
    setIsCrawling(true)
    setCrawlReport(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const report = await crawlUnified({
        targetCount: categoryTargetCount,
        bookFormat: selectedFormat,
        scope: 'CATEGORY',
        category: selectedCategory,
        source: selectedSource,
        maxMinutes,
        signal: controller.signal,
        onProgress: (p) => setCrawlProgress(p),
      })
      setCrawlReport(report)
      showToast(`🎉 Cào hoàn tất! Đã lưu ${report.audiobooksAdded} Sách nói & ${report.booksPdfAdded} Sách PDF.`)
      onFinished?.()
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast(`❌ Lỗi cào: ${err?.message || err}`, 'error')
      }
    } finally {
      setIsCrawling(false)
      setCrawlProgress(null)
    }
  }

  // Bắt đầu cào danh sách URL đã chọn (từ Tác giả hoặc Tìm kiếm)
  const handleStartBatchCrawl = async (urlsToCrawl: string[]) => {
    if (urlsToCrawl.length === 0) {
      showToast('Vui lòng chọn ít nhất một cuốn sách để cào', 'info')
      return
    }

    setIsCrawling(true)
    setCrawlReport(null)
    const startTime = Date.now()
    let scanned = 0
    let matched = 0
    let addedAudio = 0
    let addedPdf = 0
    let totalAudioFiles = 0
    let dilibCount = 0
    let dtvCount = 0
    const itemsReport: CrawlReport['items'] = []
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      for (const url of urlsToCrawl) {
        if (controller.signal.aborted) break
        scanned++
        setCrawlProgress({
          scanned,
          matched,
          targetCount: urlsToCrawl.length,
          addedAudio,
          addedPdf,
          currentBook: url,
          statusMessage: `Đang bóc tách sách (${scanned}/${urlsToCrawl.length})...`,
          elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
          remainingSeconds: 0,
        })

        const detail = await fetchUnifiedDetail(url)
        if (detail) {
          // Lọc theo định dạng
          let isMatch = false
          if (selectedFormat === 'AUDIO') isMatch = detail.hasAudio
          else if (selectedFormat === 'READ') isMatch = detail.hasPdf
          else isMatch = detail.hasAudio || detail.hasPdf

          if (isMatch) {
            if (detail.source === 'Dilib') dilibCount++
            else dtvCount++

            const res = await saveDilibBook(detail, selectedFormat)
            if (res.addedAudio) {
              addedAudio++
              totalAudioFiles += detail.audioTracks.length
            }
            if (res.addedPdf) addedPdf++
            matched++

            itemsReport.push({
              title: detail.title,
              author: detail.author,
              source: detail.source,
              hasAudio: detail.hasAudio,
              hasPdf: detail.hasPdf,
              audioCount: detail.audioTracks.length,
              readbookUrl: detail.readbookUrl,
              cover: detail.cover,
            })
          }
        }
        await new Promise((r) => setTimeout(r, 60))
      }

      const report: CrawlReport = {
        totalScanned: scanned,
        targetCount: urlsToCrawl.length,
        matchedCount: matched,
        audiobooksAdded: addedAudio,
        booksPdfAdded: addedPdf,
        totalAudioFiles,
        durationSeconds: Math.floor((Date.now() - startTime) / 1000),
        dilibCount,
        dtvCount,
        bookFormat: selectedFormat,
        items: itemsReport,
      }
      setCrawlReport(report)
      showToast(`🎉 Đã cào xong ${report.audiobooksAdded} Sách nói & ${report.booksPdfAdded} Sách PDF.`)
      onFinished?.()
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast(`❌ Lỗi cào sách: ${err?.message || err}`, 'error')
      }
    } finally {
      setIsCrawling(false)
      setCrawlProgress(null)
    }
  }

  const handleStopCrawl = () => {
    abortControllerRef.current?.abort()
    setIsCrawling(false)
    showToast('Đã dừng cào sách.', 'info')
  }

  const toggleSelectAuthorUrl = (url: string) => {
    setSelectedAuthorUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const toggleSelectSearchUrl = (url: string) => {
    setSelectedSearchUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  if (!isOpen) return null

  // Tính phần trăm tiến độ
  const progressPercent = crawlProgress
    ? crawlProgress.targetCount > 0
      ? Math.min(100, Math.round((crawlProgress.matched / crawlProgress.targetCount) * 100))
      : 50
    : 0

  return (
    <Modal title="🕷️ Cào Sách & Sách Nói Tự Động (Dilib.vn + DTV eBook)" onClose={onClose}>
      <div className="dilib-crawler-modal-wrap" style={{ minWidth: 320, maxWidth: 660 }}>
        {/* 1. MÀN HÌNH ĐANG CÀO TRỰC TIẾP (LIVE CRAWLING PROGRESS) */}
        {isCrawling && crawlProgress ? (
          <div className="dilib-crawling-card" style={{ textAlign: 'center', padding: '16px 10px' }}>
            <div className="dilib-spinner-glow" style={{ margin: '0 auto 12px', display: 'grid', placeItems: 'center' }}>
              <Loader2 size={38} className="tv-spin" color="var(--primary, #8b5cf6)" />
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800 }}>Đang Cào Dữ Liệu Tự Động</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 12px', minHeight: 20 }}>
              {crawlProgress.statusMessage}
            </p>

            {/* Thanh Tiến Độ Mục Tiêu */}
            {crawlProgress.targetCount > 0 && (
              <div style={{ marginBottom: 14, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>
                  <span>Tiến độ mục tiêu:</span>
                  <span style={{ color: 'var(--primary, #8b5cf6)' }}>
                    {crawlProgress.matched} / {crawlProgress.targetCount} cuốn ({progressPercent}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: 10, background: 'var(--bg-main)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                      borderRadius: 99,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* 3 Thẻ Thống Kê Trực Tiếp */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                background: 'var(--bg-main)',
                padding: '12px 10px',
                borderRadius: 14,
                marginBottom: 14,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary, #8b5cf6)' }}>
                  {crawlProgress.scanned}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Đã quét</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>
                  🎧 {crawlProgress.addedAudio}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sách nói</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                  📖 {crawlProgress.addedPdf}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sách đọc (PDF/EPUB)</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                ⏱️ Đã chạy: <strong>{crawlProgress.elapsedSeconds}s</strong>
              </span>
              {crawlProgress.remainingSeconds < 9000 && crawlProgress.remainingSeconds > 0 && (
                <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>
                  ⏳ Còn lại: <strong>{crawlProgress.remainingSeconds}s</strong>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleStopCrawl}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 22px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <StopCircle size={16} /> Dừng cào lại
            </button>
          </div>
        ) : crawlReport ? (
          /* 2. BÁO CÁO TỔNG KẾT KẾT QUẢ CÀO (SUMMARY REPORT) */
          <div className="dilib-report-card" style={{ padding: '6px 2px' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 2 }}>🎉</div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 800 }}>Báo Cáo Kết Quả Cào Đa Nguồn</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                Thời gian: <b>{crawlReport.durationSeconds}s</b> · Dilib.vn: <b>{crawlReport.dilibCount}</b> · DTV eBook: <b>{crawlReport.dtvCount}</b>
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                background: 'var(--bg-main)',
                padding: '12px 6px',
                borderRadius: 14,
                marginBottom: 14,
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{crawlReport.matchedCount}</div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Thu thập</div>
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>
                  🎧 {crawlReport.audiobooksAdded}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Sách nói</div>
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                  📖 {crawlReport.booksPdfAdded}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>PDF / EPUB</div>
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#06b6d4' }}>
                  {crawlReport.totalAudioFiles}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>File Audio</div>
              </div>
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14, paddingRight: 4 }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main)' }}>
                Chi tiết danh sách các cuốn đã thu thập ({crawlReport.items.length}):
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {crawlReport.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '7px 9px',
                      borderRadius: 10,
                      background: 'var(--bg-main)',
                      border: '1px solid var(--card-border)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span>{item.author}</span>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            padding: '1px 4px',
                            borderRadius: 4,
                            background: item.source === 'Dilib' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: item.source === 'Dilib' ? '#8b5cf6' : '#10b981',
                            fontWeight: 700,
                          }}
                        >
                          {item.source}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {item.hasAudio && (
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                          }}
                        >
                          🎧 {item.audioCount} audio
                        </span>
                      )}
                      {item.hasPdf && (
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                          }}
                        >
                          📖 Sách đọc
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setCrawlReport(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--card-border)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Cào thêm
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Đóng & Xem Thư Viện
              </button>
            </div>
          </div>
        ) : (
          /* 3. MÀN HÌNH CHÍNH: 4 TABS ĐIỀU HƯỚNG CÀO SÁCH */
          <div>
            {/* Lựa Chọn Nguồn Khai Thác & Lọc Định Dạng */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 10,
                background: 'var(--bg-main)',
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid var(--card-border)',
              }}
            >
              {/* Nguồn */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)' }}>
                  Nguồn:
                </span>
                {([
                  { id: 'ALL', label: '⚡ Cả 2 nguồn' },
                  { id: 'DILIB', label: '🌐 Dilib' },
                  { id: 'DTV', label: '📗 DTV eBook' },
                ] as const).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSource(s.id)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: 6,
                      fontSize: '0.68rem',
                      fontWeight: selectedSource === s.id ? 800 : 550,
                      border: `1px solid ${selectedSource === s.id ? 'var(--primary, #8b5cf6)' : 'transparent'}`,
                      background: selectedSource === s.id ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                      color: selectedSource === s.id ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Loại sách */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)' }}>
                  Loại sách:
                </span>
                {([
                  { id: 'ALL', label: '🌟 Tất cả' },
                  { id: 'AUDIO', label: '🎧 Sách nói' },
                  { id: 'READ', label: '📖 Sách giấy/PDF' },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFormat(f.id)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: 6,
                      fontSize: '0.68rem',
                      fontWeight: selectedFormat === f.id ? 800 : 550,
                      border: `1px solid ${selectedFormat === f.id ? '#10b981' : 'transparent'}`,
                      background: selectedFormat === f.id ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      color: selectedFormat === f.id ? '#10b981' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Tabs Điều Hướng */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 4,
                background: 'var(--bg-main)',
                padding: 4,
                borderRadius: 12,
                marginBottom: 14,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('COUNT')}
                style={{
                  padding: '7px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'COUNT' ? 'var(--card-bg)' : 'transparent',
                  color: activeTab === 'COUNT' ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                  fontWeight: 750,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'COUNT' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Target size={13} /> Số Cuốn
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CATEGORY')}
                style={{
                  padding: '7px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'CATEGORY' ? 'var(--card-bg)' : 'transparent',
                  color: activeTab === 'CATEGORY' ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                  fontWeight: 750,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'CATEGORY' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Layers size={13} /> Thể Loại
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('AUTHOR')}
                style={{
                  padding: '7px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'AUTHOR' ? 'var(--card-bg)' : 'transparent',
                  color: activeTab === 'AUTHOR' ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                  fontWeight: 750,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'AUTHOR' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <User size={13} /> Tác Giả
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SEARCH')}
                style={{
                  padding: '7px 4px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'SEARCH' ? 'var(--card-bg)' : 'transparent',
                  color: activeTab === 'SEARCH' ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                  fontWeight: 750,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'SEARCH' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Search size={13} /> Tên Sách
              </button>
            </div>

            {/* TAB 1: CÀO THEO SỐ CUỐN MỤC TIÊU (TARGET COUNT MODE) */}
            {activeTab === 'COUNT' && (
              <div>
                {/* 1. Chọn Số Cuốn Cần Cào */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>
                    1. Nhập số cuốn cần cào (đúng số lượng mới ngừng):
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[5, 10, 20, 30, 50, 100].map((num) => {
                      const isChosen = targetCount === num && !customTargetInput
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setTargetCount(num)
                            setCustomTargetInput('')
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: '0.76rem',
                            fontWeight: isChosen ? 800 : 600,
                            border: `1.5px solid ${isChosen ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                            background: isChosen ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-main)',
                            color: isChosen ? 'var(--primary, #8b5cf6)' : 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          {num} cuốn
                        </button>
                      )
                    })}
                    <input
                      type="number"
                      min={1}
                      max={500}
                      placeholder="Số khác..."
                      value={customTargetInput}
                      onChange={(e) => {
                        setCustomTargetInput(e.target.value)
                        const val = parseInt(e.target.value, 10)
                        if (val > 0) setTargetCount(val)
                      }}
                      style={{
                        width: 80,
                        padding: '6px 8px',
                        borderRadius: 8,
                        border: '1px solid var(--card-border)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '0.76rem',
                      }}
                    />
                  </div>
                </div>

                {/* 2. Phạm Vi Khai Thác */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>
                    2. Phạm vi khai thác:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>
                    {[
                      { id: 'ALL_LIBRARY', label: '🚀 Toàn bộ thư viện (Đa thể loại)', desc: 'Tự động quét kho sách tinh hoa' },
                      { id: 'CATEGORY', label: '🏛️ Theo thể loại', desc: 'Chọn 1 thể loại cụ thể' },
                      { id: 'AUTHOR', label: '✍️ Theo tác giả', desc: 'Nhập tác giả yêu thích' },
                      { id: 'SEARCH', label: '🔍 Theo từ khóa', desc: 'Tìm theo chủ đề bất kỳ' },
                    ].map((scope) => {
                      const isSelected = countScope === scope.id
                      return (
                        <div
                          key={scope.id}
                          onClick={() => setCountScope(scope.id as CrawlerScope)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: `1.5px solid ${isSelected ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                            background: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-main)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '0.76rem', fontWeight: isSelected ? 800 : 650, color: isSelected ? 'var(--primary, #8b5cf6)' : 'var(--text-main)' }}>
                            {scope.label}
                          </div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {scope.desc}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Sub-inputs cho từng Scope */}
                  {countScope === 'CATEGORY' && (
                    <div style={{ maxHeight: 110, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, padding: 4, background: 'var(--bg-main)', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                      {UNIFIED_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCountCategory(cat)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: 6,
                            textAlign: 'left',
                            fontSize: '0.7rem',
                            fontWeight: countCategory.id === cat.id ? 800 : 550,
                            border: 'none',
                            background: countCategory.id === cat.id ? 'var(--primary, #8b5cf6)' : 'transparent',
                            color: countCategory.id === cat.id ? '#fff' : 'var(--text-main)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cat.icon} {cat.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {countScope === 'AUTHOR' && (
                    <div>
                      <input
                        type="text"
                        placeholder="Nhập tên tác giả (vd: Agatha Christie, Dale Carnegie...)..."
                        value={countAuthor}
                        onChange={(e) => setCountAuthor(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--card-border)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          boxSizing: 'border-box',
                          marginBottom: 4,
                        }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {['Agatha Christie', 'Dale Carnegie', 'Thích Nhất Hạnh', 'Higashino Keigo', 'Nguyễn Nhật Ánh'].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setCountAuthor(a)}
                            style={{
                              padding: '2px 6px',
                              borderRadius: 6,
                              fontSize: '0.66rem',
                              border: '1px solid var(--card-border)',
                              background: countAuthor === a ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-main)',
                              color: countAuthor === a ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            ✍️ {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {countScope === 'SEARCH' && (
                    <input
                      type="text"
                      placeholder="Nhập từ khóa chủ đề (vd: Tâm lý, Triết học, Vũ trụ, Kinh tế...)..."
                      value={countSearchQuery}
                      onChange={(e) => setCountSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--card-border)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '0.78rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>

                {/* Nút Bắt Đầu Cào Đúng Số Cuốn */}
                <button
                  type="button"
                  onClick={handleStartCountCrawl}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                  }}
                >
                  <Sparkles size={16} /> Cào đúng {targetCount} cuốn [
                  {selectedFormat === 'AUDIO' ? 'Sách nói' : selectedFormat === 'READ' ? 'Sách giấy/PDF' : 'Tất cả loại sách'}
                  ] từ {selectedSource === 'ALL' ? 'cả 2 nguồn' : selectedSource === 'DILIB' ? 'Dilib.vn' : 'DTV eBook'}
                </button>
              </div>
            )}

            {/* TAB 2: CÀO THEO THỂ LOẠI HỢP NHẤT */}
            {activeTab === 'CATEGORY' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                    1. Chọn thể loại ({filteredCategories.length} mục hợp nhất):
                  </label>
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Lọc thể loại..."
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--card-border)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.7rem',
                      width: 120,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 6,
                    maxHeight: 170,
                    overflowY: 'auto',
                    marginBottom: 12,
                    paddingRight: 2,
                  }}
                >
                  {filteredCategories.map((cat) => {
                    const isSelected = selectedCategory.id === cat.id
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '7px 9px',
                          borderRadius: 10,
                          background: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-main)',
                          border: `1.5px solid ${isSelected ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>{cat.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: isSelected ? 800 : 600,
                              color: isSelected ? 'var(--primary, #8b5cf6)' : 'var(--text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {cat.name}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
                      Số cuốn cần cào:
                    </label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[5, 10, 20, 50].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCategoryTargetCount(n)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.7rem',
                            fontWeight: categoryTargetCount === n ? 800 : 550,
                            border: `1px solid ${categoryTargetCount === n ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                            background: categoryTargetCount === n ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-main)',
                            color: categoryTargetCount === n ? 'var(--primary, #8b5cf6)' : 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
                      Hẹn giờ dừng:
                    </label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[
                        { val: 0, label: 'Tự động' },
                        { val: 2, label: '2p' },
                        { val: 5, label: '5p' },
                      ].map((t) => (
                        <button
                          key={t.val}
                          type="button"
                          onClick={() => setMaxMinutes(t.val)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.7rem',
                            fontWeight: maxMinutes === t.val ? 800 : 550,
                            border: `1px solid ${maxMinutes === t.val ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                            background: maxMinutes === t.val ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-main)',
                            color: maxMinutes === t.val ? 'var(--primary, #8b5cf6)' : 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartCategoryCrawl}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                  }}
                >
                  <Sparkles size={16} /> Bắt đầu cào {categoryTargetCount} cuốn thể loại "{selectedCategory.name}"
                </button>
              </div>
            )}

            {/* TAB 3: CÀO THEO TÁC GIẢ ĐA NGUỒN */}
            {activeTab === 'AUTHOR' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>
                  Nhập tên tác giả (sẽ tự động gợi ý):
                </label>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <User
                    size={16}
                    style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={authorInput}
                    onChange={(e) => setAuthorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && authorInput.trim()) {
                        void handleSelectAuthor(authorInput.trim())
                      }
                    }}
                    placeholder="Nhập tác giả (vd: Agatha Christie, Conan Doyle, Dale Carnegie...)..."
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: 10,
                      border: '1px solid var(--card-border)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Gợi Ý Tác Giả Trực Tiếp */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    💡 Gợi ý tác giả tiêu biểu (bấm để quét cả 2 nguồn):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 80, overflowY: 'auto' }}>
                    {authorSuggestions.slice(0, 18).map((author) => {
                      const isChosen = selectedAuthor === author
                      return (
                        <button
                          key={author}
                          type="button"
                          onClick={() => void handleSelectAuthor(author)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '99px',
                            border: `1px solid ${isChosen ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                            background: isChosen ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-main)',
                            color: isChosen ? 'var(--primary, #8b5cf6)' : 'var(--text-main)',
                            fontSize: '0.72rem',
                            fontWeight: isChosen ? 750 : 550,
                            cursor: 'pointer',
                          }}
                        >
                          ✍️ {author}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Kết quả tìm sách theo tác giả */}
                {isSearchingAuthor ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <Loader2 size={20} className="tv-spin" style={{ margin: '0 auto 6px', display: 'block' }} />
                    Đang tìm sách của tác giả "{selectedAuthor}" từ cả 2 nguồn...
                  </div>
                ) : authorBooks.length > 0 ? (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>
                        Tìm thấy <strong>{authorBooks.length}</strong> cuốn của <b>{selectedAuthor}</b>:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAuthorUrls.size === authorBooks.length) {
                            setSelectedAuthorUrls(new Set())
                          } else {
                            setSelectedAuthorUrls(new Set(authorBooks.map((b) => b.url)))
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary, #8b5cf6)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedAuthorUrls.size === authorBooks.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                      </button>
                    </div>

                    <div style={{ maxHeight: 170, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                      {authorBooks.map((item) => {
                        const isChecked = selectedAuthorUrls.has(item.url)
                        return (
                          <div
                            key={item.url}
                            onClick={() => toggleSelectAuthorUrl(item.url)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '5px 8px',
                              borderRadius: 8,
                              background: isChecked ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-main)',
                              border: `1px solid ${isChecked ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                              cursor: 'pointer',
                            }}
                          >
                            {isChecked ? <CheckSquare size={15} color="var(--primary, #8b5cf6)" /> : <Square size={15} color="var(--text-muted)" />}
                            {item.thumbnail && (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                              />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.title}
                              </div>
                              <span style={{ fontSize: '0.62rem', padding: '0 4px', borderRadius: 4, background: item.source === 'Dilib' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: item.source === 'Dilib' ? '#8b5cf6' : '#10b981', fontWeight: 700 }}>
                                {item.source}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={selectedAuthorUrls.size === 0}
                      onClick={() => void handleStartBatchCrawl(Array.from(selectedAuthorUrls))}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        cursor: selectedAuthorUrls.size === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedAuthorUrls.size === 0 ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 3px 10px rgba(59, 130, 246, 0.3)',
                      }}
                    >
                      <Sparkles size={15} /> Cào {selectedAuthorUrls.size} sách đã chọn của tác giả "{selectedAuthor}"
                    </button>
                  </div>
                ) : selectedAuthor ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Không tìm thấy sách nào của tác giả "{selectedAuthor}".
                  </div>
                ) : null}
              </div>
            )}

            {/* TAB 4: TÌM KIẾM THEO TÊN SÁCH ĐA NGUỒN */}
            {activeTab === 'SEARCH' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>
                  Nhập tên sách (tìm kiếm song song cả 2 nguồn):
                </label>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập tên sách (vd: Án mạng trên chuyến tàu, Đắc nhân tâm, Thiền, Khởi nghiệp...)..."
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: 10,
                      border: '1px solid var(--card-border)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {isSearching ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <Loader2 size={20} className="tv-spin" style={{ margin: '0 auto 6px', display: 'block' }} />
                    Đang tìm kiếm trên Dilib.vn và DTV-eBook...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 10px',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      background: 'var(--bg-main)',
                      borderRadius: 12,
                    }}
                  >
                    {searchQuery ? 'Không tìm thấy sách nào khớp từ cả 2 nguồn' : 'Hãy nhập từ khóa để tìm kiếm sách'}
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>Tìm thấy {searchResults.length} kết quả từ 2 nguồn:</span>
                      {selectedSearchUrls.size > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleStartBatchCrawl(Array.from(selectedSearchUrls))}
                          style={{
                            background: 'var(--primary, #8b5cf6)',
                            color: '#fff',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cào {selectedSearchUrls.size} sách đã chọn
                        </button>
                      )}
                    </div>

                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {searchResults.map((item) => {
                        const isChecked = selectedSearchUrls.has(item.url)
                        return (
                          <div
                            key={item.url}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '6px 8px',
                              borderRadius: 10,
                              background: isChecked ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-main)',
                              border: `1px solid ${isChecked ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectSearchUrl(item.url)}
                              style={{ cursor: 'pointer' }}
                            />
                            {item.thumbnail && (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                style={{ width: 34, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                              />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.title}
                              </div>
                              <span style={{ fontSize: '0.62rem', padding: '0 4px', borderRadius: 4, background: item.source === 'Dilib' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: item.source === 'Dilib' ? '#8b5cf6' : '#10b981', fontWeight: 700 }}>
                                {item.source}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleStartBatchCrawl([item.url])}
                              style={{
                                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                                color: '#fff',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: 8,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              Cào ngay
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
