export type VideoCategoryType = 'tvshow' | 'review'

export type CategoryMeta = {
  id: string
  name: string
  icon: string // emoji or icon name
  color: string
  gradient: string
  description: string
  keywords: string[]
}

export const TVSHOW_CATEGORIES: CategoryMeta[] = [
  {
    id: 'learning',
    name: 'Học tập & Tri thức',
    icon: '📚',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.05))',
    description: 'Phương pháp học, đọc sách, tóm tắt sách, kiến thức khoa học và tư duy',
    keywords: [
      'học tập', 'học', 'đọc sách', 'tóm tắt sách', 'sách hay', 'sách nói', 'tri thức',
      'kiến thức', 'tư duy', 'phương pháp', 'khoa học', 'lịch sử', 'ghi nhớ', 'tiếng anh',
      'ngoại ngữ', 'kỹ năng học', 'bí quyết', 'bài học', 'giáo dục', 'thông minh', 'iq',
      'não bộ', 'vũ trụ', 'khám phá', 'nguyên lý', 'nghiên cứu', 'kỷ luật học'
    ],
  },
  {
    id: 'confidence',
    name: 'Tự tin & Bản lĩnh',
    icon: '🔥',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.05))',
    description: 'Rèn luyện sự tự tin, vượt qua sợ hãi, xây dựng nghị lực và thói quen tích cực',
    keywords: [
      'tự tin', 'bản lĩnh', 'động lực', 'nghị lực', 'vượt khó', 'kiên trì', 'thói quen',
      'kỷ luật', 'dũng cảm', 'sợ hãi', 'thay đổi bản thân', 'vượt qua', 'nỗ lực', 'thất bại',
      'thành công', 'ý chí', 'năng lượng', 'tích cực', 'nâng tầm', 'bứt phá', 'quyết tâm',
      'vươn lên', 'trưởng thành', 'mạnh mẽ', 'khát vọng'
    ],
  },
  {
    id: 'communication',
    name: 'Giao tiếp & Ứng xử',
    icon: '💬',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.05))',
    description: 'Nghệ thuật giao tiếp, thuyết trình, đàm phán, tâm lý ứng xử và kết nối',
    keywords: [
      'giao tiếp', 'ứng xử', 'thuyết trình', 'nói chuyện', 'nghệ thuật giao tiếp', 'đàm phán',
      'lắng nghe', 'khéo léo', 'thuyết phục', 'tâm lý', 'thiện cảm', 'kết nối', 'hướng nội',
      'người lạ', 'từ chối', 'bắt chuyện', 'tranh luận', 'cư xử', 'đối nhân xử thế', 'khiêm tốn',
      'khen ngợi', 'ngôn từ', 'giọng nói', 'lời nói', 'hài lòng'
    ],
  },
  {
    id: 'business',
    name: 'Kinh doanh & Tài chính',
    icon: '💰',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.05))',
    description: 'Quản lý tài chính cá nhân, đầu tư, kinh doanh, làm giàu và năng suất làm việc',
    keywords: [
      'kinh doanh', 'tài chính', 'tiền bạc', 'làm giàu', 'đầu tư', 'khởi nghiệp', 'quản lý tiền',
      'tự do tài chính', 'bán hàng', 'marketing', 'quản lý thời gian', 'năng suất', 'sự nghiệp',
      'công việc', 'thu nhập', 'chi tiêu', 'tiết kiệm', 'chứng khoán', 'bất động sản', 'lãnh đạo',
      'startup', 'doanh nhân', 'quản trị'
    ],
  },
  {
    id: 'psychology',
    name: 'Tâm lý & Cuộc sống',
    icon: '🌱',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.05))',
    description: 'Tâm lý học, chữa lành, quản lý cảm xúc, bình an nội tâm và quan hệ gia đình',
    keywords: [
      'tâm lý', 'chữa lành', 'bình an', 'thấu hiểu', 'stress', 'lo âu', 'trầm cảm', 'cảm xúc',
      'triết lý', 'sống đẹp', 'nhân sinh', 'tình yêu', 'gia đình', 'hạnh phúc', 'nội tâm',
      'buông bỏ', 'an yên', 'chánh niệm', 'tâm hồn', 'suy nghĩ', 'cuộc đời', 'hôn nhân'
    ],
  },
  {
    id: 'talkshow',
    name: 'Talkshow & Chia sẻ',
    icon: '🎙️',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.05))',
    description: 'Talkshow, phỏng vấn nhân vật truyền cảm hứng, podcast và câu chuyện đời thực',
    keywords: [
      'talkshow', 'podcast', 'phỏng vấn', 'tâm sự', 'chia sẻ', 'vlog', 'câu chuyện', 'khách mời',
      'trò chuyện', 'trải nghiệm', 'góc nhìn', 'show', 'người nổi tiếng', 'chuyện đời'
    ],
  },
  {
    id: 'health',
    name: 'Sức khoẻ & Thể chất',
    icon: '💪',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(21, 128, 61, 0.05))',
    description: 'Dinh dưỡng, tập luyện, giấc ngủ, tuổi thọ và chăm sóc cơ thể',
    keywords: [
      'sức khoẻ', 'sức khỏe', 'dinh dưỡng', 'tập luyện', 'gym', 'thể dục', 'giấc ngủ', 'ngủ ngon',
      'ăn uống', 'giảm cân', 'tuổi thọ', 'sống thọ', 'bệnh', 'miễn dịch', 'chạy bộ', 'yoga',
      'thiền', 'cơ thể', 'hồi phục', 'thải độc'
    ],
  },
  {
    id: 'spiritual',
    name: 'Tâm linh & Phật pháp',
    icon: '🪷',
    color: '#d97706',
    gradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2), rgba(180, 83, 9, 0.05))',
    description: 'Phật pháp, nhân quả, thiền định, đạo lý và giá trị tâm linh',
    keywords: [
      'phật', 'phật pháp', 'nhân quả', 'nghiệp', 'tâm linh', 'thiền định', 'giác ngộ', 'kinh phật',
      'đạo phật', 'luân hồi', 'phúc đức', 'tu tâm', 'thiện lành', 'vô thường', 'cổ nhân', 'lời phật dạy'
    ],
  },
  {
    id: 'tech',
    name: 'Công nghệ & AI',
    icon: '🤖',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(2, 132, 199, 0.05))',
    description: 'Công nghệ, trí tuệ nhân tạo, lập trình và xu hướng số',
    keywords: [
      'công nghệ', 'ai', 'trí tuệ nhân tạo', 'chatgpt', 'lập trình', 'phần mềm', 'máy tính',
      'internet', 'blockchain', 'crypto', 'điện thoại', 'ứng dụng', 'chuyển đổi số', 'robot',
      'dữ liệu', 'automation', 'kỹ thuật số'
    ],
  },
  {
    id: 'relationship',
    name: 'Tình yêu & Mối quan hệ',
    icon: '💞',
    color: '#e11d48',
    gradient: 'linear-gradient(135deg, rgba(225, 29, 72, 0.2), rgba(190, 18, 60, 0.05))',
    description: 'Tình yêu, hôn nhân, nuôi dạy con và cách giữ gìn các mối quan hệ',
    keywords: [
      'tình yêu', 'người yêu', 'hôn nhân', 'vợ chồng', 'chia tay', 'tán tỉnh', 'crush', 'hẹn hò',
      'nuôi dạy con', 'dạy con', 'cha mẹ', 'bạn bè', 'mối quan hệ', 'đàn ông', 'phụ nữ',
      'giữ chồng', 'giữ vợ', 'ly hôn'
    ],
  },
  {
    id: 'other',
    name: 'Tổng hợp & Khác',
    icon: '✨',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, rgba(100, 116, 139, 0.2), rgba(71, 85, 105, 0.05))',
    description: 'Các video kỹ năng, thư giãn và chủ đề thú vị khác',
    keywords: [],
  },
]

