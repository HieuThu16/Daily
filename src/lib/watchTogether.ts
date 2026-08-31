import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { notifyUsers } from './push'

export type WatchKind = 'VIDEO' | 'MUSIC' | 'MANGA' | 'BOOK' | 'OTHER'

export type WatchShare = {
  id: string
  sender_id: string
  sender_email: string | null
  recipient_id: string | null
  recipient_email: string | null
  kind: WatchKind
  ref_id: string
  title: string
  subtitle: string | null
  thumbnail: string | null
  url: string | null
  percent: number
  progress_text: string | null
  created_at: string
  updated_at: string
}

export type WatchItem = {
  kind: WatchKind
  refId: string
  title: string
  subtitle?: string | null
  thumbnail?: string | null
  url?: string | null
}

/** Một người trong danh bạ app, kèm tên do CHÍNH MÌNH đặt (nếu đã đặt). */
export type WatchPerson = {
  id: string
  email: string
  /** Tên hiện ra: tên mình tự đặt > tên tài khoản > phần trước @ của email. */
  label: string
  /** Tên mình tự đặt; null nghĩa là chưa đặt. */
  customName: string | null
  avatarUrl: string | null
}

/** Những mục mình đã gửi đi — để khỏi gọi mạng cập nhật tiến độ khi chưa gửi gì. */
const SHARED_KEY = 'daily_watch_shared_refs'

function sharedRefs(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHARED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function rememberRef(key: string) {
  const set = sharedRefs()
  set.add(key)
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify([...set]))
  } catch {
    /* hết chỗ thì thôi */
  }
}

/** Tên rơi về phần trước @ khi không có gì khác để hiện. */
export const emailLabel = (email: string | null | undefined) => (email ?? '').split('@')[0] || 'ai đó'

/**
 * Danh bạ để chọn người nhận: mọi tài khoản trong app (public.profiles),
 * ghép với tên mình tự đặt trong watch_contacts. Bỏ chính mình ra.
 */
