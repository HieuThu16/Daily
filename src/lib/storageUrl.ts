/**
 * Sửa link Supabase Storage bị thiếu đoạn `/public/`.
 *
 * Bảng điều khiển Supabase hiển thị đường dẫn dạng
 * `/storage/v1/object/<bucket>/<file>` — đó là endpoint CÓ xác thực, cần header
 * Authorization. Dán nó vào thẻ <img> thì trình duyệt không gửi header nào nên
 * luôn nhận 400. Link dùng được cho ảnh là
 * `/storage/v1/object/public/<bucket>/<file>`.
 *
 * Người dùng rất dễ copy nhầm dạng đầu, nên chuẩn hoá ngay lúc lưu thay vì để
 * ảnh hỏng rồi mới đi tìm nguyên nhân.
 */

const STORAGE_PREFIX = '/storage/v1/object/'
/** Các đoạn đứng ngay sau prefix mà KHÔNG phải tên bucket. */
const KNOWN_MODES = ['public', 'sign', 'authenticated', 'upload', 'info']

export function normalizeStorageUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return value

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return value
  }

  if (!url.hostname.endsWith('.supabase.co')) return value

  const index = url.pathname.indexOf(STORAGE_PREFIX)
  if (index === -1) return value

  const rest = url.pathname.slice(index + STORAGE_PREFIX.length)
  const firstSegment = rest.split('/')[0]
  // Đã có `public`, hoặc là link ký/upload thì để nguyên.
  if (!firstSegment || KNOWN_MODES.includes(firstSegment)) return value

  url.pathname = url.pathname.slice(0, index) + STORAGE_PREFIX + 'public/' + rest
  return url.toString()
}