export const REVIEW_CATEGORIES: CategoryMeta[] = [
  {
    id: 'action',
    name: 'Phim Hành Động & Võ Thuật',
    icon: '💥',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.05))',
    description: 'Phim hành động kịch tính, combat mãn nhãn, võ thuật, sát thủ và rượt đuổi',
    keywords: [
      'hành động', 'võ thuật', 'sát thủ', 'bắn súng', 'rượt đuổi', 'mafia', 'giang hồ', 'chiến tranh',
      'đặc nhiệm', 'ninja', 'kungfu', 'action', 'đấm bốc', 'báo thù', 'đột kích', 'trùm', 'đặc công',
      'đấu võ', 'súng', 'băng đảng', 'sát nhân hàng loạt'
    ],
  },
  {
    id: 'korea',
    name: 'Phim Hàn Quốc',
    icon: '🇰🇷',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.05))',
    description: 'K-Drama, điện ảnh Hàn Quốc, tài phiệt, gay cấn và tình cảm xứ kim chi',
    keywords: [
      'hàn quốc', 'hàn', 'k-drama', 'k-movie', 'korea', 'korean', 'seoul', 'kim chi', 'oppa',
      'chủ tịch hàn', 'tài phiệt hàn', 'bác sĩ hàn', 'phim hàn'
    ],
  },
  {
    id: 'hollywood',
    name: 'Phim Mỹ & Hollywood',
    icon: '🎬',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.05))',
    description: 'Siêu phẩm Hollywood, bom tấn Âu Mỹ, Marvel, DC và thế giới điện ảnh phương Tây',
    keywords: [
      'mỹ', 'hollywood', 'us', 'uk', 'âu mỹ', 'marvel', 'dc', 'siêu anh hùng', 'avengers', 'fbi',
      'cia', 'new york', 'phim mỹ', 'người nhện', 'batman', 'iron man', 'quái vật mỹ', 'california'
    ],
  },
  {
    id: 'china',
    name: 'Phim Trung Quốc & Cổ Trang',
    icon: '🏮',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.05))',
    description: 'Kiếm hiệp, tiên hiệp, cung đấu, cổ trang và điện ảnh Hoa ngữ đặc sắc',
    keywords: [
      'trung quốc', 'hoa ngữ', 'cổ trang', 'kiếm hiệp', 'tiên hiệp', 'cung đấu', 'võ hiệp',
      'tam quốc', 'châu tinh trì', 'phim trung', 'huyền huyễn', 'tu tiên', 'hoàng đế', 'thần thoại trung'
    ],
  },
  {
    id: 'horror',
    name: 'Phim Kinh Dị & Giật Gân',
    icon: '👻',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(126, 34, 206, 0.05))',
    description: 'Phim ma, tâm linh, giật gân, ám ảnh tâm lý và vụ án bí ẩn rùng rợn',
    keywords: [
      'kinh dị', 'ma', 'quỷ', 'giật gân', 'rùng rợn', 'thriller', 'horror', 'ám ảnh', 'jumpscare',
      'trinh thám', 'sát nhân', 'tâm thần', 'nguyền rủa', 'bí ẩn', 'quái dị', 'căn nhà ma',
      'nghĩa địa', 'tà đạo', 'tội phạm bí ẩn'
    ],
  },
  {
    id: 'scifi',
    name: 'Viễn Tưởng & Sinh Tồn',
    icon: '🚀',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.05))',
    description: 'Khoa học viễn tưởng, vũ trụ, du hành thời gian, AI robot, zombie và sinh tồn tận thế',
    keywords: [
      'khoa học viễn tưởng', 'viễn tưởng', 'sci-fi', 'vũ trụ', 'robot', 'ngoài hành tinh',
      'du hành thời gian', 'tương lai', 'sinh tồn', 'tận thế', 'zombie', 'thảm hoạ', 'đảo hoang',
      'quái vật', 'ai', 'người máy', 'người ngoài hành tinh', 'đa vũ trụ'
    ],
  },
  {
    id: 'anime',
    name: 'Anime & Hoạt Hình',
    icon: '🎨',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.05))',
    description: 'Anime Nhật Bản, hoạt hình 3D, thế giới manga chuyển thể và hoạt họa huyền ảo',
    keywords: [
      'anime', 'hoạt hình', 'manga', '3d', 'wibu', 'ghibli', 'naruto', 'one piece', 'doraemon',
      'hoạt hoạ', 'isekai', 'chuyển sinh', 'japan anime', 'hoạt hình 3d'
    ],
  },
  {
    id: 'comedy',
    name: 'Phim Hài Hước',
    icon: '🤣',
    color: '#eab308',
    gradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.05))',
    description: 'Phim hài hước, cười bể bụng, tình huống bất ngờ và giải trí cực sảng khoái',
    keywords: [
      'hài hước', 'hài', 'cười bể bụng', 'hài bựa', 'vui nhộn', 'parody', 'cười ngả nghiêng',
      'dở khóc dở cười', 'siêu hài', 'tấu hài', 'cười té ghế'
    ],
  },
  {
    id: 'romance',
    name: 'Tình Cảm & Tâm Lý',
    icon: '💖',
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(225, 29, 72, 0.05))',
    description: 'Phim tâm lý tình cảm, thanh xuân ngọt ngào, gia đình cảm động và đẫm nước mắt',
    keywords: [
      'tình cảm', 'lãng mạn', 'thanh xuân', 'gia đình', 'tâm lý', 'tình yêu', 'drama', 'cảm động',
      'nước mắt', 'ngôn tình', 'hôn nhân', 'chia tay', 'mẹ chồng', 'người yêu', 'mối tình'
    ],
  },
  {
    id: 'blockbuster',
    name: 'Bom Tấn & Chiếu Rạp',
    icon: '🏆',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.05))',
    description: 'Siêu phẩm chiếu rạp, bom tấn phòng vé và giải mã tóm tắt phim đỉnh cao',
    keywords: [
      'chiếu rạp', 'bom tấn', 'siêu phẩm', 'giải mã phim', 'tóm tắt phim', 'phim rạp', 'phòng vé',
      'siêu phẩm điện ảnh', 'top phim', 'review phim'
    ],
  },
  {
    id: 'crime',
    name: 'Hình Sự & Tội Phạm',
    icon: '🚔',
    color: '#0f766e',
    gradient: 'linear-gradient(135deg, rgba(15, 118, 110, 0.2), rgba(13, 148, 136, 0.05))',
    description: 'Phá án, điều tra, cảnh sát, luật sư và thế giới ngầm tội phạm',
    keywords: [
      'hình sự', 'tội phạm', 'phá án', 'điều tra', 'cảnh sát', 'thám tử', 'luật sư', 'toà án',
      'nhà tù', 'vượt ngục', 'buôn lậu', 'ma tuý', 'lừa đảo', 'cướp ngân hàng', 'trộm cắp', 'hồ sơ vụ án'
    ],
  },
  {
    id: 'japan',
    name: 'Phim Nhật Bản',
    icon: '🇯🇵',
    color: '#dc2626',
    gradient: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2), rgba(153, 27, 27, 0.05))',
    description: 'Điện ảnh và phim truyền hình Nhật Bản, samurai, yakuza và văn hoá xứ Phù Tang',
    keywords: [
      'nhật bản', 'phim nhật', 'japan', 'samurai', 'yakuza', 'tokyo', 'j-drama', 'xứ phù tang',
      'người nhật', 'kimono'
    ],
  },
  {
    id: 'vietnam',
    name: 'Phim Việt Nam',
    icon: '🇻🇳',
    color: '#ca8a04',
    gradient: 'linear-gradient(135deg, rgba(202, 138, 4, 0.2), rgba(161, 98, 7, 0.05))',
    description: 'Phim Việt, phim chiếu rạp trong nước và câu chuyện thuần Việt',
    keywords: [
      'việt nam', 'phim việt', 'điện ảnh việt', 'miền tây', 'sài gòn', 'hà nội', 'phim vn',
      'trấn thành', 'thái hoà', 'phim truyền hình việt'
    ],
  },
  {
    id: 'fantasy',
    name: 'Giả Tưởng & Phép Thuật',
    icon: '🧙',
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(91, 33, 182, 0.05))',
    description: 'Thế giới phép thuật, rồng, phù thuỷ, thần thoại và các vương quốc giả tưởng',
    keywords: [
      'phép thuật', 'phù thuỷ', 'phù thủy', 'rồng', 'thần thoại', 'giả tưởng', 'fantasy', 'hogwarts',
      'harry potter', 'ma thuật', 'tiên nữ', 'yêu tinh', 'vương quốc', 'hiệp sĩ', 'lời nguyền cổ xưa'
    ],
  },
  {
    id: 'history',
    name: 'Lịch Sử & Chiến Tranh',
    icon: '⚔️',
    color: '#78716c',
    gradient: 'linear-gradient(135deg, rgba(120, 113, 108, 0.2), rgba(87, 83, 78, 0.05))',
    description: 'Phim lịch sử, chiến tranh, quân đội và những sự kiện có thật',
    keywords: [
      'lịch sử', 'chiến tranh', 'thế chiến', 'quân đội', 'lính', 'trận đánh', 'cách mạng',
      'đế chế', 'chuyện có thật', 'dựa trên có thật', 'nazi', 'việt nam chiến tranh', 'cổ đại'
    ],
  },
  {
    id: 'school',
    name: 'Học Đường & Thanh Xuân',
    icon: '🎒',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.05))',
    description: 'Phim học đường, tuổi trẻ, bạn bè, thầy cô và mối tình đầu',
    keywords: [
      'học đường', 'học sinh', 'sinh viên', 'trường học', 'lớp học', 'thầy cô', 'bắt nạt',
      'tuổi trẻ', 'mối tình đầu', 'tốt nghiệp', 'đại học', 'cấp 3', 'thanh xuân vườn trường'
    ],
  },
  {
    id: 'other',
    name: 'Tổng hợp & Thể loại khác',
    icon: '🍿',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, rgba(100, 116, 139, 0.2), rgba(71, 85, 105, 0.05))',
    description: 'Các bộ phim review xuất sắc và chủ đề hấp dẫn khác',
    keywords: [],
  },
]

