import { useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { getVideoWatchLogs } from '../lib/videoWatchLog'
import { getMangaReadingLogs } from '../lib/mangaReadingLog'
import { getBookReadingSessionLogs } from '../lib/bookReadingLog'
import { getLocalProgress } from '../lib/videoProgress'
import { buildUsageStats, formatMinutes, sinceDate, type UsageSectionKey } from '../lib/usageStats'

const RANGES = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 0, label: 'Tất cả' },
]

const SECTION_COLOR: Record<UsageSectionKey, string> = {
  youtube: '#f43f5e',
  bl: '#a855f7',
  ngontinh: '#ec4899',
  truyenh: '#ef4444',
  books: '#6366f1',
}

const ITEMS_PER_STEP = 8

/** Xem mình đổ thời gian vào mục nào, video nào, truyện nào. */
export function UsageStatsPage() {
  const [days, setDays] = useState(30)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['youtube']))
  const [shownCount, setShownCount] = useState<Record<string, number>>({})

  const stats = useMemo(
    () =>
      buildUsageStats({
        videoLogs: getVideoWatchLogs(),
        mangaLogs: getMangaReadingLogs(),
        bookLogs: getBookReadingSessionLogs(),
        videoProgress: getLocalProgress(),
        from: sinceDate(days),
      }),
    [days],
  )

  const toggle = (key: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="usage-page">
      <header className="usage-head">
        <div className="usage-head-title">
          <span className="usage-head-icon"><BarChart3 size={18} /></span>
          <div>
            <h2>Thống kê</h2>
            <p>Thời gian đã bỏ vào từng mục của app</p>
          </div>
        </div>
        <div className="usage-ranges">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className={days === r.days ? 'on' : ''}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="usage-total">
        <Clock size={16} />
        <strong>{formatMinutes(stats.totalMinutes)}</strong>
        <span>trong {days === 0 ? 'toàn bộ lịch sử' : `${days} ngày qua`}</span>
      </div>

      {stats.sections.length === 0 ? (
        <p className="usage-empty">Chưa có dữ liệu nào trong khoảng này. Xem video hoặc đọc truyện rồi quay lại.</p>
      ) : (
        <div className="usage-sections">
          {stats.sections.map((section) => {
            const share = stats.totalMinutes > 0 ? Math.round((section.minutes / stats.totalMinutes) * 100) : 0
            const open = openSections.has(section.key)
            const limit = shownCount[section.key] ?? ITEMS_PER_STEP
            const color = SECTION_COLOR[section.key]

            return (
              <section key={section.key} className="usage-section">
                <button type="button" className="usage-section-head" onClick={() => toggle(section.key)}>
                  {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className="usage-dot" style={{ background: color }} />
                  <span className="usage-section-name">{section.label}</span>
                  <span className="usage-section-count">{section.items.length} mục</span>
                  <strong style={{ color }}>{formatMinutes(section.minutes)}</strong>
                  <span className="usage-section-share">{share}%</span>
                </button>

                <div className="usage-bar">
                  <i style={{ width: `${share}%`, background: color }} />
                </div>

                {open && (
                  <ol className="usage-items">
                    {section.items.slice(0, limit).map((item, i) => (
                      <li key={item.key}>
                        <span className="usage-rank">{i + 1}</span>
                        <span className="usage-item-text">
                          <span className="usage-item-title" title={item.title}>{item.title}</span>
                          <span className="usage-item-sub">
                            {[
                              item.subtitle,
                              section.key === 'youtube'
                                ? `${item.count} lượt xem`
                                : section.key === 'books'
                                  ? `${item.count} trang`
                                  : `${item.count} chương`,
                              item.percent !== undefined && item.percent > 0
                                ? item.percent >= 90 ? 'đã xem hết' : `xem ${item.percent}%`
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <strong className="usage-item-minutes">{formatMinutes(item.minutes)}</strong>
                      </li>
                    ))}

                    {section.items.length > limit && (
                      <li className="usage-more">
                        <button
                          type="button"
                          onClick={() =>
                            setShownCount((prev) => ({ ...prev, [section.key]: limit + ITEMS_PER_STEP }))
                          }
                        >
                          Xem thêm {Math.min(ITEMS_PER_STEP, section.items.length - limit)} mục
                        </button>
                      </li>
                    )}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
      )}

      <p className="usage-note">
        Số liệu lấy từ nhật ký xem/đọc lưu trên máy này. Xem trên máy khác thì thống kê ở đó tính riêng.
      </p>
    </div>
  )
}
