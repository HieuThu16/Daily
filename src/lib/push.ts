import { supabase } from './supabase'

/** Khoá công khai VAPID, đặt trong .env: VITE_VAPID_PUBLIC_KEY=… */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY)

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

/**
 * Lấy service worker, chờ nó kích hoạt xong nếu cần.
 *
 * `getRegistration()` trả về NGAY: tải lại trang mà service worker chưa kịp
 * kích hoạt thì nó là `undefined`, và công tắc hiện TẮT dù đăng ký vẫn còn
 * nguyên trên máy lẫn trên Supabase. `ready` thì chờ, nhưng máy chưa từng đăng
 * ký service worker nào thì nó KHÔNG BAO GIỜ resolve — nên phải kèm hạn giờ.
 */
export async function getReadyRegistration(timeoutMs = 3000): Promise<ServiceWorkerRegistration | undefined> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs)),
  ])
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const registration = await getReadyRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false

  // Máy còn đăng ký mà Supabase mất dòng (xoá tay, hết hạn…) thì ghi lại — nếu
  // không, app tưởng đang bật nhưng máy chủ không biết đẩy đi đâu.
  void ensureSubscriptionSaved(subscription)
  return true
}

/** Ghi lại đăng ký lên Supabase; lỗi thì nuốt, đây chỉ là bước vá lệch. */
async function ensureSubscriptionSaved(subscription: PushSubscription): Promise<void> {
  try {
    await supabase?.from('push_subscriptions').upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: keyOf(subscription, 'p256dh'),
        auth: keyOf(subscription, 'auth'),
      },
      { onConflict: 'endpoint' },
    )
  } catch (err) {
    console.warn('[push] không đồng bộ lại được đăng ký:', err)
  }
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
  const registration = await getReadyRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await supabase?.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/**
 * Bắn một thông báo sang thiết bị của người kia (cảnh báo vị trí).
 * Lỗi thì nuốt: không báo được cũng đừng làm hỏng luồng cập nhật vị trí.
 */
export async function notifyPartner(title: string, body: string, url = '/people', tag?: string): Promise<void> {
  await sendPush({ title, body, url, tag })
}

/**
 * Bắn thông báo tới ĐÚNG những người này (theo user id).
 *
 * Khác `notifyPartner` ở chỗ không rải cho mọi người còn lại — dùng khi chia sẻ
 * "Xem chung" cho một Gmail cụ thể, để người thứ ba không nhận nhầm.
 */
export async function notifyUsers(
  userIds: string[],
  title: string,
  body: string,
  url = '/watch',
  tag?: string,
): Promise<void> {
  if (userIds.length === 0) return
  await sendPush({ title, body, url, tag, toUserIds: userIds })
}

/** Lỗi thì nuốt: không báo được cũng đừng làm hỏng luồng đang chạy. */
async function sendPush(payload: Record<string, unknown>): Promise<void> {
  try {
    const session = (await supabase?.auth.getSession())?.data?.session
    if (!session) return
    await supabase!.functions.invoke('notify-partner', { body: payload })
  } catch (err) {
    console.warn('[push] không gửi được thông báo:', err)
  }
}
