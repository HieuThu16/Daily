type RemindableTodo = { id: string; title: string; completed: boolean; due_date?: string | null; due_time?: string | null }

export const REMIND_BEFORE_MINUTES = 120

/** Mốc hạn chót thành Date; không có ngày thì không nhắc được. */
export function deadlineOf(todo: RemindableTodo): Date | null {
  if (!todo.due_date) return null
  const [year, month, day] = todo.due_date.split('-').map(Number)
  const [hour, minute] = (todo.due_time || '23:59').split(':').map(Number)
  return new Date(year, month - 1, day, hour || 0, minute || 0)
}

/**
 * Việc cần nhắc ngay lúc `now`: chưa xong, còn hạn, và hạn nằm trong 2 tiếng tới.
 * Việc đã quá hạn thì không nhắc nữa — nhóm "tồn đọng" trong trang Tasks đã lo phần đó.
 */
export function dueSoon(todos: RemindableTodo[], now = new Date(), withinMinutes = REMIND_BEFORE_MINUTES) {
  return todos.filter((todo) => {
    if (todo.completed) return false
    const deadline = deadlineOf(todo)
    if (!deadline) return false
    const left = (deadline.getTime() - now.getTime()) / 60_000
    return left > 0 && left <= withinMinutes
  })
}

/** Còn bao nhiêu phút nữa tới hạn, làm tròn lên. */
export function minutesLeft(todo: RemindableTodo, now = new Date()) {
  const deadline = deadlineOf(todo)
  return deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 60_000) : null
}

export function reminderText(todo: RemindableTodo, now = new Date()) {
  const left = minutesLeft(todo, now) ?? 0
  const hours = Math.floor(left / 60)
  const rest = left % 60
  return `Còn ${hours ? `${hours}h${rest ? `${rest}p` : ''}` : `${rest}p`} nữa tới hạn`
}
