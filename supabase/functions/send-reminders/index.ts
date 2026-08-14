// Nhắc việc qua Web Push. Chạy định kỳ bằng pg_cron (xem migration 20260825000000).
// Deploy: supabase functions deploy send-reminders
// Secrets cần đặt: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

/** Nhắc khi còn ≤ ngần này phút nữa tới hạn — khớp ngưỡng nhắc trong app. */
const LEAD_MINUTES = 120

type Todo = { id: string; user_id: string; title: string; due_date: string; due_time: string | null }
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

/** Thời điểm hết hạn của một việc; không ghi giờ thì tính cuối ngày. */
const deadlineOf = (todo: Todo) => new Date(`${todo.due_date}T${todo.due_time || '23:59'}:00`)

serve(async () => {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) {
    return new Response(JSON.stringify({ error: 'Chưa đặt khoá VAPID' }), { status: 500 })
  }
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', publicKey, privateKey)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const now = new Date()
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
  if (!due.length) return new Response(JSON.stringify({ sent: 0, due: 0 }))

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

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      await admin.from('push_subscriptions').update({ last_sent_at: now.toISOString() }).eq('id', sub.id)
      sent++
    } catch (error) {
      // 404/410 = đã gỡ app hoặc thu hồi quyền: dọn luôn cho khỏi gửi mãi vào chỗ chết.
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }

  return new Response(JSON.stringify({ sent, due: due.length }), { headers: { 'Content-Type': 'application/json' } })
})