/**
 * Chuẩn hóa chuỗi để so khớp từ khóa tiếng Việt / không dấu / có dấu
 */
export function normalizeKeyword(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chấm điểm 1 video với toàn bộ thể loại, trả về danh sách thể loại khớp (điểm > 0)
 * đã sắp xếp giảm dần. 1 video có thể thuộc nhiều thể loại.
 */
export function detectVideoCategories(
  title: string,
  type: VideoCategoryType = 'tvshow',
  description?: string,
  maxCategories = 3
): CategoryMeta[] {
  const categories = type === 'tvshow' ? TVSHOW_CATEGORIES : REVIEW_CATEGORIES
  const fallback = categories[categories.length - 1] // 'other'

  if (!title) return [fallback]

  const originalText = (title + ' ' + (description || '')).toLowerCase()
  const normalizedText = normalizeKeyword(originalText)

  const scored: { cat: CategoryMeta; score: number }[] = []

  for (const cat of categories) {
    if (cat.id === 'other') continue

    let matchCount = 0
    for (const kw of cat.keywords) {
      const origKw = kw.toLowerCase()
      const normKw = normalizeKeyword(kw)

      // Kiểm tra cả nguyên bản có dấu và không dấu
      if (originalText.includes(origKw) || normalizedText.includes(normKw)) {
        // Ưu tiên từ khóa dài hơn / chính xác hơn
        matchCount += kw.length > 5 ? 2 : 1
      }
    }

    if (matchCount > 0) scored.push({ cat, score: matchCount })
  }

  // Tầng 2: chưa khớp cụm từ khoá nào -> khớp mềm theo từng từ trong tiêu đề
  // (vd "phim ma quỷ ám" khớp từ "ma" của thể loại Kinh dị)
  if (!scored.length) {
    const titleTokens = new Set(normalizedText.split(' ').filter((t) => t.length >= 3))
    for (const cat of categories) {
      if (cat.id === 'other') continue
      let soft = 0
      for (const kw of cat.keywords) {
        for (const part of normalizeKeyword(kw).split(' ')) {
          if (part.length >= 3 && titleTokens.has(part)) {
            soft += 1
            break
          }
        }
      }
      if (soft > 0) scored.push({ cat, score: soft })
    }
  }

  // Tầng 3: vẫn không nhận diện được -> dồn vào thể loại rộng nhất của từng mảng
  // thay vì để trống, để mọi video luôn có thể loại
  if (!scored.length) {
    const catchAllId = type === 'review' ? 'blockbuster' : 'psychology'
    const catchAll = categories.find((c) => c.id === catchAllId)
    return [catchAll || fallback]
  }

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0].score
  // Giữ thể loại phụ đủ mạnh (>= 25% điểm cao nhất, tối thiểu 1 từ khoá dài)
  // để 1 video có thể thuộc 2-3 thể loại mà không bị gán tràn lan
  const threshold = Math.min(best, Math.max(2, best / 4))
  return scored
    .filter((s) => s.score >= threshold)
    .slice(0, maxCategories)
    .map((s) => s.cat)
}

