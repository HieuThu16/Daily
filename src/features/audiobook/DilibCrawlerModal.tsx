import { useState, useRef, useEffect } from 'react'
import {
  Search,
  Sparkles,
  Loader2,
  Layers,
  StopCircle,
} from 'lucide-react'
import { Modal } from '../shared'
import {
  DILIB_CATEGORIES,
  searchDilib,
  crawlDilib,
  fetchDilibDetail,
  saveDilibBook,
  type DilibSearchResult,
  type CrawlReport,
} from '../../lib/dilibCrawler'
import type { DilibCategory } from '../../types/audiobook'
import { useToast } from '../ToastContext'

export function DilibCrawlerModal({
  isOpen,
  onClose,
  onFinished,
  initialMode = 'CATEGORY',
}: {
  isOpen: boolean
  onClose: () => void
  onFinished?: () => void
  initialMode?: 'CATEGORY' | 'SEARCH'
}) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'CATEGORY' | 'SEARCH'>(initialMode)
  const [selectedCategory, setSelectedCategory] = useState<DilibCategory>(DILIB_CATEGORIES[0])
  const [maxMinutes, setMaxMinutes] = useState<number>(3)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<DilibSearchResult[]>([])
  const [selectedSearchUrls, setSelectedSearchUrls] = useState<Set<string>>(new Set())

  // Crawling state
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawlProgress, setCrawlProgress] = useState<{
    scanned: number
    addedAudio: number
    addedPdf: number
    currentBook?: string
    statusMessage: string
    elapsedSeconds: number
    remainingSeconds: number
  } | null>(null)
  const [crawlReport, setCrawlReport] = useState<CrawlReport | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Xử lý tìm kiếm
  useEffect(() => {
    if (activeTab !== 'SEARCH') return
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchDilib(q)
      setSearchResults(res)
      setIsSearching(false)
    }, 350)

    return () => clearTimeout(timer)
  }, [searchQuery, activeTab])

  // Bắt đầu cào danh mục
  const handleStartCategoryCrawl = async () => {
    setIsCrawling(true)
    setCrawlReport(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const report = await crawlDilib({
        category: selectedCategory,
        maxMinutes,
        signal: controller.signal,
        onProgress: (p) => setCrawlProgress(p),
      })
      setCrawlReport(report)
      showToast(`🎉 Cào hoàn tất! Đã thêm ${report.audiobooksAdded} Sách nói & ${report.booksPdfAdded} Sách PDF.`)
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

  // Bắt đầu cào sách đã chọn từ tìm kiếm
  const handleStartSearchCrawl = async (urlsToCrawl: string[]) => {
    if (urlsToCrawl.length === 0) {
      showToast('Vui lòng chọn ít nhất một cuốn sách để cào', 'info')
      return
    }

    setIsCrawling(true)
    setCrawlReport(null)
    const startTime = Date.now()
    let scanned = 0
    let addedAudio = 0
    let addedPdf = 0
    let totalAudioFiles = 0
    const itemsReport: CrawlReport['items'] = []

    try {
      for (const url of urlsToCrawl) {
        scanned++
        setCrawlProgress({
          scanned,
          addedAudio,
          addedPdf,
          currentBook: url,
          statusMessage: `Đang bóc tách sách (${scanned}/${urlsToCrawl.length})...`,
          elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
          remainingSeconds: 0,
        })

        const detail = await fetchDilibDetail(url)
        if (detail) {
          const res = await saveDilibBook(detail)
          if (res.addedAudio) {
            addedAudio++
            totalAudioFiles += detail.audioTracks.length
          }
          if (res.addedPdf) addedPdf++

          itemsReport.push({
            title: detail.title,
            author: detail.author,
            hasAudio: detail.hasAudio,
            hasPdf: detail.hasPdf,
            audioCount: detail.audioTracks.length,
            readbookUrl: detail.readbookUrl,
          })
        }
        await new Promise((r) => setTimeout(r, 60))
      }

      const report: CrawlReport = {
        totalScanned: scanned,
        audiobooksAdded: addedAudio,
        booksPdfAdded: addedPdf,
        totalAudioFiles,
        durationSeconds: Math.floor((Date.now() - startTime) / 1000),
        items: itemsReport,
      }
      setCrawlReport(report)
      showToast(`🎉 Đã cào xong ${report.audiobooksAdded} Sách nói & ${report.booksPdfAdded} Sách PDF.`)
      onFinished?.()
    } catch (err: any) {
      showToast(`❌ Lỗi cào sách: ${err?.message || err}`, 'error')
    } finally {
      setIsCrawling(false)
      setCrawlProgress(null)
    }
  }

  // Dừng cào
  const handleStopCrawl = () => {
    abortControllerRef.current?.abort()
    setIsCrawling(false)
    showToast('Đã dừng cào sách.', 'info')
  }

  const toggleSelectUrl = (url: string) => {
    setSelectedSearchUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  if (!isOpen) return null

  return (
    <Modal title="🕷️ Cào Sách & Sách Nói (Dilib.vn)" onClose={onClose}>
      <div className="dilib-crawler-modal-wrap" style={{ minWidth: 320, maxWidth: 640 }}>
        {/* Đang Cào (Live Crawling View) */}
        {isCrawling && crawlProgress ? (
          <div className="dilib-crawling-card" style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div className="dilib-spinner-glow" style={{ margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
              <Loader2 size={36} className="tv-spin" color="var(--primary, #8b5cf6)" />
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800 }}>Đang Cào Dữ Liệu Từ Dilib.vn</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 16px' }}>
              {crawlProgress.statusMessage}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                background: 'var(--bg-main)',
                padding: '12px 10px',
                borderRadius: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary, #8b5cf6)' }}>
                  {crawlProgress.scanned}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Đã quét</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b' }}>
                  🎧 {crawlProgress.addedAudio}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sách nói</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>
                  📖 {crawlProgress.addedPdf}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sách PDF</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                ⏱️ Đã chạy: <strong>{crawlProgress.elapsedSeconds}s</strong>
              </span>
              {crawlProgress.remainingSeconds < 9000 && (
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
                padding: '8px 20px',
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
          /* Báo Cáo Kết Quả Cào (Crawl Summary Report) */
          <div className="dilib-report-card" style={{ padding: '10px 4px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '2rem', marginBottom: 4 }}>🎉</div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800 }}>Báo Cáo Kết Quả Cào</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                Thời gian thực hiện: {crawlReport.durationSeconds} giây
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
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{crawlReport.totalScanned}</div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Tổng quét</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
                  {crawlReport.audiobooksAdded}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Sách nói</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                  {crawlReport.booksPdfAdded}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Sách PDF</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#06b6d4' }}>
                  {crawlReport.totalAudioFiles}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>File Audio</div>
              </div>
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main)' }}>
                Chi tiết các đầu sách thu thập ({crawlReport.items.length}):
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
                      padding: '8px 10px',
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
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{item.author}</div>
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
                          🎧 {item.audioCount} phần
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
                          📖 PDF
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
          /* Màn Hình Thiết Lập & Lựa Chọn Cào */
          <div>
            {/* Tabs chuyển đổi */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                background: 'var(--bg-main)',
                padding: 4,
                borderRadius: 12,
                marginBottom: 14,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('CATEGORY')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'CATEGORY' ? 'var(--card-bg)' : 'transparent',
                  color: activeTab === 'CATEGORY' ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'CATEGORY' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Layers size={14} /> Cào Theo Thể Loại
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SEARCH')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'SEARCH' ? 'var(--card-bg)' : 'transparent',
                  color: activeTab === 'SEARCH' ? 'var(--primary, #8b5cf6)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'SEARCH' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Search size={14} /> Tìm Kiếm & Cào Đúng Quyển
              </button>
            </div>

            {/* TAB 1: CÀO THEO THỂ LOẠI */}
            {activeTab === 'CATEGORY' ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>
                  1. Chọn thể loại sách muốn cào:
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    marginBottom: 14,
                    paddingRight: 2,
                  }}
                >
                  {DILIB_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory.id === cat.id
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-main)',
                          border: `1.5px solid ${isSelected ? 'var(--primary, #8b5cf6)' : 'var(--card-border)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: isSelected ? 800 : 600,
                            color: isSelected ? 'var(--primary, #8b5cf6)' : 'var(--text-main)',
                          }}
                        >
                          {cat.name}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>
                  2. Hẹn giờ cào (tự động dừng khi hết giờ):
                </label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                  {[
                    { val: 1, label: '1 phút' },
                    { val: 3, label: '3 phút (Khuyên dùng)' },
                    { val: 5, label: '5 phút' },
                    { val: 10, label: '10 phút' },
                    { val: 0, label: 'Không giới hạn' },
                  ].map((t) => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setMaxMinutes(t.val)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                        fontWeight: 700,
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

                <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    💡 <strong>Cơ chế thông minh:</strong> Hệ thống tự động kiểm tra nguồn Dilib: nếu có Sách Nói (audio
                    mp3) thì lưu vào tab <strong>Sách Nói</strong>, nếu có PDF thì lưu vào tab <strong>Sách</strong>, có
                    cả hai thì lưu cả hai!
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
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                  }}
                >
                  <Sparkles size={17} /> Bắt đầu cào thể loại "{selectedCategory.name}"
                </button>
              </div>
            ) : (
              /* TAB 2: TÌM KIẾM & CÀO ĐÚNG QUYỂN */
              <div>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập tên sách (vd: Đắc nhân tâm, Khởi nghiệp, Thiền...)..."
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
                    Đang tìm kiếm trên Dilib.vn...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '30px 10px',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      background: 'var(--bg-main)',
                      borderRadius: 12,
                    }}
                  >
                    {searchQuery ? 'Không tìm thấy sách nào khớp trên Dilib.vn' : 'Hãy nhập từ khóa để tìm kiếm sách'}
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
                      <span style={{ color: 'var(--text-muted)' }}>Tìm thấy {searchResults.length} kết quả:</span>
                      {selectedSearchUrls.size > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleStartSearchCrawl(Array.from(selectedSearchUrls))}
                          style={{
                            background: 'var(--primary, #8b5cf6)',
                            color: '#fff',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cào {selectedSearchUrls.size} sách đã chọn
                        </button>
                      )}
                    </div>

                    <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                              onChange={() => toggleSelectUrl(item.url)}
                              style={{ cursor: 'pointer' }}
                            />
                            {item.thumbnail && (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
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
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleStartSearchCrawl([item.url])}
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
