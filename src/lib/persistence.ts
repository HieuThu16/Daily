export type SaveSource = 'Local' | 'Supabase'
export const saveSourceLabel = (source: SaveSource) => `Đã lưu ${source}`
export function saveLocal<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)) }
export function loadLocal<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
