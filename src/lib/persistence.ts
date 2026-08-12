export type SaveSource = 'Local' | 'Supabase'
export const saveSourceLabel = (source: SaveSource) => `Đã lưu ${source}`
/** Ghi dự phòng khi Supabase lỗi. Không bao giờ ném — đây đã là nhánh xử lý sự cố. Trả về true nếu ghi được. */
export function saveLocal<T>(key: string, value: T): boolean { try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false } }
export function loadLocal<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
