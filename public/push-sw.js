/* Xử lý Web Push trong service worker.
   File nằm ở public/ và được workbox nạp bằng importScripts nên không đi qua bundler:
   giữ JS thuần, không import gì. */

self.addEventListener('push', (event) => {
  // Không có payload (vài trình duyệt gửi push rỗng để đánh thức) thì vẫn phải hiện gì đó:
  // nhận push mà im lặng sẽ bị trình duyệt phạt, lần sau không đẩy nữa.
  let data = { title: 'Daily', body: 'Bạn có việc sắp tới hạn.', url: '/tasks' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }

  var tag = data.tag || 'daily-reminder'

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      // Icon app cho dễ nhận ra giữa đống thông báo, badge là icon nhỏ trên thanh trạng thái.
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag,
      /*
       * renotify: cùng một tag thì mặc định trình duyệt thay lặng lẽ, KHÔNG kêu lại.
       * Bật lên để thông báo mới vẫn rung và kêu như Zalo. Bắt buộc phải có tag.
       */
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      data: { url: data.url || '/tasks' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/tasks'

  // Đang mở tab nào thì đưa tab đó tới nơi, không mở thêm cửa sổ mới.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
