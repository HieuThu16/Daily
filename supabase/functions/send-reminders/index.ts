// Nhắc việc qua Web Push. Chạy định kỳ bằng pg_cron (xem migration 20260825000000).
// Deploy: supabase functions deploy send-reminders
// Secrets cần đặt: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

/** Nhắc khi còn ≤ ngần này phút nữa tới hạn — khớp ngưỡng nhắc trong app. */
const LEAD_MINUTES = 120

/** Giờ (giờ Việt Nam) gửi lời nhắc "Nhìn lại". Tối muộn thì đã có chuyện để nhìn lại. */
const LOOKBACK_HOUR_VN = 20
/** Khoá lưu ngày đã gửi, để hàm chạy 5 phút/lần không bắn 288 lần một ngày. */
const LOOKBACK_KEY = 'lookback_last_sent'

/**
 * Ngày này tuần trước / tháng trước, theo giờ Việt Nam.
 *
 * Chép lại từ src/lib/lookBack.ts thay vì import: hàm này chạy trên Deno và
 * bundler của edge function không với ra ngoài thư mục supabase/functions.
 * Bản gốc có test (src/lib/lookBack.test.ts) — sửa một bên nhớ sửa bên kia.
 */
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function sameDayLastWeek(d: Date): string {
  const x = new Date(d)
  x.setDate(x.getDate() - 7)
  return dayKey(x)
}

function sameDayLastMonth(d: Date): string {
  const x = new Date(d)
  const day = x.getDate()
  x.setDate(1)
  x.setMonth(x.getMonth() - 1)
  // Ngày 31 mà tháng trước chỉ có 30 thì setMonth nhảy sang tháng sau — phải kẹp.
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, lastDay))
  return dayKey(x)
}

type Todo = { id: string; user_id: string; title: string; due_date: string; due_time: string | null }
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

/** Thời điểm hết hạn của một việc; không ghi giờ thì tính cuối ngày. */
const deadlineOf = (todo: Todo) => new Date(`${todo.due_date}T${todo.due_time || '23:59'}:00`)

/**
 * Lời nhắc "Nhìn lại": ngày này tuần trước và tháng trước.
 *
 * Hàm này chạy 5 phút/lần cho việc tới hạn, nên phải tự chốt hai điều kẻo bắn
 * 288 lần một ngày: đúng khung giờ, và hôm nay chưa gửi.
 */
