import { useEffect, useState } from 'react'
import {
  Sparkles, CheckCircle2,
  BookOpen, PauseCircle, Check
} from 'lucide-react'
import {
  mangaChapterCrawler,
  type CrawlerState,
  type MangaCategory,
} from './mangaChapterCrawler'
import { Modal } from '../shared'
import { useNavigate } from 'react-router-dom'

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function categoryDisplayName(cat: MangaCategory): string {
  switch (cat) {
    case 'h':
      return 'Truyện H'
    case 'bl':
      return 'Truyện BL (Boylove)'
    case 'ngontinh':
      return 'Truyện Ngôn Tình'
    default:
      return 'Truyện'
  }
}

export function categoryRoute(cat: MangaCategory, slug: string): string {
  switch (cat) {
    case 'h':
      return `/truyenh/${slug}`
    case 'bl':
      return `/bl/${slug}`
    case 'ngontinh':
      return `/ngontinh/${slug}`
    default:
      return `/manga/${slug}`
  }
}

export function CrawlChaptersModal({
  isOpen,
  onClose,
  category,
  totalItemsCount = 0,
}: {
  isOpen: boolean
  onClose: () => void
  category: MangaCategory
  totalItemsCount?: number
}) {
  const [starting, setStarting] = useState(false)

  if (!isOpen) return null

  const handleStart = () => {
    setStarting(true)
    onClose()
    void mangaChapterCrawler.startCrawl(category)
  }

  return (
    <Modal title="⚡ Cào thêm chapter cho truyện đã có" onClose={onClose}>
      <div style={{ padding: '4px 0 8px', color: 'var(--text-main)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(147, 51, 234, 0.08))',
            borderRadius: 14,
            border: '1px solid rgba(59, 130, 246, 0.2)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Cập nhật chapter mới tự động
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Hệ thống sẽ kiểm tra từng bộ truyện trong kho {categoryDisplayName(category)} ({totalItemsCount > 0 ? `${totalItemsCount} bộ` : 'toàn bộ'}).
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-main)', marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px' }}>
            Sau khi nhấn <strong>OK</strong>, tiến trình cào sẽ <strong>tự động chạy nền</strong> trong tối đa <strong>5 phút</strong>.
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 20, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <li>Bạn có thể tiếp tục đọc truyện hoặc chuyển trang bình thường.</li>
            <li>Hết 5 phút (hoặc khi hoàn tất), hệ thống sẽ hiển thị <strong>bảng báo cáo</strong> các chapter mới cào được ngay trên màn hình.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="tv-btn"
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 10, fontWeight: 600 }}
          >
            Hủy
          </button>
          <button
            type="button"
            className="tv-btn primary"
            onClick={handleStart}
            disabled={starting}
            style={{
              padding: '9px 24px',
              borderRadius: 10,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Check size={16} /> OK (Bắt đầu chạy nền)
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Hiển thị thanh tiến độ nền nổi (Floating progress) & Bảng báo cáo sau 5 phút
 */
export function GlobalCrawlerWatcher() {
  const [crawlerState, setCrawlerState] = useState<CrawlerState>(mangaChapterCrawler.getState())
  const navigate = useNavigate()

  useEffect(() => {
    return mangaChapterCrawler.subscribe((state) => {
      setCrawlerState(state)
    })
  }, [])

  const report = crawlerState.lastReport

  return (
    <>
      {/* Floating progress pill khi đang chạy nền */}
      {crawlerState.isRunning && (
        <div
          style={{
            position: 'fixed',
            left: 20,
            bottom: 24,
            zIndex: 9000,
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 16,
            padding: '10px 16px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 'calc(100vw - 40px)',
            backdropFilter: 'blur(12px)',
            animation: 'fadeInUp 0.3s ease',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Sparkles size={16} className="tv-spin" />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
              <span>Đang cào nền ({formatTime(crawlerState.elapsedSeconds)} / 05:00)</span>
              {crawlerState.newChaptersFound > 0 && (
                <span style={{ color: '#10b981', fontWeight: 800 }}>+{crawlerState.newChaptersFound} chap mới</span>
              )}
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 240,
                marginTop: 2,
              }}
            >
              {crawlerState.scannedCount > 0 ? `[${crawlerState.scannedCount}/${crawlerState.totalCount}] ` : ''}
              {crawlerState.currentTitle || 'Đang quét...'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => mangaChapterCrawler.stop()}
            title="Dừng tiến trình cào"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: 'none',
              borderRadius: 8,
              padding: '5px 9px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            <PauseCircle size={14} /> Dừng
          </button>
        </div>
      )}

      {/* Modal Báo cáo kết quả cào sau 5 phút / khi hoàn tất */}
      {report && (
        <Modal
          title={report.isTimedOut ? '⏱️ Báo cáo cào chapter (Hết 5 phút)' : '🎉 Báo cáo cào chapter hoàn tất'}
          onClose={() => mangaChapterCrawler.clearReport()}
        >
          <div style={{ padding: '4px 0 10px', color: 'var(--text-main)' }}>
            {/* Header Thống kê */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                  border: '1px solid var(--card-border)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Thời gian cào</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                  {formatTime(report.durationSeconds)}
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                  border: '1px solid var(--card-border)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Truyện đã quét</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
                  {report.totalScanned} bộ
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                  border: '1px solid var(--card-border)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Chapter mới</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                  +{report.totalNewChapters} chap
                </div>
              </div>
            </div>

            {/* Chi tiết danh sách truyện được cập nhật */}
            {report.updatedItems.length > 0 ? (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
                  Danh sách {report.updatedItems.length} bộ truyện có chapter mới:
                </div>
                <div
                  style={{
                    maxHeight: 260,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    paddingRight: 4,
                  }}
                >
                  {report.updatedItems.map((item) => (
                    <div
                      key={item.slug}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, marginTop: 2 }}>
                          +{item.addedCount} chapter mới ({item.oldCount} → {item.newCount} chương)
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          mangaChapterCrawler.clearReport()
                          navigate(categoryRoute(item.category, item.slug))
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--primary)',
                          border: 'none',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <BookOpen size={12} /> Đọc ngay
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  textAlign: 'center',
                  color: '#059669',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#10b981' }} />
                Tất cả các bộ truyện đã quét đều đang ở chapter mới nhất, không có chương mới từ nguồn.
              </div>
            )}

            {/* Nút OK để tắt báo cáo */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="tv-btn primary"
                onClick={() => mangaChapterCrawler.clearReport()}
                style={{
                  padding: '9px 26px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                OK (Đóng)
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
