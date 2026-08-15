/** Lịch sử cập nhật tính năng của ứng dụng.
 *  Thêm mục mới vào ĐẦU mảng (phần tử 0 = mới nhất).
 *  `id` dùng làm key localStorage để theo dõi xem người dùng đã đọc chưa.
 */
export type ChangelogEntry = {
  id: string
  date: string       // ISO date string, e.g. '2026-08-15'
  version?: string
  title: string
  description: string
  highlights: string[]
  type: 'feature' | 'fix' | 'improvement'
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 'v1.8-profile',
    date: '2026-08-15',
    version: '1.8',
    title: 'Tab Bản thân & Lịch sử cập nhật',
    description: 'Thêm tab Bản thân để xem profile, và hệ thống thông báo khi có tính năng mới.',
    highlights: [
      'Tab "Bản thân" mới – xem avatar, email, ngày tham gia',
      'Banner thông báo cập nhật mới nhất ngay trên trang profile',
      'Xem toàn bộ lịch sử cập nhật tính năng',
      'Đánh dấu đã đọc để ẩn thông báo',
    ],
    type: 'feature',
  },
  {
    id: 'v1.7-music',
    date: '2026-08-15',
    version: '1.7',
    title: 'Mini Player Nhạc toàn cục',
    description: 'Nghe nhạc mà không cần ở trong tab Nhạc — mini player nổi bên dưới màn hình.',
    highlights: [
      'Mini player hiện ở mọi trang khi đang phát nhạc',
      'Điều khiển: play/pause, bài trước/sau, thanh tiến trình',
      'Không bị mất trạng thái nhạc khi chuyển tab',
    ],
    type: 'feature',
  },
  {
    id: 'v1.6-ngontinh',
    date: '2026-08-15',
    version: '1.6',
    title: 'Đọc Ngôn Tình Online',
    description: 'Đọc truyện ngôn tình trực tiếp trong app, không cần mở trình duyệt.',
    highlights: [
      'Tab Ngôn Tình với danh sách truyện',
      'Đọc chương trực tiếp trong app',
      'Lưu vị trí đọc tự động',
    ],
    type: 'feature',
  },
  {
    id: 'v1.5-bl',
    date: '2026-08-14',
    version: '1.5',
    title: 'Thư Viện Truyện BL',
    description: 'Cào và đọc truyện BL từ nhiều nguồn khác nhau.',
    highlights: [
      'Cào tự động danh sách truyện',
      'Trang chi tiết truyện với các chương',
      'Lọc theo thể loại, trạng thái',
    ],
    type: 'feature',
  },
  {
    id: 'v1.4-money',
    date: '2026-08-10',
    version: '1.4',
    title: 'Quản Lý Tài Chính',
    description: 'Theo dõi thu chi, ví tiền và biểu đồ chi tiêu hằng tháng.',
    highlights: [
      'Tạo nhiều ví (tiền mặt, ngân hàng)',
      'Ghi thu chi nhanh',
      'Biểu đồ chi tiêu theo tháng',
    ],
    type: 'feature',
  },
  {
    id: 'v1.3-people',
    date: '2026-08-05',
    version: '1.3',
    title: 'Sổ Danh Bạ & Kỷ Niệm',
    description: 'Lưu thông tin người thân, bạn bè và các ngày kỷ niệm quan trọng.',
    highlights: [
      'Thêm người vào danh bạ',
      'Ghi chú nhật ký theo từng người',
      'Nhắc nhở sinh nhật, kỷ niệm',
    ],
    type: 'feature',
  },
  {
    id: 'v1.2-nutrition',
    date: '2026-07-28',
    version: '1.2',
    title: 'Nhật Ký Dinh Dưỡng',
    description: 'Ghi lại bữa ăn hằng ngày và theo dõi chi tiêu thực phẩm.',
    highlights: [
      'Ghi nhanh bữa sáng/trưa/chiều/tối',
      'Tính tổng chi phí ăn uống',
      'Xem lịch sử ăn theo ngày',
    ],
    type: 'feature',
  },
  {
    id: 'v1.1-library',
    date: '2026-07-20',
    version: '1.1',
    title: 'Thư Viện Sách & Phim',
    description: 'Quản lý sách, phim, nhạc và YouTube yêu thích.',
    highlights: [
      'Thêm sách, phim, nhạc, YouTube',
      'Đọc PDF/EPUB trực tiếp trong app',
      'Lưu quote và highlight từ sách',
    ],
    type: 'feature',
  },
  {
    id: 'v1.0-launch',
    date: '2026-07-10',
    version: '1.0',
    title: 'Ra Mắt Daily',
    description: 'Phiên bản đầu tiên của Daily – không gian cá nhân mỗi ngày.',
    highlights: [
      'Nhật ký hằng ngày (Feeling, Điều mới, Thất vọng, Chiến thắng nhỏ)',
      'Theo dõi thói quen hằng ngày',
      'Quản lý công việc (Tasks)',
    ],
    type: 'feature',
  },
]

export const CHANGELOG_SEEN_KEY = 'daily_changelog_seen'

/** Trả về id cập nhật mới nhất mà người dùng chưa đọc. null nếu đã đọc hết. */
export function getUnseenLatest(): ChangelogEntry | null {
  const seen = localStorage.getItem(CHANGELOG_SEEN_KEY)
  const latest = CHANGELOG[0]
  if (!latest) return null
  if (seen === latest.id) return null
  return latest
}

/** Đánh dấu đã xem thông báo mới nhất. */
export function markLatestSeen(): void {
  const latest = CHANGELOG[0]
  if (latest) localStorage.setItem(CHANGELOG_SEEN_KEY, latest.id)
}
