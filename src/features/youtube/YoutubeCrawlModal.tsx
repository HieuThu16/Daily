import { useState, useMemo, useEffect } from 'react'
import {
  Clock, Radio, Check, CheckCircle2,
  Search, PauseCircle,
  Video, Tag, Layers, CheckSquare, Square,
} from 'lucide-react'
import {
  youtubeChannelCrawler,
  type YoutubeCrawlerState,
  type YoutubeCrawlChannelTarget,
} from './youtubeChannelCrawler'
import { type ChannelItem } from './YoutubeView'
import { Modal } from '../shared'

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const DURATION_PRESETS = [
  { value: 5, label: '5 phút' },
  { value: 10, label: '10 phút' },
  { value: 15, label: '15 phút', isDefault: true },
  { value: 30, label: '30 phút' },
  { value: 60, label: '60 phút' },
  { value: 0, label: 'Không giới hạn' },
]

export function YoutubeCrawlModal({
  isOpen,
  onClose,
  channels,
}: {
  isOpen: boolean
  onClose: () => void
  channels: ChannelItem[]
}) {
  const [durationMinutes, setDurationMinutes] = useState<number>(15)
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false)
  const [customInputMinutes, setCustomInputMinutes] = useState<string>('20')
  const [searchChannel, setSearchChannel] = useState<string>('')
  const [selectedChannelUrls, setSelectedChannelUrls] = useState<Set<string>>(() => {
    return new Set(channels.map((c) => c.creator_url).filter(Boolean))
  })

  // Cập nhật mặc định chọn tất cả khi danh sách kênh thay đổi
  useEffect(() => {
    if (channels.length > 0) {
      setSelectedChannelUrls(new Set(channels.map((c) => c.creator_url).filter(Boolean)))
    }
  }, [channels])

  const filteredChannels = useMemo(() => {
    const q = searchChannel.toLowerCase().trim()
    if (!q) return channels
    return channels.filter(
      (c) =>
        c.creator_name.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.tag && c.tag.toLowerCase().includes(q)),
    )
  }, [channels, searchChannel])

  const toggleChannel = (url: string) => {
    setSelectedChannelUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedChannelUrls(new Set(channels.map((c) => c.creator_url).filter(Boolean)))
  }

  const handleDeselectAll = () => {
    setSelectedChannelUrls(new Set())
  }

  const effectiveDuration = isCustomDuration
    ? Math.max(1, parseInt(customInputMinutes, 10) || 15)
    : durationMinutes

  if (!isOpen) return null

  const handleStart = () => {
    const targets: YoutubeCrawlChannelTarget[] = channels
      .filter((c) => selectedChannelUrls.has(c.creator_url))
      .map((c) => ({
        id: c.id,
        creator_url: c.creator_url,
        creator_name: c.creator_name,
        creator_id: c.creator_id,
        category: c.category,
        tag: c.tag,
        cover: c.cover,
        videoCount: c.videoCount,
        sourceTable: c.sourceTable,
      }))

    if (targets.length === 0) return

    onClose()
    void youtubeChannelCrawler.startCrawl(targets, {
      durationMinutes: effectiveDuration,
    })
  }

  return (
    <Modal title="📺 Cào video mới cho kênh YouTube" onClose={onClose}>
      <div style={{ padding: '4px 0 8px', color: 'var(--text-main)' }}>
        {/* Banner giới thiệu */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(249, 115, 22, 0.08))',
            borderRadius: 14,
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Radio size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Cập nhật video mới tự động
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Các video mới cào sẽ tự động đưa đúng vào <strong>Thể loại</strong> và <strong>Tag</strong> của kênh đó.
            </div>
          </div>
        </div>

        {/* 1. Chọn thời gian cào */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
            <Clock size={15} color="#ef4444" />
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
                    borderColor: isSelected ? 'rgba(239, 68, 68, 0.5)' : 'var(--card-border, rgba(255,255,255,0.1))',
                    background: isSelected ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2))' : 'var(--card-bg, #18181b)',
                    color: isSelected ? '#ef4444' : 'var(--text-main)',
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
                borderColor: isCustomDuration ? 'rgba(239, 68, 68, 0.5)' : 'var(--card-border, rgba(255,255,255,0.1))',
                background: isCustomDuration ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2))' : 'var(--card-bg, #18181b)',
                color: isCustomDuration ? '#ef4444' : 'var(--text-main)',
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
                max="300"
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

        {/* 2. Chọn kênh (Có thể chọn tất cả) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
              <Video size={15} color="#3b82f6" />
              <span>Chọn kênh để cào (Đã chọn {selectedChannelUrls.size}/{channels.length}):</span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: '#3b82f6',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckSquare size={13} /> Tất cả
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-muted)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Square size={13} /> Bỏ chọn
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm kênh */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm kênh, thể loại hoặc tag..."
              value={searchChannel}
              onChange={(e) => setSearchChannel(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: 8,
                border: '1px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
              }}
            />
          </div>

          {/* Danh sách kênh */}
          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '6px 4px 6px 0',
            }}
          >
            {filteredChannels.map((ch) => {
              const isChecked = selectedChannelUrls.has(ch.creator_url)
              return (
                <div
                  key={ch.id || ch.creator_url}
                  onClick={() => toggleChannel(ch.creator_url)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid',
                    borderColor: isChecked ? 'rgba(59, 130, 246, 0.4)' : 'var(--card-border, rgba(255,255,255,0.06))',
                    background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'var(--card-bg, #18181b)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        border: isChecked ? 'none' : '1.5px solid var(--text-muted)',
                        background: isChecked ? '#3b82f6' : 'transparent',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {isChecked && <Check size={12} strokeWidth={3} />}
                    </div>

                    {ch.cover ? (
                      <img
                        src={ch.cover}
                        alt=""
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.1)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '0.75rem',
                          flexShrink: 0,
                        }}
                      >
                        📺
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ch.creator_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        {ch.category && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 600 }}>
                            <Layers size={10} style={{ display: 'inline', marginRight: 2 }} />
                            {ch.category}
                          </span>
                        )}
                        {ch.tag && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: 600 }}>
                            <Tag size={10} style={{ display: 'inline', marginRight: 2 }} />
                            #{ch.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                    {ch.videoCount || 0} video
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. Cơ chế tự động */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
            border: '1px solid var(--card-border)',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          <div>
            💾 <strong>Lưu tức thì:</strong> Cào tới đâu lưu tới đó, dừng lúc nào lưu lúc đó không mất dữ liệu.
          </div>
          <div style={{ marginTop: 3 }}>
            🏷️ <strong>Tự động phân loại:</strong> Video mới cào sẽ tự động xuất hiện đúng mục Thể loại & Tag của kênh.
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
            disabled={selectedChannelUrls.size === 0}
            style={{
              padding: '9px 24px',
              borderRadius: 10,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              cursor: selectedChannelUrls.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedChannelUrls.size === 0 ? 0.5 : 1,
            }}
          >
            <Check size={16} /> Bắt đầu cào ({selectedChannelUrls.size} kênh • {effectiveDuration > 0 ? `${effectiveDuration} phút` : 'Không giới hạn'})
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Hiển thị thanh tiến độ nền nổi (Floating progress) & Bảng báo cáo sau khi hoàn tất
 */