/**
 * Tự động phân loại 1 video dựa theo Tiêu đề (và mô tả nếu có) - lấy thể loại chính
 */
export function detectVideoCategory(
  title: string,
  type: VideoCategoryType = 'tvshow',
  description?: string
): CategoryMeta {
  return detectVideoCategories(title, type, description)[0]
}

/**
 * Bản đồ thể loại người dùng sửa tay: video_id -> danh sách category id.
 * Mảng rỗng nghĩa là người dùng cố ý bỏ hết thể loại -> về "Tổng hợp & Khác".
 */
export type CategoryOverrides = Record<string, string[]>

export function getCategoriesById(ids: string[], type: VideoCategoryType): CategoryMeta[] {
  const categories = type === 'tvshow' ? TVSHOW_CATEGORIES : REVIEW_CATEGORIES
  return ids.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as CategoryMeta[]
}

/**
 * Thể loại cuối cùng của 1 video: ưu tiên bản sửa tay, không có thì tự nhận diện.
 */
export function resolveVideoCategories(
  videoId: string,
  title: string,
  type: VideoCategoryType = 'tvshow',
  overrides?: CategoryOverrides
): CategoryMeta[] {
  const manual = overrides?.[videoId]
  if (manual) {
    const resolved = getCategoriesById(manual, type)
    if (resolved.length) return resolved
    const categories = type === 'tvshow' ? TVSHOW_CATEGORIES : REVIEW_CATEGORIES
    return [categories[categories.length - 1]] // 'other'
  }
  return detectVideoCategories(title, type)
}