async function sendLookBack(
  admin: ReturnType<typeof createClient>,
  now: Date,
  push: (sub: Sub, payload: string) => Promise<boolean>,
): Promise<number> {
  // Giờ Việt Nam = UTC+7. Máy chủ chạy giờ UTC nên phải tự cộng.
  const vn = new Date(now.getTime() + 7 * 3_600_000)
  if (vn.getUTCHours() !== LOOKBACK_HOUR_VN) return 0

  const vnDate = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()))
  const todayVN = dayKey(vnDate)
  const days = [sameDayLastWeek(vnDate), sameDayLastMonth(vnDate)]

  const { data: subRows } = await admin.from('push_subscriptions').select('*')
  const subs = (subRows ?? []) as Sub[]
  if (!subs.length) return 0

  // Ai hôm nay đã nhận rồi thì bỏ qua.
  const { data: marks } = await admin
    .from('user_app_settings')
    .select('user_id, setting_value')
    .eq('setting_key', LOOKBACK_KEY)
  const alreadySent = new Set(
    (marks ?? [])
      .filter((m: { setting_value: unknown }) => String(m.setting_value ?? '').replace(/"/g, '') === todayVN)
      .map((m: { user_id: string }) => m.user_id),
  )

  const [entriesRes, habitRes] = await Promise.all([
    admin.from('daily_entries').select('user_id, entry_date, content').in('entry_date', days).is('deleted_at', null),
    admin.from('habit_logs').select('user_id, date, completed').in('date', days),
  ])

  let sent = 0
  for (const sub of subs) {
    if (alreadySent.has(sub.user_id)) continue

    const mineEntries = (entriesRes.data ?? []).filter((e: { user_id: string }) => e.user_id === sub.user_id)
    const mineHabits = (habitRes.data ?? []).filter(
      (h: { user_id: string; completed: boolean }) => h.user_id === sub.user_id && h.completed,
    )
    if (mineEntries.length === 0 && mineHabits.length === 0) continue

    // Ưu tiên mốc tuần trước; không có thì lấy tháng trước.
    const day = days.find((d) =>
      mineEntries.some((e: { entry_date: string }) => e.entry_date === d) ||
      mineHabits.some((h: { date: string }) => h.date === d),
    )
    if (!day) continue

    const dayEntries = mineEntries.filter((e: { entry_date: string }) => e.entry_date === day)
    const dayHabits = mineHabits.filter((h: { date: string }) => h.date === day)
    const parts: string[] = []
    if (dayEntries.length) parts.push(`${dayEntries.length} nhật ký`)
    if (dayHabits.length) parts.push(`${dayHabits.length} thói quen`)

    const ok = await push(
      sub,
      JSON.stringify({
        title: day === days[0] ? 'Ngày này tuần trước' : 'Ngày này tháng trước',
        body: parts.join(' · ') || 'Xem lại hôm đó',
        url: `/home?date=${day}`,
        tag: `lookback-${day}`,
      }),
    )
    if (!ok) continue
    sent++
    await admin
      .from('user_app_settings')
      .upsert(
        { setting_key: LOOKBACK_KEY, user_id: sub.user_id, setting_value: todayVN, updated_at: now.toISOString() },
        { onConflict: 'user_id,setting_key' },
      )
  }
  return sent
}

serve(async () => {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) {
    return new Response(JSON.stringify({ error: 'Chưa đặt khoá VAPID' }), { status: 500 })
  }
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', publicKey, privateKey)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const now = new Date()

  /** Gửi một payload tới một đăng ký; dọn đăng ký chết. Trả true nếu gửi được. */
  const push = async (sub: Sub, payload: string): Promise<boolean> => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      return true
    } catch (error) {
      // 404/410 = đã gỡ app hoặc thu hồi quyền: dọn luôn cho khỏi gửi mãi vào chỗ chết.
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id)
      return false
    }
  }

  const lookBackSent = await sendLookBack(admin, now, push)

  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10)

  const { data: todoRows } = await admin
    .from('todos')
    .select('id, user_id, title, due_date, due_time')
    .eq('completed', false)
    .gte('due_date', today)
    .lte('due_date', tomorrow)
    .is('deleted_at', null)

  const due = ((todoRows ?? []) as Todo[]).filter((todo) => {
    const minutes = (deadlineOf(todo).getTime() - now.getTime()) / 60_000
    return minutes > 0 && minutes <= LEAD_MINUTES
  })
  if (!due.length) {
    return new Response(JSON.stringify({ sent: 0, due: 0, lookBack: lookBackSent }))
  }

  const { data: subRows } = await admin
    .from('push_subscriptions')
    .select('*')
    .in('user_id', [...new Set(due.map((t) => t.user_id))])

  let sent = 0
  for (const sub of (subRows ?? []) as Sub[]) {
    const mine = due.filter((todo) => todo.user_id === sub.user_id)
    if (!mine.length) continue

    const first = mine[0]
    const minutes = Math.round((deadlineOf(first).getTime() - now.getTime()) / 60_000)
    const payload = JSON.stringify({
      title: mine.length > 1 ? `${mine.length} việc sắp tới hạn` : 'Sắp tới hạn',
      body: `${first.title} — còn ${minutes} phút`,
      url: `/tasks?todo=${first.id}`,
      tag: `due-${first.id}`,
    })

    if (await push(sub, payload)) {
      await admin.from('push_subscriptions').update({ last_sent_at: now.toISOString() }).eq('id', sub.id)
      sent++
    }
  }

  return new Response(JSON.stringify({ sent, due: due.length, lookBack: lookBackSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
