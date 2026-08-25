import { useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { getVideoWatchLogs } from '../lib/videoWatchLog'
import { getMangaReadingLogs } from '../lib/mangaReadingLog'
import { getBookReadingSessionLogs } from '../lib/bookReadingLog'
import { getLocalProgress } from '../lib/videoProgress'
import { buildUsageStats, formatMinutes, sinceDate, type UsageSectionKey } from '../lib/usageStats'
import { buildActivityStats, type ActivityKey, type ActivitySection } from '../lib/activityStats'
import { useActivityData } from './useActivityData'

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

/** Màu cho từng mục ở khu Hoạt động; giữ cùng bảng màu với icon tab. */
const ACTIVITY_COLOR: Record<ActivityKey, string> = {
  habit: '#f59e0b',
  daily: '#10b981',
  tasks: '#8b5cf6',
  money: '#f59e0b',
  nutrition: '#22c55e',
  knowledge: '#a855f7',
  english: '#06b6d4',
  library: '#6366f1',
  people: '#0ea5e9',
  watch: '#8b5cf6',
}

const ITEMS_PER_STEP = 8

/** Xem mình đổ thời gian vào mục nào, video nào, truyện nào. */
export function UsageStatsPage() {
  const [days, setDays] = useState(30)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['youtube']))
  const [shownCount, setShownCount] = useState<Record<string, number>>({})

  const { data: activityData, loading: activityLoading } = useActivityData()

  const activity = useMemo(
    () => (activityData ? buildActivityStats({ ...activityData, from: sinceDate(days), days }) : []),
    [activityData, days],
  )

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
            <p>Thời gian và hoạt động ở mọi tab</p>
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

      <h3 className="usage-group-title">Thời gian xem &amp; đọc</h3>
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

      <h3 className="usage-group-title">Hoạt động</h3>
      {activityLoading ? (
        <p className="usage-empty">Đang tải số liệu các tab…</p>
      ) : activity.length === 0 ? (
        <p className="usage-empty">Chưa có hoạt động nào trong khoảng này.</p>
      ) : (
        <div className="usage-sections">
          {activity.map((section) => (
            <ActivityCard
              key={section.key}
              section={section}
              open={openSections.has(section.key)}
              onToggle={() => toggle(section.key)}
            />
          ))}
        </div>
      )}

      <p className="usage-note">
        Số liệu lấy từ nhật ký xem/đọc lưu trên máy này. Xem trên máy khác thì thống kê ở đó tính riêng.
      </p>
    </div>
  )
}

/** Một mục ở khu Hoạt động: tóm tắt luôn hiện, chi tiết bấm mới bung. */
function ActivityCard({
  section,
  open,
  onToggle,
}: {
  section: ActivitySection
  open: boolean
  onToggle: () => void
}) {
  const color = ACTIVITY_COLOR[section.key]
  return (
    <section className="usage-section">
      <button type="button" className="usage-section-head" onClick={onToggle}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="usage-dot" style={{ background: color }} />
        <span className="usage-section-name">{section.label}</span>
        <strong style={{ color, marginLeft: 'auto' }}>{section.headline}</strong>
      </button>

      {section.metrics.length > 0 && (
        <div className="usage-metrics">
          {section.metrics.map((m) => (
            <span key={m.label} className="usage-metric">
              <b>{m.value}</b>
              {m.label}
            </span>
          ))}
        </div>
      )}

      {open && section.details.length > 0 && (
        <ol className="usage-items">
          {section.details.map((d, i) => (
            <li key={d.key}>
              <span className="usage-rank">{i + 1}</span>
              <span className="usage-item-text">
                <span className="usage-item-title" title={d.title}>{d.title}</span>
                {d.subtitle && <span className="usage-item-sub">{d.subtitle}</span>}
              </span>
              <strong className="usage-item-minutes">{d.value}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