/**
 * Cấu trúc Gom nhóm Thể loại kèm Video và thống kê
 */
export type CategorizedGroup<T = any> = {
  category: CategoryMeta
  videos: T[]
  totalCount: number
  inProgressCount: number
  watchedCount: number
  cover: string | null
}

/**
 * Gom toàn bộ danh sách video theo Thể loại
 */
export function groupVideosByCategory<T extends { title: string; video_id: string; thumbnail?: string | null }>(
  videos: T[],
  type: VideoCategoryType,
  watchedSet: Set<string> = new Set(),
  inProgressSetOrOverrides?: Set<string> | CategoryOverrides,
  overrides?: CategoryOverrides
): CategorizedGroup<T>[] {
  let inProgressSet: Set<string> = new Set()
  let finalOverrides = overrides

  if (inProgressSetOrOverrides instanceof Set) {
    inProgressSet = inProgressSetOrOverrides
  } else if (inProgressSetOrOverrides && typeof inProgressSetOrOverrides === 'object') {
    finalOverrides = inProgressSetOrOverrides as CategoryOverrides
  }

  const categories = type === 'tvshow' ? TVSHOW_CATEGORIES : REVIEW_CATEGORIES
  const map = new Map<string, { category: CategoryMeta; videos: T[]; inProgress: number; watched: number; cover: string | null }>()

  // Khởi tạo map cho tất cả categories
  for (const cat of categories) {
    map.set(cat.id, {
      category: cat,
      videos: [],
      inProgress: 0,
      watched: 0,
      cover: null,
    })
  }

  // Phân loại từng video
  for (const v of videos) {
    // 1 video có thể nằm ở nhiều thể loại cùng lúc
    for (const cat of resolveVideoCategories(v.video_id, v.title, type, finalOverrides)) {
      const entry = map.get(cat.id) || map.get('other')!
      entry.videos.push(v)
      if (watchedSet.has(v.video_id)) {
        entry.watched += 1
      } else if (inProgressSet.has(v.video_id)) {
        entry.inProgress += 1
      }
      if (!entry.cover && v.thumbnail) {
        entry.cover = v.thumbnail
      }
    }
  }

  // Trả về danh sách, chỉ lấy các category có video hoặc luôn hiển thị các category chính
  const results: CategorizedGroup<T>[] = []
  for (const cat of categories) {
    const entry = map.get(cat.id)!
    if (entry.videos.length > 0) {
      results.push({
        category: entry.category,
        videos: entry.videos,
        totalCount: entry.videos.length,
        inProgressCount: entry.inProgress,
        watchedCount: entry.watched,
        cover: entry.cover || (entry.videos[0] as any)?.thumbnail || null,
      })
    }
  }

  return results
}
