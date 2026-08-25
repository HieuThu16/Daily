/**
 * POST /functions/v1/notify-partner  { title, body, url?, tag?, toUserIds? }
 *
 * Không có `toUserIds`: đẩy tới TẤT CẢ thiết bị của người kia (mọi đăng ký push
 * không thuộc người gọi) — dùng cho cảnh báo vị trí: "Hiếu đã tới Công ty".
 *
 * Có `toUserIds`: chỉ đẩy đúng những người đó — dùng khi chia sẻ "Xem chung"
 * cho một Gmail cụ thể, để người thứ ba không nhận nhầm thông báo.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return json({ error: 'Thiếu khoá VAPID' }, 500)
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', publicKey, privateKey)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Phải biết người gọi là ai, nếu không sẽ tự gửi thông báo về chính mình.
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '')
  if (!token) return json({ error: 'Thiếu đăng nhập' }, 401)
  const { data: me } = await admin.auth.getUser(token)
  if (!me?.user) return json({ error: 'Phiên đăng nhập không hợp lệ' }, 401)

  const { title, body, url, tag, toUserIds } = await req.json().catch(() => ({}))
  if (!title || !body) return json({ error: 'Thiếu title hoặc body' }, 400)

  // Gửi đích danh thì lọc theo danh sách; vẫn loại mình ra để khỏi tự báo cho chính mình.
  const targets = Array.isArray(toUserIds) ? toUserIds.filter((id: unknown) => typeof id === 'string' && id !== me.user.id) : null
  if (targets && targets.length === 0) return json({ sent: 0 })

  const query = admin.from('push_subscriptions').select('*')
  const { data: subRows } = targets
    ? await query.in('user_id', targets)
    : await query.neq('user_id', me.user.id)

  const payload = JSON.stringify({ title, body, url: url || '/people', tag: tag || 'location-alert' })
  let sent = 0
  for (const sub of (subRows ?? []) as Sub[]) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      sent++
    } catch (error) {
      // 404/410 = đã gỡ app hoặc thu hồi quyền: dọn luôn cho khỏi gửi mãi vào chỗ chết.
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }

  return json({ sent })
})
