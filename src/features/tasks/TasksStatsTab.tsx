import { Timer } from 'lucide-react'
import { formatMinutes } from '../../lib/deadline'
import type { Todo } from '../../types'

/** So lieu da tinh san o TasksPage; component nay chi ve. */
export type TaskStats = {
  totalTodos: number
  completedTodos: number
  overdueCount: number
  totalIdeas: number
  easyCount: number
  normalDiffCount: number
  hardCount: number
  urgentCount: number
  normalPrioCount: number
  percent: number
  postponeCount: number
  postponeMinutesTotal: number
  postponedTaskCount: number
  topPostponed: Todo[]
}

export function TasksStatsTab({ stats }: { stats: TaskStats }) {
  return (
      <div>
        <div className="stats-grid" style={{ gap: 8, marginBottom: 10 }}>
          <div className="stat-card" style={{ padding: 8 }}>
            <div className="stat-val" style={{ fontSize: '1.4rem' }}>{stats.totalTodos}</div>
            <div className="stat-lbl">Tổng công việc</div>
          </div>
          <div className="stat-card" style={{ padding: 8 }}>
            <div className="stat-val" style={{ color: 'var(--emerald)', fontSize: '1.4rem' }}>{stats.completedTodos}</div>
            <div className="stat-lbl">Đã xong ({stats.percent}%)</div>
          </div>
          <div className="stat-card" style={{ padding: 8 }}>
            <div className="stat-val" style={{ color: 'var(--amber)', fontSize: '1.4rem' }}>{stats.overdueCount}</div>
            <div className="stat-lbl">Tồn đọng ngày trước</div>
          </div>
          <div className="stat-card" style={{ padding: 8 }}>
            <div className="stat-val" style={{ color: 'var(--purple)', fontSize: '1.4rem' }}>{stats.totalIdeas}</div>
            <div className="stat-lbl">Tổng ý tưởng</div>
          </div>
          <div className="stat-card" style={{ padding: 8 }}>
            <div className="stat-val" style={{ color: '#f59e0b', fontSize: '1.4rem' }}>{stats.postponeCount}</div>
            <div className="stat-lbl">Số lần trì hoãn</div>
          </div>
          <div className="stat-card" style={{ padding: 8 }}>
            <div className="stat-val" style={{ color: '#f59e0b', fontSize: '1.4rem' }}>{formatMinutes(stats.postponeMinutesTotal)}</div>
            <div className="stat-lbl">Tổng thời gian trì hoãn</div>
          </div>
        </div>

        {/* POSTPONE BREAKDOWN */}
        <div className="card" style={{ padding: 10, margin: '0 0 10px' }}>
          <h2 style={{ fontSize: '0.84rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Timer size={14} style={{ color: '#f59e0b' }} /> Thống kê trì hoãn
          </h2>
          <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem', marginBottom: stats.topPostponed.length ? 10 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Công việc từng bị trì hoãn</span>
              <strong>{stats.postponedTaskCount} / {stats.totalTodos}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Trung bình mỗi lần trì hoãn</span>
              <strong>{formatMinutes(stats.postponeCount ? Math.round(stats.postponeMinutesTotal / stats.postponeCount) : 0)}</strong>
            </div>
          </div>

          {stats.topPostponed.length > 0 && (
            <>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Bị trì hoãn nhiều nhất</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {stats.topPostponed.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', background: 'var(--bg-main)', borderRadius: 8, padding: '5px 8px', fontSize: '0.8rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <strong style={{ color: '#f59e0b', whiteSpace: 'nowrap' }}>
                      {t.postpone_count} lần · {formatMinutes(t.postpone_minutes ?? 0)}
                    </strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* BREAKDOWN BY DIFFICULTY & PRIORITY */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10, marginBottom: 10 }}>
          <div className="card" style={{ padding: 10, margin: 0 }}>
            <h2 style={{ fontSize: '0.84rem', marginBottom: 8 }}>🎯 Phân loại theo Độ khó</h2>
            <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🟢 Dễ</span>
                <strong>{stats.easyCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🔵 Bình thường</span>
                <strong>{stats.normalDiffCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🔴 Khó</span>
                <strong>{stats.hardCount}</strong>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 10, margin: 0 }}>
            <h2 style={{ fontSize: '0.84rem', marginBottom: 8 }}>🚩 Phân loại theo Ưu tiên</h2>
            <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🔥 Ưu tiên Gấp</span>
                <strong style={{ color: '#f59e0b' }}>{stats.urgentCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Bình thường</span>
                <strong>{stats.normalPrioCount}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 12, margin: 0 }}>
          <h2 style={{ fontSize: '0.88rem', marginBottom: 8 }}>Tiến độ hoàn thành công việc</h2>
          <div className="habit-progress-bar-bg" style={{ height: 8, marginBottom: 10 }}>
            <div className="habit-progress-bar-fill" style={{ width: `${stats.percent}%` }} />
          </div>
          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
            Bạn đã hoàn thành {stats.completedTodos} / {stats.totalTodos} công việc.
          </p>
        </div>
      </div>
  )
}
