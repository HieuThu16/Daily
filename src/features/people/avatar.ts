const PALETTE = ['blue', 'amber', 'emerald', 'purple', 'rose', 'cyan'] as const

export type AvatarTone = (typeof PALETTE)[number]

/** Chữ cái đầu của từ đầu và từ cuối, tối đa 2 kí tự. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Chọn màu ổn định theo tên để cùng một người luôn cùng màu. */
export function avatarTone(name: string): AvatarTone {
  let hash = 0
  for (const char of name.trim()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100_000
  return PALETTE[hash % PALETTE.length]
}

export function avatarStyle(name: string) {
  const tone = avatarTone(name)
  return { background: `var(--${tone}-bg)`, color: `var(--${tone})` }
}
