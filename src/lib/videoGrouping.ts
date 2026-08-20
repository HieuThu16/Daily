/**
 * Nhãn mốc thời gian cho danh sách video xếp theo ngày đăng:
 * "Tuần này" → "Tháng này" → "Tháng 5/2026" → "Năm 2024".
 * Dùng làm tiêu đề dính giữa dải thẻ để biết mình đang cuộn tới đoạn nào.
 */
export function publishedGroupLabel(publishedAt: string | null | undefined, today = new Date()): string {
  if (!publishedAt) return 'Chưa rõ ngày đăng'
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return 'Chưa rõ ngày đăng'

  const days = Math.floor((today.getTime() - date.getTime()) / 86_400_000)
  if (days < 7) return 'Tuần này'
  if (date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) return 'Tháng này'
  if (date.getFullYear() === today.getFullYear()) return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`
  return `Năm ${date.getFullYear()}`
}
