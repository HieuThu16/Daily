import { CheckSquare, ChevronRight } from 'lucide-react'
import type { Todo } from '../../types'

type Props = {
  todos: Todo[]
  loading: boolean
  onToggle: (todo: Todo) => void
  onOpenAll: () => void
}

export function TodosCard({ todos, loading, onToggle, onOpenAll }: Props) {
  const visible = todos.slice(0, 4)

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-purple" style={{ width: 24, height: 24 }}>
            <CheckSquare size={14} />
          </div>
          <span>Việc cần làm</span>
        </div>
        <span className="home-card-count">{todos.length}</span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : visible.length === 0 ? (
          <p className="home-card-empty">Hoàn thành hết rồi ✨</p>
        ) : (
          visible.map((todo) => (
            <div
              key={todo.id}
              className="check-row"
              onClick={() => onToggle(todo)}
              style={{ padding: '5px 8px', borderRadius: 8, margin: 0, cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span className="checkbox" style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {todo.title}
                </span>
              </div>
              {todo.priority === 'URGENT' && <span className="urgent-badge">🔥 Gấp</span>}
            </div>
          ))
        )}
      </div>

      <button type="button" className="home-card-foot" onClick={onOpenAll}>
        Xem tất cả <ChevronRight size={14} />
      </button>
    </div>
  )
}
