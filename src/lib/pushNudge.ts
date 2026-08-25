import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Nhắc người khác bật thông báo đẩy.
 *
 * Không thể ĐẨY một thông báo tới người chưa bật thông báo đẩy — vòng luẩn quẩn.
 * Nên lời nhắc nằm chờ trong bảng `push_nudges`, và hiện ra ngay trong app lúc
 * người đó mở lên.
 */

export type PushNudge = {
  id: string
  from_email: string
  to_email: string
  created_at: string
  seen_at: string | null
}

/** Nhắc lại quá sớm thì phiền; trong khoảng này coi như đã nhắc rồi. */
const NUDGE_COOLDOWN_HOURS = 12

/** Còn trong thời gian chờ thì chưa nên nhắc lại. */
export function isWithinCooldown(lastSentAt: string | null | undefined, now = new Date()): boolean {
  if (!lastSentAt) return false
  const sent = new Date(lastSentAt).getTime()
  if (Number.isNaN(sent)) return false
  return now.getTime() - sent < NUDGE_COOLDOWN_HOURS * 3_600_000
}

/**
 * Gửi lời nhắc tới một Gmail.
 * Trả về `false` khi vừa nhắc gần đây — chỗ gọi tự báo lại cho người dùng.
 */
export async function sendNudge(toEmail: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  const myEmail = data?.user?.email
  if (!myEmail) return false

  const recent = await supabase
    .from('push_nudges')
    .select('created_at')
    .eq('to_email', toEmail)
    .eq('from_email', myEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (isWithinCooldown(recent.data?.created_at)) return false

  const { error } = await supabase.from('push_nudges').insert({ from_email: myEmail, to_email: toEmail })
  if (error) throw new Error(error.message)
  return true
}

/** Đánh dấu đã xem để lần sau khỏi hiện lại. */
export async function markNudgeSeen(id: string): Promise<void> {
  await supabase?.from('push_nudges').update({ seen_at: new Date().toISOString() }).eq('id', id)
}

/**
 * Lời nhắc chưa xem dành cho mình, nếu mình THẬT SỰ chưa bật thông báo.
 *
 * `enabled` do chỗ gọi truyền vào (đọc từ trình duyệt): đã bật rồi mà vẫn hiện
 * bảng "hãy bật thông báo" thì rất vô duyên.
 */
export function usePendingNudge(enabled: boolean | null) {
  const [nudge, setNudge] = useState<PushNudge | null>(null)

  const dismiss = useCallback(() => {
    if (nudge) void markNudgeSeen(nudge.id)
    setNudge(null)
  }, [nudge])

  useEffect(() => {
    // Chưa biết trạng thái (null) thì chờ; đã bật rồi thì khỏi hỏi máy chủ.
    if (enabled !== false || !supabase) return
    let alive = true

    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const myEmail = auth?.user?.email
        if (!myEmail) return
        const { data } = await supabase
          .from('push_nudges')
          .select('*')
          .eq('to_email', myEmail)
          .is('seen_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (alive && data) setNudge(data as PushNudge)
      } catch {
        // Bảng chưa tạo hoặc mất mạng: im lặng, đây chỉ là lời nhắc.
      }
    })()

    return () => {
      alive = false
    }
  }, [enabled])

  return { nudge, dismiss }
}
