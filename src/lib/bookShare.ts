import { supabase } from './supabase'

export type Person = { id: string; email: string | null; name: string | null; avatar_url: string | null }

function client() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  return supabase
}

/** Lọc danh bạ theo ô tìm kiếm. Tách riêng để test được mà không cần mạng. */
export function filterPeople(people: Person[], query: string): Person[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return people
  return people.filter((p) => `${p.name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(needle))
}

/** Mọi người đã đăng ký, trừ chính mình. */
export async function loadPeople(): Promise<Person[]> {
  const db = client()
  const { data: auth } = await db.auth.getUser()
  const me = auth.user?.id
  const { data, error } = await db.from('profiles').select('id, email, name, avatar_url').order('name')
  if (error) throw new Error(error.message)
  return ((data ?? []) as Person[]).filter((p) => p.id !== me)
}

/**
 * Chép sách sang thư viện của những người được chọn, không cần họ đồng ý.
 * Trả về số người thật sự nhận được.
 */
export async function shareBookTo(mediaItemId: string, userIds: string[]): Promise<number> {
  const { data, error } = await client().rpc('share_book_to', {
    p_media_item_id: mediaItemId,
    p_to_users: userIds,
  })
  if (error) throw new Error(error.message)
  return (data as number | null) ?? 0
}

/** Chia sẻ ra ngoài app: dùng hộp chia sẻ của hệ điều hành, không có thì chép vào clipboard. */
export async function shareOut(name: string, author?: string | null): Promise<'shared' | 'copied'> {
  const text = author ? `${name} — ${author}` : name
  if (navigator.share) {
    await navigator.share({ title: name, text })
    return 'shared'
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
