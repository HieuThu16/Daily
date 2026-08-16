import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Bell, Check, ChevronRight, Clock, Flame, ListTodo, Sparkles, X } from 'lucide-react'
import { useUncompletedTasks } from './useUncompletedTasks'
import { isOverdue, timeLabel } from '../lib/deadline'
import { localDate } from '../lib/date'
import { useToast } from './ToastContext'
import type { Todo } from '../types'

export function TaskNotificationBell() {
  const { tasks, count, overdueCount, completeTask } = useUncompletedTasks()
  const [open, setOpen] = useState(false)
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null)
  const nav = useNavigate()
  const { showToast } = useToast()
  const today = localDate()

  // Khóa cuộn trang khi mở modal trên điện thoại
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false)
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = originalOverflow
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [open])

  const handleQuickComplete = async (e: React.MouseEvent, task: Todo) => {
    e.stopPropagation()
    setJustCompletedId(task.id)
    showToast(`✅ Đã hoàn thành: ${task.title}`)
    setTimeout(() => {
      completeTask(task)
      setJustCompletedId(null)
    }, 250)
  }

  const handleNavigateToTasks = (taskId?: string) => {
    setOpen(false)
    if (taskId) {
      nav(`/tasks?id=${taskId}`)
    } else {
      nav('/tasks')
    }
  }

  const displayCount = count > 99 ? '99+' : count

  return (
    <div className="task-bell-container">
      <button
        type="button"
        className={`task-bell-btn ${count > 0 ? 'has-tasks' : ''} ${overdueCount > 0 ? 'has-overdue' : ''} ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Thông báo công việc: ${count} việc chưa hoàn thành`}
        title={
          count > 0
            ? `${count} công việc chưa hoàn thành${overdueCount > 0 ? ` (${overdueCount} quá hạn)` : ''}`
            : 'Không có việc tồn đọng'
        }
      >
        <Bell size={18} className="task-bell-icon" />
        {count > 0 && (
          <span className={`task-bell-badge ${overdueCount > 0 ? 'is-overdue' : ''}`}>
            {displayCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            className="task-bell-portal-backdrop"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="task-bell-dropdown-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Danh sách công việc chưa xong"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Thanh gạt nhỏ trên đầu khi hiển thị bottom-sheet trên mobile */}
              <div className="task-bell-sheet-handle" aria-hidden="true" />

              <div className="task-bell-header">
                <div className="task-bell-title-wrap">
                  <div className="task-bell-title-icon">
                    <ListTodo size={16} />
                  </div>
                  <strong className="task-bell-title">Công việc chưa xong</strong>
                  <span className="task-bell-count-pill">{count} việc</span>
                  {overdueCount > 0 && (
                    <span
                      className="task-bell-overdue-pill"
                      title={`${overdueCount} công việc đã quá hạn`}
                    >
                      <AlertCircle size={12} />
                      {overdueCount} quá hạn
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="task-bell-close-btn"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng bảng công việc"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="task-bell-body">
                {count === 0 ? (
                  <div className="task-bell-empty">
                    <div className="task-bell-empty-icon">
                      <Sparkles size={28} />
                    </div>
                    <p className="task-bell-empty-title">Không còn việc tồn đọng! 🎉</p>
                    <p className="task-bell-empty-desc">
                      Tất cả các mục đã được hoàn thành hoặc bạn chưa thêm công việc nào.
                    </p>
                  </div>
                ) : (
                  <ul className="task-bell-list">
                    {tasks.map((task) => {
                      const overdue = isOverdue(task)
                      const isToday = task.due_date === today
                      const isCompleting = justCompletedId === task.id

                      return (
                        <li
                          key={task.id}
                          className={`task-bell-item ${overdue ? 'is-overdue' : ''} ${isCompleting ? 'is-completing' : ''}`}
                          onClick={() => handleNavigateToTasks(task.id)}
                        >
                          <button
                            type="button"
                            className={`task-bell-check-btn ${isCompleting ? 'checked' : ''}`}
                            onClick={(e) => handleQuickComplete(e, task)}
                            aria-label={`Hoàn thành: ${task.title}`}
                            title="Bấm để đánh dấu hoàn thành nhanh"
                          >
                            {isCompleting ? <Check size={14} /> : <span className="check-ring" />}
                          </button>

                          <div className="task-bell-item-content">
                            <span className={`task-bell-item-title ${isCompleting ? 'done' : ''}`}>
                              {task.title}
                            </span>

                            <div className="task-bell-item-tags">
                              {overdue ? (
                                <span className="task-tag-badge tag-overdue">
                                  <AlertCircle size={11} />
                                  Quá hạn
                                </span>
                              ) : isToday ? (
                                <span className="task-tag-badge tag-today">
                                  <Clock size={11} />
                                  Hôm nay {timeLabel(task.due_time)}
                                </span>
                              ) : task.due_date ? (
                                <span className="task-tag-badge tag-due">
                                  <Clock size={11} />
                                  {task.due_date.slice(5).replace('-', '/')}{' '}
                                  {timeLabel(task.due_time)}
                                </span>
                              ) : null}

                              {task.priority === 'URGENT' && (
                                <span className="task-tag-badge tag-urgent">
                                  <Flame size={11} />
                                  Gấp
                                </span>
                              )}

                              {task.category && (
                                <span className="task-tag-badge tag-category">
                                  {task.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronRight size={15} className="task-bell-item-arrow" />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="task-bell-footer">
                <button
                  type="button"
                  className="task-bell-view-all-btn"
                  onClick={() => handleNavigateToTasks()}
                >
                  <span>Xem tất cả trên trang Tasks</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
