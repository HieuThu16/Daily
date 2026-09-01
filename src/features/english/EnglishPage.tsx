import { LanguagePage } from '../language/LanguagePage'

export { LanguagePage as EnglishPage, LanguagePage }
export default LanguagePage

export const KIND_LABEL: Record<string, string> = { WORD: 'Từ', SENTENCE: 'Câu' }

export interface MinimalTheme {
  id: string
  name: string
  accent: string
}

export const MINIMAL_THEMES: MinimalTheme[] = [
  { id: 'blue', name: 'Xanh dương', accent: '#3b82f6' },
  { id: 'emerald', name: 'Xanh ngọc', accent: '#10b981' },
  { id: 'amber', name: 'Vàng hổ phách', accent: '#f59e0b' },
  { id: 'rose', name: 'Hồng cam', accent: '#f43f5e' },
  { id: 'purple', name: 'Tím nhạt', accent: '#8b5cf6' },
  { id: 'cyan', name: 'Xanh cyan', accent: '#06b6d4' },
  { id: 'slate', name: 'Xám thanh lịch', accent: '#64748b' },
]

export function getCardAccent(item: { id?: string; term?: string; color?: string | null }): string {
  if (item.color) {
    const found = MINIMAL_THEMES.find((p) => p.id === item.color)
    if (found) return found.accent
    if (item.color.startsWith('#')) return item.color
  }
  const key = item.id || item.term || 'eng'
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % MINIMAL_THEMES.length
  return MINIMAL_THEMES[index].accent
}

export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))]
}