export function GlobalYoutubeCrawlerWatcher({ onFinished }: { onFinished?: () => void }) {
  const [crawlerState, setCrawlerState] = useState<YoutubeCrawlerState>(youtubeChannelCrawler.getState())

  useEffect(() => {
    return youtubeChannelCrawler.subscribe((state) => {
      setCrawlerState(state)
    })
  }, [])

  const report = crawlerState.lastReport
  const targetLabel = crawlerState.targetDurationMinutes > 0
    ? `${crawlerState.targetDurationMinutes}:00`
    : '∞'

  const handleCloseReport = () => {
    youtubeChannelCrawler.clearReport()
    onFinished?.()
  }

  return (
    <>
      {/* Floating progress pill khi đang chạy nền */}
      {crawlerState.isRunning && (
        <div
          style={{
            position: 'fixed',
            right: 20,
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
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Radio size={16} className="tv-spin" />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
              <span>Đang cào YouTube ({formatTime(crawlerState.elapsedSeconds)} / {targetLabel})</span>
              {crawlerState.newVideosFound > 0 && (
                <span style={{ color: '#10b981', fontWeight: 800 }}>+{crawlerState.newVideosFound} video mới</span>
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
              {crawlerState.totalChannels > 0 ? `[Kênh ${crawlerState.currentChannelIndex}/${crawlerState.totalChannels}] ` : ''}
              {crawlerState.currentChannelName || 'Đang quét...'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => youtubeChannelCrawler.stop()}
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

      {/* Modal Báo cáo kết quả cào YouTube */}
      {report && (
        <Modal
          title={
            report.isStoppedByUser
              ? '⏱️ Báo cáo cào kênh YouTube (Đã dừng giữa chừng)'
              : report.isTimedOut
                ? `⏱️ Báo cáo cào kênh YouTube (Hết ${report.targetDurationMinutes} phút)`
                : '🎉 Báo cáo cào kênh YouTube hoàn tất'
          }
          onClose={handleCloseReport}
        >
          <div style={{ padding: '4px 0 10px', color: 'var(--text-main)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Dữ liệu video cào đến đâu đã được hệ thống <strong>tự động lưu vào đúng thể loại và tag của từng kênh</strong>:
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
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Kênh đã quét</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444', marginTop: 2 }}>
                  {report.totalChannelsScanned} / {report.totalChannelsTargeted} kênh
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
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Video mới</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                  +{report.totalNewVideos} video
                </div>
              </div>
            </div>

            {/* Chi tiết danh sách từng kênh */}
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
              Chi tiết video mới theo từng kênh:
            </div>

            <div
              style={{
                maxHeight: 280,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                paddingRight: 4,
              }}
            >
              {report.channelResults.map((ch) => (
                <div
                  key={ch.creatorUrl || ch.channelName}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {ch.cover ? (
                      <img
                        src={ch.cover}
                        alt=""
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.1)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '0.8rem',
                          flexShrink: 0,
                        }}
                      >
                        📺
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ch.channelName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        {ch.category && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 600 }}>
                            <Layers size={10} style={{ display: 'inline', marginRight: 2 }} />
                            {ch.category}
                          </span>
                        )}
                        {ch.tag && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: 600 }}>
                            <Tag size={10} style={{ display: 'inline', marginRight: 2 }} />
                            #{ch.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {ch.newVideosCount > 0 ? (
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#10b981' }}>
                        +{ch.newVideosCount} video
                      </div>
                    ) : ch.status === 'error' ? (
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#ef4444' }}>
                        Lỗi quét
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Đã mới nhất
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Nút OK để tắt báo cáo */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="tv-btn primary"
                onClick={handleCloseReport}
                style={{
                  padding: '9px 26px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #ef4444, #f97316)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 4 }} />
                OK (Đóng)
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