export async function listPeople(): Promise<WatchPerson[]> {
  if (!supabase) return []
  const { data: auth } = await supabase.auth.getUser()
  const me = auth?.user?.id

  const [profileRes, contactRes] = await Promise.all([
    supabase.from('profiles').select('id, email, name, avatar_url').order('name'),
    supabase.from('watch_contacts').select('email, display_name').is('deleted_at', null),
  ])

  const named = new Map<string, string>()
  for (const c of contactRes.data ?? []) named.set(String(c.email).toLowerCase(), c.display_name)

  type Row = { id: string; email: string | null; name: string | null; avatar_url: string | null }
  return ((profileRes.data ?? []) as Row[])
    .filter((p) => p.id !== me && p.email)
    .map((p) => {
      const custom = named.get(p.email!.toLowerCase()) ?? null
      return {
        id: p.id,
        email: p.email!,
        customName: custom,
        label: custom || p.name || emailLabel(p.email),
        avatarUrl: p.avatar_url,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
}

/** Đặt (hoặc đổi) tên cho một Gmail. Tên rỗng nghĩa là gỡ tên tự đặt. */
export async function saveContactName(rawEmail: string, name: string): Promise<void> {
  if (!supabase) return
  // Bảng ràng buộc email phải là chữ thường (xem migration) để ON CONFLICT khớp index.
  const email = rawEmail.trim().toLowerCase()
  const trimmed = name.trim()
  if (!trimmed) {
    const res = await supabase.from('watch_contacts').delete().eq('email', email)
    if (res.error) throw new Error(res.error.message)
    return
  }
  const res = await supabase
    .from('watch_contacts')
    .upsert(
      { email, display_name: trimmed, updated_at: new Date().toISOString() },
      { onConflict: 'owner_id,email' },
    )
  if (res.error) throw new Error(res.error.message)
}

/** Lọc danh bạ theo ô tìm kiếm. Tách riêng để test được mà không cần mạng. */
export function filterPeople(people: WatchPerson[], query: string): WatchPerson[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return people
  return people.filter((p) => `${p.label} ${p.email}`.toLowerCase().includes(needle))
}

/** Gửi một mục cho những người đã chọn. Gửi lại lần nữa thì cập nhật, không đẻ bản sao. */
export async function shareToPeople(people: WatchPerson[], item: WatchItem): Promise<number> {
  if (!supabase || people.length === 0) return 0
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return 0

  const rows = people.map((p) => ({
    sender_id: user.id,
    sender_email: user.email ?? null,
    recipient_id: p.id,
    recipient_email: p.email,
    kind: item.kind,
    ref_id: item.refId,
    title: item.title,
    subtitle: item.subtitle ?? null,
    thumbnail: item.thumbnail ?? null,
    url: item.url ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('watch_shares')
    .upsert(rows, { onConflict: 'sender_id,recipient_id,kind,ref_id' })
  if (error) throw new Error(error.message)

  rememberRef(`${item.kind}:${item.refId}`)

  // Báo cho người nhận ngay, kể cả khi họ đã tắt app.
  const senderName = user.email?.split('@')[0] || 'Ai đó'
  void notifyUsers(
    people.map((p) => p.id),
    `${senderName} gửi bạn một mục xem chung`,
    item.title,
    '/watch',
    // Mỗi mục một tag riêng: nhiều mục khác nhau thì hiện nhiều thông báo, không đè nhau.
    `watch-${item.kind}-${item.refId}`,
  )

  return rows.length
}

/** Gỡ một mục mình đã gửi. */
export async function unshare(shareId: string): Promise<void> {
  const res = await supabase?.from('watch_shares').delete().eq('id', shareId)
  if (res?.error) throw new Error(res.error.message)
}

/**
 * Cập nhật tiến độ của chính mình cho MỌI người mình đã gửi mục này —
 * và phản hồi tiến độ cho người đã gửi mục này cho mình (chạy realtime 2 chiều).
 */
export async function updateMyShareProgress(
  kind: WatchKind,
  refId: string,
  percent: number,
  progressText?: string,
): Promise<void> {
  if (!supabase) return
  try {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) return
    const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)))
    const pText = progressText ?? (clampedPercent >= 90 ? 'Đã xem xong' : `Đang xem ${clampedPercent}%`)

    // 1. Cập nhật các dòng mình là SENDER (mình gửi cho đối phương)
    await supabase
      .from('watch_shares')
      .update({
        percent: clampedPercent,
        progress_text: pText,
        updated_at: new Date().toISOString(),
      })
      .eq('sender_id', user.id)
      .eq('kind', kind)
      .eq('ref_id', refId)

    // 2. Cập nhật / tạo dòng phản hồi nếu mình là RECIPIENT (đối phương gửi cho mình)
    const { data: incoming } = await supabase
      .from('watch_shares')
      .select('sender_id, sender_email, title, subtitle, thumbnail, url')
      .eq('recipient_id', user.id)
      .eq('kind', kind)
      .eq('ref_id', refId)

    if (incoming && incoming.length > 0) {
      const reciprocalRows = incoming.map((inc: any) => ({
        sender_id: user.id,
        sender_email: user.email ?? null,
        recipient_id: inc.sender_id,
        recipient_email: inc.sender_email,
        kind,
        ref_id: refId,
        title: inc.title,
        subtitle: inc.subtitle ?? null,
        thumbnail: inc.thumbnail ?? null,
        url: inc.url ?? null,
        percent: clampedPercent,
        progress_text: pText,
        updated_at: new Date().toISOString(),
      }))
      await supabase
        .from('watch_shares')
        .upsert(reciprocalRows, { onConflict: 'sender_id,recipient_id,kind,ref_id' })
    }

    rememberRef(`${kind}:${refId}`)
  } catch (err) {
    console.warn('[watchTogether] không cập nhật được tiến độ lên Supabase:', err)
  }
}

export function usePeople() {
  const [people, setPeople] = useState<WatchPerson[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    void listPeople()
      .then(setPeople)
      .catch(() => setPeople([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(reload, [reload])
  return { people, loading, reload }
}

/** Ai đang đăng nhập — để tách "người ta gửi cho mình" và "mình gửi đi". */
export function useMyUserId() {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    void supabase?.auth.getUser().then(({ data }) => setId(data?.user?.id ?? null))
  }, [])
  return id
}

/**
 * Mọi mục xem chung liên quan tới mình: người khác gửi cho mình, và mình gửi đi.
 * RLS đã lọc sẵn nên `select *` chỉ trả về đúng phần của mình.
 */
export function useWatchFeed() {
  const [shares, setShares] = useState<WatchShare[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!supabase) return setLoading(false)
    const { data } = await supabase
      .from('watch_shares')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200)
    setShares((data ?? []) as WatchShare[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
    if (!supabase) return
    const channel = supabase
      .channel('watch_shares_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_shares' }, (payload: any) => {
        setShares((prev) => {
          if (payload.eventType === 'DELETE') return prev.filter((s) => s.id !== payload.old?.id)
          const row = payload.new as WatchShare
          const rest = prev.filter((s) => s.id !== row.id)
          return [row, ...rest].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        })
      })
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [reload])

  return { shares, loading, reload }
}
