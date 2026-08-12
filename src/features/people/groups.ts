import type { PersonGroup } from '../../types'

export const GROUPS: { key: PersonGroup; label: string }[] = [
  { key: 'FAMILY', label: 'Gia đình' },
  { key: 'FRIEND', label: 'Bạn bè' },
  { key: 'COLLEAGUE', label: 'Đồng nghiệp' },
  { key: 'OTHER', label: 'Khác' },
]

export function groupLabel(key?: PersonGroup | null): string | null {
  return GROUPS.find((g) => g.key === key)?.label ?? null
}
