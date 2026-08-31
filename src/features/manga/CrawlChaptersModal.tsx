import { useEffect, useState, useMemo } from 'react'
import {
  Sparkles, CheckCircle2,
  BookOpen, PauseCircle, Check,
  Clock, ShieldCheck, History,
} from 'lucide-react'
import {
  mangaChapterCrawler,
  type CrawlerState,
  type MangaCategory,
} from './mangaChapterCrawler'
import { getCrawlStats } from './mangaCrawlHistory'
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

const DURATION_PRESETS = [
  { value: 5, label: '5 phút' },
  { value: 10, label: '10 phút' },
  { value: 15, label: '15 phút', isDefault: true },
  { value: 30, label: '30 phút' },
  { value: 60, label: '60 phút' },
  { value: 0, label: 'Không giới hạn' },
]

const SKIP_PRESETS = [
  { value: 1, label: '1 giờ qua' },
  { value: 6, label: '6 giờ qua', isDefault: true },
  { value: 24, label: '24 giờ qua' },
  { value: 0, label: 'Không né (Cào từ cũ nhất)' },
]

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
  const [durationMinutes, setDurationMinutes] = useState<number>(15)
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false)
  const [customInputMinutes, setCustomInputMinutes] = useState<string>('20')
  const [skipHours, setSkipHours] = useState<number>(6)
  const [starting, setStarting] = useState<boolean>(false)

  const effectiveDuration = isCustomDuration
    ? Math.max(1, parseInt(customInputMinutes, 10) || 15)
    : durationMinutes

  const stats = useMemo(
    () => getCrawlStats(category, totalItemsCount, skipHours),
    [category, totalItemsCount, skipHours],
  )

  if (!isOpen) return null

  const handleStart = () => {
    setStarting(true)
    onClose()
    void mangaChapterCrawler.startCrawl(category, {
      durationMinutes: effectiveDuration,
      skipHours,
    })
  }

  return (
    <Modal title="⚡ Cào thêm chapter cho truyện đã có" onClose={onClose}>
      <div style={{ padding: '4px 0 8px', color: 'var(--text-main)' }}>
        {/* Banner giới thiệu */}
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
              Cập nhật chapter mới tự động cho {categoryDisplayName(category)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Hệ thống tự động chạy nền, ưu tiên quét truyện cào lâu nhất và lưu vào <strong>"Vừa cào gần đây"</strong>.
            </div>
          </div>
        </div>

        {/* 1. Chọn thời gian cào */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
            <Clock size={15} color="#3b82f6" />
            <span>Bạn muốn cào trong bao lâu?</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {DURATION_PRESETS.map((preset) => {
              const isSelected = !isCustomDuration && durationMinutes === preset.value
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setIsCustomDuration(false)
                    setDurationMinutes(preset.value)
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 10,
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    border: '1px solid',
                    borderColor: isSelected ? 'rgba(59, 130, 246, 0.5)' : 'var(--card-border, rgba(255,255,255,0.1))',
                    background: isSelected ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))' : 'var(--card-bg, #18181b)',
                    color: isSelected ? '#3b82f6' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset.label} {preset.isDefault ? '(Mặc định)' : ''}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setIsCustomDuration(true)}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                fontSize: '0.8rem',
                fontWeight: isCustomDuration ? 700 : 500,
                border: '1px solid',
                borderColor: isCustomDuration ? 'rgba(59, 130, 246, 0.5)' : 'var(--card-border, rgba(255,255,255,0.1))',
                background: isCustomDuration ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))' : 'var(--card-bg, #18181b)',
                color: isCustomDuration ? '#3b82f6' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Tùy chỉnh phút
            </button>
          </div>

          {isCustomDuration && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 12px', background: 'var(--bg-subtle, rgba(0,0,0,0.03))', borderRadius: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nhập số phút chạy:</span>
              <input
                type="number"
                min="1"
                max="240"
                value={customInputMinutes}
                onChange={(e) => setCustomInputMinutes(e.target.value)}
                style={{
                  width: 80,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>phút</span>
            </div>
          )}
        </div>

        {/* 2. Bộ lọc né truyện đã cào gần đây */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
            <ShieldCheck size={15} color="#10b981" />
            <span>Né các truyện đã cào gần nhất:</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SKIP_PRESETS.map((preset) => {
              const isSelected = skipHours === preset.value
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSkipHours(preset.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    border: '1px solid',
                    borderColor: isSelected ? 'rgba(16, 185, 129, 0.5)' : 'var(--card-border, rgba(255,255,255,0.1))',
                    background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--card-bg, #18181b)',
                    color: isSelected ? '#10b981' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Thẻ thông tin cơ chế thông minh & thống kê */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
            border: '1px solid var(--card-border)',
            marginBottom: 20,
            fontSize: '0.78rem',
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            <History size={14} color="#8b5cf6" />
            <span>Chiến lược quét tối ưu:</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)' }}>
            <li>
              <strong>Ưu tiên cao nhất:</strong> Quét trước các bộ truyện <strong>chưa từng cào</strong> hoặc <strong>lần cào cuối cách đây lâu nhất</strong>.
            </li>
            <li>
              <strong>Tránh quét trùng:</strong> {skipHours > 0 ? `Đã né ${stats.crawledRecently} bộ truyện vừa cào trong ${skipHours}h qua.` : 'Quét toàn bộ theo thứ tự cũ nhất.'}
            </li>
            <li>
              <strong>Lưu tự động:</strong> Mọi truyện quét xong và có chapter mới sẽ được lưu ngay vào mục <strong>"Vừa cào gần đây"</strong>.
            </li>
          </ul>

          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--card-border)',
              fontSize: '0.76rem',
              color: 'var(--text-main)',
            }}
          >
            <span>Tổng kho: <strong>{stats.total} bộ</strong></span>
            {skipHours > 0 && <span style={{ color: '#f59e0b' }}>Né qua: <strong>{stats.crawledRecently} bộ</strong></span>}
            <span style={{ color: '#10b981' }}>Ưu tiên lượt này: <strong>{stats.priorityCount} bộ</strong></span>
          </div>
        </div>

        {/* Nút hành động */}
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
            <Check size={16} /> Bắt đầu cào {effectiveDuration > 0 ? `(${effectiveDuration} phút)` : '(Không giới hạn)'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Hiển thị thanh tiến độ nền nổi (Floating progress) & Bảng báo cáo sau khi hoàn tất
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
  const targetLabel = crawlerState.targetDurationMinutes > 0
    ? `${crawlerState.targetDurationMinutes}:00`
    : '∞'

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
            background: 'var(--card-bg, #18181b)',
            border: '1px solid var(--card-border, rgba(255,255,255,0.15))',
            borderRadius: 16,
            padding: '10px 16px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
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
              <span>Đang cào nền ({formatTime(crawlerState.elapsedSeconds)} / {targetLabel})</span>
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

      {/* Modal Báo cáo kết quả cào */}
      {report && (
        <Modal
          title={
            report.isStoppedByUser
              ? '⏱️ Báo cáo cào chapter (Đã dừng giữa chừng)'
              : report.isTimedOut
                ? `⏱️ Báo cáo cào chapter (Hết ${report.targetDurationMinutes} phút)`
                : '🎉 Báo cáo cào chapter hoàn tất'
          }
          onClose={() => mangaChapterCrawler.clearReport()}
        >
          <div style={{ padding: '4px 0 10px', color: 'var(--text-main)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Dữ liệu cào đến đâu đã được hệ thống <strong>tự động lưu vào lịch sử "Vừa cào gần đây"</strong>. Bạn có thể mở đọc ngay các chapter mới bên dưới:
            </div>
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
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary, #3b82f6)', marginTop: 2 }}>
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
                        background: 'var(--card-bg, #18181b)',
                        border: '1px solid var(--card-border, rgba(255,255,255,0.1))',
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
                          color: 'var(--primary, #3b82f6)',
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
