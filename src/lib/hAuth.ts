export function isUserAuthorizedForH(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const u = user as { email?: string | null; user_metadata?: { email?: string; user_name?: string; name?: string } }
  const email = (u.email || u.user_metadata?.email || '').toLowerCase()
  const name = (u.user_metadata?.user_name || u.user_metadata?.name || '').toLowerCase()
  return (
    email.includes('truongnguyenminhhieu100') ||
    name.includes('truongnguyenminhhieu100') ||
    email.includes('nguyenkimy') ||
    name.includes('nguyenkimy')
  )
}
