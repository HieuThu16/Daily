/** Lịch sử cập nhật tính năng của ứng dụng.
 *  Thêm mục mới vào ĐẦU mảng (phần tử 0 = mới nhất).
 *  `id` dùng làm key localStorage để theo dõi xem người dùng đã đọc chưa.
 */
export type ChangelogEntry = {
  id: string
  date: string       // ISO date string, e.g. '2026-08-18'
  version?: string
  title: string
  description: string
  highlights: string[]
  type: 'feature' | 'fix' | 'improvement'
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 'v2.0-categories-review-super-update',
    date: '2026-08-18',
    version: '2.0',
    title: 'Xem Video Theo Thể Loại & Tự Động Phân Loại Thông Minh',
    description: 'Nâng cấp lớn v2.0 mang đến tính năng xem Video theo Thể Loại & Kênh, tự động gom nhóm video theo tiêu đề (Học tập, Tự tin, Giao tiếp, Phim Hành động, Hàn Quốc, Mỹ, Kinh dị, Anime...), cùng hàng loạt tối ưu hóa cho Thư viện Truyện, Sách và Flashcard Tiếng Anh.',
    highlights: [
      'TV Show & Review Phim: Bổ sung 2 chế độ xem — Xem theo Kênh và Xem theo Thể loại',
      'Tự động phân loại thể loại video dựa vào tiêu đề: Học tập, Tự tin, Giao tiếp, Kinh doanh, Phim Hành động, Hàn Quốc, Mỹ, Trung Quốc, Kinh dị, Viễn tưởng, Anime...',
      'Trình phát video nâng cấp: Chỉnh tốc độ 0.75x–2x, hẹn giờ tắt ngủ, tự chuyển tập liên tục, đánh dấu đã xem',
      'Thư viện Truyện BL & Ngôn Tình: Tải dữ liệu siêu tốc, giao diện đọc hiện đại và chuông thông báo chương mới',
      'Tab Tiếng Anh & Kiến thức: Flashcard lật mặt học từ vựng/mẫu câu và bộ thẻ hỏi đáp kiến thức đa chủ đề',
      'Tìm kiếm sách & bộ lọc nâng cao: Tìm kiếm nhanh theo tựa đề/tác giả/thể loại với ngăn kéo bộ lọc tiện lợi',
    ],
    type: 'feature',
  },
  {
    id: 'v1.9-comic-detail-redesign',
    date: '2026-08-16',
    version: '1.9',
    title: 'Giao diện chi tiết Truyện BL & Ngôn Tình mới',
    description: 'Nâng cấp toàn diện giao diện chi tiết truyện BL và Ngôn Tình với thiết kế chuẩn hiện đại, thanh thao tác 5 nút tiện lợi và danh sách chương tinh gọn.',
    highlights: [
      'Giao diện chi tiết truyện mới: bìa bo góc, lưới thống kê 2x2, huy hiệu xác thực và trạng thái',
      'Hàng 5 nút thao tác nhanh: Bắt đầu đọc, Tiếp tục đọc, Giới thiệu & Thể loại, Mở nguồn web, Yêu thích',
      'Phần Giới thiệu & Thể loại thu gọn linh hoạt, dễ dàng mở rộng khi cần',
      'Danh sách chương chuẩn hóa: hiển thị gọn gàng Chapter {N} và nút xem tất cả ở cuối trang',
      'Tối ưu hiển thị không che khuất chuông thông báo và thanh điều hướng'
    ],
    type: 'feature',
  },
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

const SEEN_STORAGE_KEY = 'daily_changelog_seen'

/** Trả về bản cập nhật mới nhất nếu người dùng chưa xem, hoặc null. */
export function getUnseenLatest(): ChangelogEntry | null {
  try {
    const seenId = localStorage.getItem(SEEN_STORAGE_KEY)
    const latest = CHANGELOG[0]
    if (!latest) return null
    if (seenId !== latest.id) return latest
  } catch (error) {
    console.warn('Không đọc được trạng thái changelog:', error)
  }
  return null
}

/** Đánh dấu người dùng đã xem bản cập nhật mới nhất. */
export function markLatestSeen(): void {
  try {
    const latest = CHANGELOG[0]
    if (latest) {
      localStorage.setItem(SEEN_STORAGE_KEY, latest.id)
    }
  } catch (error) {
    console.warn('Không lưu được trạng thái changelog:', error)
  }
}
