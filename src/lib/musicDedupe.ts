import type { Media } from '../types'

/**
 * Gộp các bản nhạc trùng nhau về một.
 *
 * Mỗi lần lấy lại MP3 từ YouTube sinh một `audio_url` mới, nên bài được chia sẻ
 * có thể vào thư viện nhiều lần dưới cùng tên + ca sĩ. Database đã khoá bằng
 * unique index (migration 20260920000002), hàm này lo nốt phần dữ liệu cũ còn
 * nằm trong cache máy để danh sách không hiện lặp.
 *
 * Bản được giữ: ưu tiên bản có MP3, rồi tới bản của chính mình (không phải bản chia sẻ).
 */
export function dedupeMusic(items: Media[], scope: 'library' | 'day' = 'library'): Media[] {
  const keep = new Map<string, Media>()

  for (const item of items) {
    if (item.type !== 'MUSIC') continue
    // Ở lịch/agenda phải kèm ngày: cùng bài nghe hai ngày khác nhau là hai lần nghe thật,
    // chỉ bản trùng trong *cùng một ngày* mới là rác do chia sẻ lặp.
    const dayPart = scope === 'day' ? `|${item.log_date ?? ''}` : ''
    const key = `${item.name.trim().toLowerCase()}|${(item.artist ?? '').trim().toLowerCase()}${dayPart}`
    const current = keep.get(key)
    if (!current || score(item) > score(current)) keep.set(key, item)
  }

  // Giữ nguyên thứ tự ban đầu: đi lại mảng gốc và chỉ nhả ra bản được chọn.
  const chosen = new Set([...keep.values()].map((m) => m.id))
  return items.filter((item) => item.type !== 'MUSIC' || chosen.has(item.id))
}

function score(item: Media): number {
  return (item.audio_url?.trim() ? 2 : 0) + (item.shared_by ? 0 : 1)
}
