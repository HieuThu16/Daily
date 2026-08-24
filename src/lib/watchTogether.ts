import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type WatchKind = 'VIDEO' | 'MUSIC' | 'MANGA' | 'BOOK' | 'OTHER'

export type WatchGroup = { id: string; name: string; owner_id: string }

export type WatchShare = {
  id: string
  group_id: string
  sender_id: string
  sender_email: string | null
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

/** Những mục mình đã gửi lên xem chung — để khỏi gọi mạng khi chưa gửi gì. */
const SHARED_KEY = 'daily_watch_shared_refs'

function sharedRefs(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHARED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function rememberRef(key: string) {
  const set = sharedRefs()
  set.add(key)
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify([...set]))
  } catch {
    /* hết chỗ thì thôi */
  }
}

export async function listMyGroups(): Promise<WatchGroup[]> {
  if (!supabase) return []
  const { data } = await supabase.from('watch_groups').select('id, name, owner_id').order('created_at')
  return data ?? []
}

export async function createGroup(name: string): Promise<WatchGroup | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('watch_groups').insert({ name }).select('id, name, owner_id').single()
  if (error) throw error
  return data
}

export async function deleteGroup(groupId: string): Promise<void> {
  await supabase?.from('watch_groups').delete().eq('id', groupId)
}

export async function listMembers(groupId: string): Promise<Array<{ id: string; email: string }>> {
  if (!supabase) return []
  const { data } = await supabase.from('watch_group_members').select('id, email').eq('group_id', groupId)
  return data ?? []
}

export async function addMember(groupId: string, email: string): Promise<void> {
  const { error } = (await supabase?.from('watch_group_members').insert({ group_id: groupId, email: email.trim() })) ?? {}
  if (error) throw error
}

export async function removeMember(memberId: string): Promise<void> {
  await supabase?.from('watch_group_members').delete().eq('id', memberId)
}

/** Gửi một mục lên xem chung cho các nhóm đã chọn. */
export async function shareToGroups(groupIds: string[], item: WatchItem): Promise<number> {
  if (!supabase || groupIds.length === 0) return 0
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return 0
  const rows = groupIds.map((gid) => ({
    group_id: gid,
    sender_id: user.id,
    sender_email: user.email ?? null,
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
    .upsert(rows, { onConflict: 'group_id,sender_id,kind,ref_id' })
  if (error) throw error
  rememberRef(`${item.kind}:${item.refId}`)
  return rows.length
}

/** Cập nhật tiến độ của chính mình cho mọi nhóm đã gửi — nhóm thấy realtime. */
export async function updateMyShareProgress(
  kind: WatchKind,
  refId: string,
  percent: number,
  progressText?: string,
): Promise<void> {
  if (!supabase || !sharedRefs().has(`${kind}:${refId}`)) return
  try {
    const { data } = await supabase.auth.getUser()
    if (!data?.user) return
    await supabase
      .from('watch_shares')
      .update({
        percent: Math.max(0, Math.min(100, Math.round(percent))),
        progress_text: progressText ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('sender_id', data.user.id)
      .eq('kind', kind)
      .eq('ref_id', refId)
  } catch (err) {
    console.warn('[watchTogether] không cập nhật được tiến độ:', err)
  }
}

export function useMyGroups() {
  const [groups, setGroups] = useState<WatchGroup[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    void listMyGroups()
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(reload, [reload])
  return { groups, loading, reload }
}

/** Danh sách mục xem chung của mọi nhóm mình ở trong, tiến độ cập nhật realtime. */
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
    setShares(data ?? [])
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
