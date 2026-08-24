/**
 * Gộp các lần gọi dồn dập vào đúng một lần mỗi khung hình.
 *
 * Dùng cho `scroll`: trình duyệt bắn hàng chục sự kiện mỗi giây, mà trong handler
 * của reader có ghi localStorage cả mảng log và gọi mạng — không gộp thì cuộn nhanh
 * là giật và spam.
 *
 * `cancel()` để gỡ lúc cleanup effect, tránh chạy nốt một nhịp sau khi đã unmount.
 */
export function rafThrottle<T extends (...args: never[]) => void>(fn: T) {
  let frame: number | null = null
  let lastArgs: Parameters<T> | null = null

  const throttled = (...args: Parameters<T>) => {
    lastArgs = args
    if (frame !== null) return
    frame = requestAnimationFrame(() => {
      frame = null
      if (lastArgs) fn(...lastArgs)
    })
  }

  throttled.cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    lastArgs = null
  }

  return throttled
}
