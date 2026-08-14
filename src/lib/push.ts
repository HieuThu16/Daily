import { supabase } from './supabase'

/** Khoá công khai VAPID, đặt trong .env: VITE_VAPID_PUBLIC_KEY=… */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && Boolean(VAPID_PUBLIC_KEY)

/**
 * base64url của VAPID → ArrayBuffer, dạng PushManager nhận.
 * Trả ArrayBuffer chứ không phải Uint8Array vì kiểu `BufferSource` của lib.dom mới
 * không nhận `Uint8Array<ArrayBufferLike>` chung chung.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

const keyOf = (subscription: PushSubscription, name: 'p256dh' | 'auth') => {
  const key = subscription.getKey(name)
  if (!key) throw new Error('Trình duyệt không trả khoá mã hoá push.')
  return btoa(String.fromCharCode(...new Uint8Array(key)))
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  return Boolean(await registration?.pushManager.getSubscription())
}

/**
 * Xin quyền, đăng ký với trình duyệt, rồi lưu endpoint lên Supabase để edge function
 * `send-reminders` biết đẩy đi đâu. Lỗi ném ra đã là tiếng Việt để hiện thẳng cho người dùng.
 */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Thiết bị này không hỗ trợ thông báo đẩy.')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Bạn chưa cho phép hiện thông báo.')

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY!),
    }))

  const { error } = await supabase!.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: keyOf(subscription, 'p256dh'),
      auth: keyOf(subscription, 'auth'),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
}

/** Huỷ ở cả hai đầu: trình duyệt và bảng đăng ký. */
export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await supabase?.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
