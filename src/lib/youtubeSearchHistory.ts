import { useEffect, useState } from 'react'

const STORAGE_KEY = 'daily_youtube_search_history'
const EVENT_NAME = 'daily_youtube_search_history_changed'
const MAX_HISTORY_ITEMS = 20

/**
 * Đọc danh sách lịch sử tìm kiếm YouTube từ LocalStorage
 */
export function getStoredSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  } catch (err) {
    console.warn('Không thể đọc lịch sử tìm kiếm YouTube:', err)
    return []
  }
}

/**
 * Thêm từ khoá vào lịch sử tìm kiếm (đưa lên đầu danh sách, loại bỏ trùng lặp)
 */
export function addSearchHistory(query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return getStoredSearchHistory()

  const current = getStoredSearchHistory()
  // Loại bỏ từ khoá trùng (không phân biệt hoa thường)
  const filtered = current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
  const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }))
  } catch (err) {
    console.warn('Không thể lưu lịch sử tìm kiếm YouTube:', err)
  }

  return updated
}

/**
 * Xoá một từ khoá khỏi lịch sử tìm kiếm
 */
export function removeSearchHistory(query: string): string[] {
  const trimmed = query.trim()
  const current = getStoredSearchHistory()
  const updated = current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }))
  } catch (err) {
    console.warn('Không thể cập nhật lịch sử tìm kiếm YouTube:', err)
  }

  return updated
}

/**
 * Xoá toàn bộ lịch sử tìm kiếm
 */
export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: [] }))
  } catch (err) {
    console.warn('Không thể xoá lịch sử tìm kiếm YouTube:', err)
  }
}

/**
 * React Hook theo dõi lịch sử tìm kiếm YouTube tự động cập nhật
 */
export function useSearchHistory(): {
  history: string[]
  addHistory: (query: string) => void
  removeHistory: (query: string) => void
  clearAll: () => void
} {
  const [history, setHistory] = useState<string[]>(() => getStoredSearchHistory())

  useEffect(() => {
    const handleUpdate = () => {
      setHistory(getStoredSearchHistory())
    }

    window.addEventListener(EVENT_NAME, handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return {
    history,
    addHistory: (q: string) => {
      const next = addSearchHistory(q)
      setHistory(next)
    },
    removeHistory: (q: string) => {
      const next = removeSearchHistory(q)
      setHistory(next)
    },
    clearAll: () => {
      clearSearchHistory()
      setHistory([])
    },
  }
}
