import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { TaskCategory } from '../types'

export const DEFAULT_CATEGORIES: Array<{ id: string; name: string; color: string; icon: string }> = [
  { id: 'cat_finance', name: '💰 Tài chính', color: '#10b981', icon: '💰' },
  { id: 'cat_career', name: '💼 Sự nghiệp', color: '#3b82f6', icon: '💼' },
  { id: 'cat_health', name: '🏋️ Sức khỏe', color: '#f43f5e', icon: '🏋️' },
  { id: 'cat_growth', name: '🌟 Phát triển', color: '#8b5cf6', icon: '🌟' },
  { id: 'cat_study', name: '📚 Học tập', color: '#f59e0b', icon: '📚' },
  { id: 'cat_relationship', name: '💖 Tình cảm', color: '#ec4899', icon: '💖' },
  { id: 'cat_travel', name: '✈️ Du lịch', color: '#06b6d4', icon: '✈️' },
]

const STORAGE_KEY = 'daily_shared_categories'
const EVENT_NAME = 'daily_shared_categories_changed'

export function getStoredCategories(): TaskCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_CATEGORIES.map((c) => ({ id: c.id, name: c.name, created_at: new Date().toISOString() }))
}

export function saveStoredCategories(categories: TaskCategory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: categories }))
  } catch {}
}

/**
 * Hook dùng chung cho cả 2 bên: Công việc (Tasks) & Mục tiêu (Goals).
 * Đảm bảo 100% thể loại 2 bên hoàn toàn đồng bộ, không set cứng, thêm sửa xoá chuẩn.
 */
export function useSharedCategories() {
  const [categories, setCategories] = useState<TaskCategory[]>(() => getStoredCategories())
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!supabase) {
      setCategories(getStoredCategories())
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('task_categories')
        .select('*')
        .is('deleted_at', null)
        .order('name')

      if (!error && data && data.length > 0) {
        setCategories(data as TaskCategory[])
        saveStoredCategories(data as TaskCategory[])
      } else if (!error && (!data || data.length === 0)) {
        // Tự động khởi tạo bộ thể loại chuẩn nếu database chưa có
        const initialRows = DEFAULT_CATEGORIES.map((c) => ({ name: c.name }))
        const { data: inserted } = await supabase.from('task_categories').insert(initialRows).select()
        if (inserted && inserted.length > 0) {
          setCategories(inserted as TaskCategory[])
          saveStoredCategories(inserted as TaskCategory[])
        }
      }
    } catch (err) {
      console.warn('Lỗi tải thể loại dùng chung:', err)
      setCategories(getStoredCategories())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const handleUpdate = () => {
      setCategories(getStoredCategories())
    }
    window.addEventListener(EVENT_NAME, handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [reload])

  /** Thêm thể loại mới (áp dụng cho cả 2 bên Tasks & Goals) */
  const addCategory = async (nameInput: string): Promise<TaskCategory | null> => {
    const name = nameInput.trim()
    if (!name) return null

    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing

    const newLocal: TaskCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      created_at: new Date().toISOString(),
    }

    const next = [...categories, newLocal]
    setCategories(next)
    saveStoredCategories(next)

    if (supabase) {
      try {
        const { data } = await supabase.from('task_categories').insert({ name }).select().single()
        if (data) {
          const syncedList = next.map((c) => (c.id === newLocal.id ? (data as TaskCategory) : c))
          setCategories(syncedList)
          saveStoredCategories(syncedList)
          return data as TaskCategory
        }
      } catch (err) {
        console.warn('Lỗi lưu thể loại lên Supabase:', err)
      }
    }

    return newLocal
  }

  /** Đổi tên thể loại */
  const renameCategory = async (id: string, oldName: string, newNameInput: string): Promise<void> => {
    const nextName = newNameInput.trim()
    if (!nextName || nextName === oldName) return

    const next = categories.map((c) => (c.id === id ? { ...c, name: nextName } : c))
    setCategories(next)
    saveStoredCategories(next)

    if (supabase) {
      try {
        await supabase.from('task_categories').update({ name: nextName }).eq('id', id)
        await supabase.from('todos').update({ category: nextName }).eq('category', oldName)
      } catch (err) {
        console.warn('Lỗi đổi tên thể loại trên Supabase:', err)
      }
    }
  }

  /** Xoá thể loại */
  const deleteCategory = async (id: string, name: string): Promise<void> => {
    const next = categories.filter((c) => c.id !== id)
    setCategories(next)
    saveStoredCategories(next)

    if (supabase) {
      try {
        await supabase.from('task_categories').update({ deleted_at: new Date().toISOString() }).eq('id', id)
        await supabase.from('todos').update({ category: null }).eq('category', name)
      } catch (err) {
        console.warn('Lỗi xoá thể loại trên Supabase:', err)
      }
    }
  }

  return {
    categories,
    loading,
    addCategory,
    renameCategory,
    deleteCategory,
    reload,
  }
}
