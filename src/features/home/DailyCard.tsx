import { NotebookPen, PenLine } from 'lucide-react'
import { timeOfDay } from '../../lib/date'
import type { Entry } from '../../types'

type Props = { entries: Entry[]; loading: boolean; onWrite: () => void }

export function DailyCard({ entries, loading, onWrite }: Props) {
  const visible = entries.slice(0, 3)

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-emerald" style={{ width: 24, height: 24 }}>
            <NotebookPen size={14} />
          </div>
          <span>Nhật ký hôm nay</span>
        </div>
        <span className="home-card-count">{entries.length}</span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : visible.length === 0 ? (
          <p className="home-card-empty">Hôm nay chưa có bài viết nào.</p>
        ) : (
          visible.map((entry) => (
            <div key={entry.id} className="entry-line">
              <i />
              <div>
                <p>{entry.content}</p>
                <time>{timeOfDay(entry.created_at)}</time>
              </div>
            </div>
          ))
        )}
      </div>

      <button type="button" className="home-card-foot accent" onClick={onWrite}>
        <PenLine size={14} /> Viết nhật ký
      </button>
    </div>
  )
}
