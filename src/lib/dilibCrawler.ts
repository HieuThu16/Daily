import { saveAudiobook } from './audiobookRepository'
import { supabase } from './supabase'
import type { Audiobook, DilibCategory } from '../types/audiobook'

export type UnifiedBookCategory = {
  id: string
  name: string
  icon: string
  dilibUrl?: string
  dtvUrl?: string
  keywords: string[]
}

/** Danh mục thể loại HỢP NHẤT từ cả 2 nguồn Dilib.vn và DTV-eBook.com.vn */
export const UNIFIED_CATEGORIES: UnifiedBookCategory[] = [
  // 1. Trinh thám & Hình sự & Bí ẩn
  {
    id: 'trinh-tham',
    name: 'Trinh Thám - Hình Sự - Bí Ẩn',
    icon: '🔍',
    dilibUrl: 'https://dilib.vn/thu-vien/trinh-tham-hinh-su-kinh-di/',
    dtvUrl: 'https://dtv-ebook.com.vn/trinh-tham-492.html',
    keywords: ['trinh thám', 'hình sự', 'kinh dị', 'vụ án', 'bí ẩn', 'sát nhân', 'thám tử'],
  },

  // 2. Tác phẩm kinh điển & Tinh hoa
  {
    id: 'tac-pham-kinh-dien',
    name: 'Tác Phẩm Kinh Điển',
    icon: '🏛️',
    dilibUrl: 'https://dilib.vn/thu-vien/tac-pham-kinh-dien/',
    dtvUrl: 'https://dtv-ebook.com.vn/van-hoc-kinh-dien-491.html',
    keywords: ['kinh điển', 'tác phẩm kinh điển', 'văn học kinh điển', 'danh tác', 'văn học nước ngoài'],
  },
  {
    id: 'tu-sach-tinh-hoa',
    name: 'Tủ Sách Tinh Hoa & Best Seller',
    icon: '💎',
    dilibUrl: 'https://dilib.vn/tu-sach-tinh-hoa/',
    dtvUrl: 'https://dtv-ebook.com.vn/best-seller-493.html',
    keywords: ['tinh hoa', 'tủ sách', 'bán chạy', 'best seller'],
  },
  {
    id: 'sach-noi',
    name: 'Sách Nói (Audiobooks)',
    icon: '🎧',
    dilibUrl: 'https://dilib.vn/sach-noi/',
    dtvUrl: 'https://dtv-ebook.com.vn/sach-noi-5583.html',
    keywords: ['sách nói', 'audiobook', 'nghe sách', 'mp3'],
  },
  {
    id: 'radio',
    name: 'Radio & Tâm Hồn',
    icon: '📻',
    dilibUrl: 'https://dilib.vn/radio/',
    keywords: ['radio', 'tâm hồn', 'suy ngẫm', 'truyện ngắn'],
  },
  {
    id: 'sach-bo',
    name: 'Sách Bộ (Trọn Bộ)',
    icon: '📚',
    dilibUrl: 'https://dilib.vn/sach-bo/',
    keywords: ['sách bộ', 'trọn bộ', 'tinh hoa', 'kinh điển'],
  },

  // 3. Kỹ năng & Phát triển bản thân
  {
    id: 'tam-ly-ky-nang',
    name: 'Tâm Lý - Kỹ Năng Sống',
    icon: '🧠',
    dilibUrl: 'https://dilib.vn/thu-vien/tam-ly-ky-nang/',
    dtvUrl: 'https://dtv-ebook.com.vn/tam-ly-ky-nang-song-490.html',
    keywords: ['tâm lý', 'kỹ năng', 'đắc nhân tâm', 'giao tiếp', 'tư duy', 'thuyết phục'],
  },
  {
    id: 'phat-trien-ban-than',
    name: 'Phát Triển Bản Thân - Self Help',
    icon: '🌱',
    dilibUrl: 'https://dilib.vn/thu-vien/phat-trien-ban-than/',
    dtvUrl: 'https://dtv-ebook.com.vn/phat-trien-ban-than-489.html',
    keywords: ['phát triển bản thân', 'thành công', 'thói quen nguyên tử', 'tự lực', 'self help'],
  },
  {
    id: 'nuoi-duong-tam-hon',
    name: 'Nuôi Dưỡng Tâm Hồn',
    icon: '🌸',
    dilibUrl: 'https://dilib.vn/thu-vien/nuoi-duong-tam-hon/',
    keywords: ['tâm hồn', 'nuôi dưỡng', 'bình an', 'hạnh phúc', 'sống đẹp'],
  },
  {
    id: 'khai-tam-mo-tri',
    name: 'Khai Tâm - Mở Trí',
    icon: '💡',
    dilibUrl: 'https://dilib.vn/thu-vien/khai-tam-mo-tri/',
    keywords: ['khai tâm', 'mở trí', 'trí tuệ', 'nhận thức', 'khai sáng'],
  },

  // 4. Kinh doanh & Quản trị
  {
    id: 'quan-tri-kinh-doanh',
    name: 'Kinh Tế - Quản Trị - Kinh Doanh',
    icon: '💼',
    dilibUrl: 'https://dilib.vn/thu-vien/quan-tri-kinh-doanh/',
    dtvUrl: 'https://dtv-ebook.com.vn/kinh-te-quan-ly-488.html',
    keywords: ['kinh doanh', 'quản trị', 'lãnh đạo', 'doanh nghiệp', 'kinh tế'],
  },
  {
    id: 'self-help-khoi-nghiep',
    name: 'Khởi Nghiệp - Làm Giàu',
    icon: '🚀',
    dilibUrl: 'https://dilib.vn/thu-vien/self-help-khoi-nghiep/',
    dtvUrl: 'https://dtv-ebook.com.vn/tai-chinh-tien-te-1447.html',
    keywords: ['khởi nghiệp', 'startup', 'làm giàu', 'tài chính', 'cha giàu'],
  },
  {
    id: 'marketing-ban-hang',
    name: 'Marketing - Bán Hàng',
    icon: '📈',
    dilibUrl: 'https://dilib.vn/thu-vien/marketing-ban-hang/',
    keywords: ['marketing', 'bán hàng', 'quảng cáo', 'truyền thông'],
  },

  // 5. Kiếm hiệp, Tiên hiệp, Ngôn tình
  {
    id: 'kiem-hiep-tien-hiep',
    name: 'Kiếm Hiệp - Tiên Hiệp',
    icon: '🗡️',
    dilibUrl: 'https://dilib.vn/thu-vien/kiem-hiep-tien-hiep/',
    dtvUrl: 'https://dtv-ebook.com.vn/kiem-hiep-486.html',
    keywords: ['kiếm hiệp', 'tiên hiệp', 'tu chân', 'võ hiệp', 'kim dung', 'cổ long'],
  },
  {
    id: 'lang-man-ngon-tinh',
    name: 'Ngôn Tình - Lãng Mạn',
    icon: '💖',
    dilibUrl: 'https://dilib.vn/thu-vien/lang-man-ngon-tinh/',
    dtvUrl: 'https://dtv-ebook.com.vn/ngon-tinh-487.html',
    keywords: ['ngôn tình', 'lãng mạn', 'tình yêu', 'tình cảm', 'cổ đại'],
  },
  {
    id: 'dam-my-bach-hop',
    name: 'Đam Mỹ - Bách Hợp',
    icon: '🌈',
    dilibUrl: 'https://dilib.vn/thu-vien/dam-my-bach-hop/',
    dtvUrl: 'https://dtv-ebook.com.vn/dam-my-494.html',
    keywords: ['đam mỹ', 'bách hợp', 'bl', 'gl'],
  },

  // 6. Tâm linh, Triết học & Y học
  {
    id: 'ton-giao-tam-linh',
    name: 'Tôn Giáo - Tâm Linh',
    icon: '🧘',
    dilibUrl: 'https://dilib.vn/thu-vien/ton-giao-tam-linh/',
    dtvUrl: 'https://dtv-ebook.com.vn/ton-giao-tam-linh-1451.html',
    keywords: ['tâm linh', 'thiền', 'phật giáo', 'thức tỉnh', 'tâm thức', 'linh hồn'],
  },
  {
    id: 'yoga-thien',
    name: 'Yoga - Thiền Định',
    icon: '🧘‍♂️',
    dilibUrl: 'https://dilib.vn/thu-vien/yoga-thien/',
    keywords: ['yoga', 'thiền định', 'chánh niệm', 'năng lượng', 'thở'],
  },
  {
    id: 'triet-hoc-ly-luan',
    name: 'Triết Học - Lý Luận',
    icon: '📜',
    dilibUrl: 'https://dilib.vn/thu-vien/triet-hoc-ly-luan/',
    dtvUrl: 'https://dtv-ebook.com.vn/triet-hoc-1448.html',
    keywords: ['triết học', 'lý luận', 'tư tưởng', 'khắc kỷ', 'đạo đức'],
  },
  {
    id: 'y-hoc-suc-khoe',
    name: 'Y Học - Sức Khỏe',
    icon: '🩺',
    dilibUrl: 'https://dilib.vn/thu-vien/y-hoc-suc-khoe/',
    dtvUrl: 'https://dtv-ebook.com.vn/y-hoc-suc-khoe-1452.html',
    keywords: ['sức khỏe', 'y học', 'dinh dưỡng', 'chữa lành', 'dưỡng sinh'],
  },

  // 7. Lịch sử, Khoa học & Xã hội
  {
    id: 'lich-su-quan-su',
    name: 'Lịch Sử - Quân Sự - Chiến Tranh',
    icon: '⚔️',
    dilibUrl: 'https://dilib.vn/thu-vien/lich-su-quan-su/',
    dtvUrl: 'https://dtv-ebook.com.vn/chien-tranh-1449.html',
    keywords: ['lịch sử', 'quân sự', 'chiến tranh', 'việt nam', 'thế giới'],
  },
  {
    id: 'nhan-vat-lich-su',
    name: 'Nhân Vật Lịch Sử - Danh Nhân',
    icon: '👑',
    dilibUrl: 'https://dilib.vn/thu-vien/nhan-vat-lich-su/',
    keywords: ['nhân vật', 'danh nhân', 'lãnh tụ', 'danh tướng', 'vua chúa'],
  },
  {
    id: 'hoi-ky-tuy-but',
    name: 'Hồi Ký - Tùy Bút',
    icon: '🖋️',
    dilibUrl: 'https://dilib.vn/thu-vien/hoi-ky-tuy-but/',
    keywords: ['hồi ký', 'tự truyện', 'tùy bút', 'nhân vật', 'cuộc đời'],
  },
  {
    id: 'khoa-hoc-cong-nghe',
    name: 'Khoa Học - Viễn Tưởng',
    icon: '🔬',
    dilibUrl: 'https://dilib.vn/thu-vien/khoa-hoc-cong-nghe/',
    dtvUrl: 'https://dtv-ebook.com.vn/khoa-hoc-vien-tuong-497.html',
    keywords: ['khoa học', 'vũ trụ', 'công nghệ', 'ai', 'vật lý', 'thiên văn', 'viễn tưởng'],
  },
  {
    id: 'cong-nghe-thong-tin',
    name: 'Công Nghệ Thông Tin',
    icon: '💻',
    dilibUrl: 'https://dilib.vn/thu-vien/cong-nghe-thong-tin/',
    keywords: ['lập trình', 'tin học', 'it', 'mạng', 'phần mềm', 'python'],
  },
  {
    id: 'van-hoa-xa-hoi',
    name: 'Văn Hóa - Xã Hội',
    icon: '🌐',
    dilibUrl: 'https://dilib.vn/thu-vien/van-hoa-xa-hoi/',
    keywords: ['văn hóa', 'xã hội', 'phong tục', 'con người'],
  },
  {
    id: 'giao-duc-dao-tao',
    name: 'Giáo Dục - Đào Tạo',
    icon: '🎓',
    dilibUrl: 'https://dilib.vn/thu-vien/giao-duc-dao-tao/',
    keywords: ['giáo dục', 'đào tạo', 'học tập', 'phương pháp'],
  },

  // 8. Văn học, Tiểu thuyết & Truyện
  {
    id: 'van-hoc-nghe-thuat',
    name: 'Văn Học - Nghệ Thuật',
    icon: '🎨',
    dilibUrl: 'https://dilib.vn/thu-vien/van-hoc-nghe-thuat/',
    keywords: ['văn học', 'nghệ thuật', 'thơ ca', 'tiểu thuyết'],
  },
  {
    id: 'truyen-ngan-tieu-thuyet',
    name: 'Truyện Ngắn - Tiểu Thuyết',
    icon: '📖',
    dilibUrl: 'https://dilib.vn/thu-vien/truyen-ngan-tieu-thuyet/',
    dtvUrl: 'https://dtv-ebook.com.vn/the-loai-truyen-313.html',
    keywords: ['truyện ngắn', 'tiểu thuyết', 'truyện chữ'],
  },
  {
    id: 'tinh-cam-gia-dinh',
    name: 'Tình Cảm - Gia Đình',
    icon: '🏡',
    dilibUrl: 'https://dilib.vn/thu-vien/tinh-cam-gia-dinh/',
    keywords: ['gia đình', 'cha mẹ', 'con cái', 'hôn nhân'],
  },
  {
    id: 'tre-em-thieu-nhi',
    name: 'Trẻ Em - Thiếu Nhi',
    icon: '🧸',
    dilibUrl: 'https://dilib.vn/thu-vien/tre-em-thieu-nhi/',
    keywords: ['thiếu nhi', 'trẻ em', 'cổ tích', 'đồng dao'],
  },
  {
    id: 'tuoi-hoc-tro',
    name: 'Tuổi Học Trò',
    icon: '🎒',
    dilibUrl: 'https://dilib.vn/thu-vien/tuoi-hoc-tro/',
    keywords: ['học trò', 'áo trắng', 'tuổi thơ', 'nguyễn nhật ánh'],
  },
  {
    id: 'tu-vi-phong-thuy',
    name: 'Tử Vi - Phong Thủy',
    icon: '☯️',
    dilibUrl: 'https://dilib.vn/thu-vien/tu-vi-phong-thuy/',
    keywords: ['tử vi', 'phong thủy', 'kinh dịch', 'tướng số'],
  },
  {
    id: 'kham-pha-bi-an',
    name: 'Khám Phá - Bí Ẩn',
    icon: '🛸',
    dilibUrl: 'https://dilib.vn/thu-vien/kham-pha-bi-an/',
    keywords: ['khám phá', 'bí ẩn', 'tam giác quỷ', 'ufo'],
  },
  {
    id: 'phieu-luu-mao-hiem',
    name: 'Phiêu Lưu - Mạo Hiểm',
    icon: '🧭',
    dilibUrl: 'https://dilib.vn/thu-vien/phieu-luu-mao-hiem/',
    keywords: ['phiêu lưu', 'mạo hiểm', 'thám hiểm', 'rừng rậm'],
  },
]

export const DILIB_CATEGORIES: DilibCategory[] = UNIFIED_CATEGORIES.map((c) => ({
  id: c.id,
  name: c.name,
  icon: c.icon,
  url: c.dilibUrl || c.dtvUrl || 'https://dilib.vn/thu-vien/',
  keywords: c.keywords,
}))

export const DILIB_POPULAR_AUTHORS: string[] = [
  // Trinh thám & Bí ẩn
  'Agatha Christie',
  'Arthur Conan Doyle',
  'Higashino Keigo',
  'Dan Brown',
  'Edogawa Ranpo',
  'Stephen King',
  'Gillian Flynn',
  'Thomas Harris',
  'Jo Nesbo',

  // Phát triển bản thân & Kỹ năng
  'Dale Carnegie',
  'John C. Maxwell',
  'Napoleon Hill',
  'Brian Tracy',
  'Robert Kiyosaki',
  'Robin Sharma',
  'James Clear',
  'Stephen Covey',
  'Malcolm Gladwell',
  'Daniel Kahneman',
  'Mark Manson',
  'Simon Sinek',
  'Jim Rohn',
  'Tony Robbins',

  // Tâm linh, Thiền & Triết học
  'Thích Nhất Hạnh',
  'Osho',
  'Eckhart Tolle',
  'Hòa Thượng Thích Thanh Từ',
  'Thiền Sư Ajahn Chah',
  'Nguyễn Phong',
  'Lão Tử',
  'Khổng Tử',
  'Trang Tử',

  // Văn học Việt Nam
  'Nguyễn Nhật Ánh',
  'Nam Cao',
  'Vũ Trọng Phụng',
  'Ngô Tất Tố',
  'Tô Hoài',
  'Nguyễn Du',
  'Xuân Diệu',
  'Hàn Mặc Tử',
  'Trịnh Công Sơn',
  'Tony Buổi Sáng',
  'Nguyễn Hiến Lê',
  'Nguyễn Mạnh Hùng',
  'Khôi Hoàng',

  // Văn học & Kinh điển Thế giới
  'Haruki Murakami',
  'Paulo Coelho',
  'Victor Hugo',
  'George Orwell',
  'J.K. Rowling',
  'Yuval Noah Harari',
  'Stephen Hawking',
  'Kim Dung',
  'Cổ Long',
  'Lưu Cừu Chu',

  // Kinh doanh & Doanh nhân
  'Warren Buffett',
  'Jack Ma',
  'Steve Jobs',
  'Bill Gates',
  'Lý Gia Thành',
  'Inamori Kazuo',
]

export type CrawlerSource = 'ALL' | 'DILIB' | 'DTV'

export type UnifiedSearchResult = {
  url: string
  title: string
  thumbnail: string
  source: 'Dilib' | 'DTV eBook'
  author?: string
}

export type DilibSearchResult = UnifiedSearchResult

export type UnifiedBookDetail = {
  url: string
  source: 'Dilib' | 'DTV eBook'
  title: string
  author: string
  genre: string
  cover: string
  description: string
  hasAudio: boolean
  hasPdf: boolean
  audioTracks: Array<{ id: string; title: string; url: string; duration?: number }>
  readbookUrl: string | null
  pdfUrl: string | null
  epubUrl?: string | null
  mobiUrl?: string | null
}

export type DilibBookDetail = UnifiedBookDetail

export type CrawlReport = {
  totalScanned: number
  audiobooksAdded: number
  booksPdfAdded: number
  totalAudioFiles: number
  durationSeconds: number
  dilibCount: number
  dtvCount: number
  items: Array<{
    title: string
    author: string
    source: 'Dilib' | 'DTV eBook'
    hasAudio: boolean
    hasPdf: boolean
    audioCount: number
    readbookUrl?: string | null
  }>
}

/** 1. TÌM KIẾM DILIB.VN */
export async function searchDilib(keyword: string): Promise<UnifiedSearchResult[]> {
  const q = keyword.trim()
  if (!q) return []
  try {
    const res = await fetch(`https://dilib.vn/search/ajax-search.php?keyword=${encodeURIComponent(q)}`)
    const html = await res.text()
    const items: UnifiedSearchResult[] = []
    const regex = /<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<\/a>/gi
    let m: RegExpExecArray | null

    while ((m = regex.exec(html)) !== null) {
      let url = m[1]
      const title = m[2].trim()
      let thumbnail = m[3]
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = 'https://dilib.vn' + (thumbnail.startsWith('/') ? '' : '/') + thumbnail
      }
      if (url && !url.startsWith('http')) {
        url = 'https://dilib.vn' + (url.startsWith('/') ? '' : '/') + url
      }
      if (url && title && !items.some((i) => i.url === url)) {
        items.push({ url, title, thumbnail, source: 'Dilib' })
      }
    }
    return items
  } catch (err) {
    console.warn('[dilibCrawler] Lỗi tìm kiếm Dilib:', err)
    return []
  }
}

/** 2. TÌM KIẾM DTV-EBOOK.COM.VN */
export async function searchDtvEbook(keyword: string): Promise<UnifiedSearchResult[]> {
  const q = keyword.trim()
  if (!q) return []
  try {
    const url = `https://dtv-ebook.com.vn/tim-kiem.html?keyword=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await res.text()
    const items: UnifiedSearchResult[] = []
    const linkMatches = [...html.matchAll(/<a[^>]+href="([^"]+_\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi)]
    const seen = new Set<string>()

    for (const m of linkMatches) {
      let rawHref = m[1]
      const inner = m[2]
      const title = inner.replace(/<[^>]+>/g, '').trim()
      const img = inner.match(/src="([^"]+)"/i)?.[1] || ''

      if (!rawHref.startsWith('http')) {
        rawHref = 'https://dtv-ebook.com.vn/' + rawHref.replace(/^\//, '')
      }

      if (
        rawHref.includes('ung-ho') ||
        rawHref.includes('huong-dan') ||
        rawHref.includes('phan-mem') ||
        !title ||
        title.length < 3 ||
        title.toLowerCase().includes('mua máy')
      ) {
        continue
      }

      if (!seen.has(rawHref)) {
        seen.add(rawHref)
        items.push({
          url: rawHref,
          title,
          thumbnail: img,
          source: 'DTV eBook',
        })
      }
    }
    return items
  } catch (err) {
    console.warn('[dilibCrawler] Lỗi tìm kiếm DTV eBook:', err)
    return []
  }
}

/** 3. TÌM KIẾM HỢP NHẤT SONG SONG CẢ 2 NGUỒN */
export async function searchMultiSource(keyword: string, source: CrawlerSource = 'ALL'): Promise<UnifiedSearchResult[]> {
  const q = keyword.trim()
  if (!q) return []

  const promises: Promise<UnifiedSearchResult[]>[] = []
  if (source === 'ALL' || source === 'DILIB') {
    promises.push(searchDilib(q))
  }
  if (source === 'ALL' || source === 'DTV') {
    promises.push(searchDtvEbook(q))
  }

  const results = await Promise.allSettled(promises)
  const combined: UnifiedSearchResult[] = []

  for (const r of results) {
    if (r.status === 'fulfilled') {
      combined.push(...r.value)
    }
  }

  // Loại bỏ các mục trùng URL
  const uniqueMap = new Map<string, UnifiedSearchResult>()
  for (const item of combined) {
    if (!uniqueMap.has(item.url)) {
      uniqueMap.set(item.url, item)
    }
  }
  return Array.from(uniqueMap.values())
}

/** Gợi ý danh sách tác giả phù hợp khi gõ */
export function getSuggestedAuthors(input: string): string[] {
  const q = input.trim().toLowerCase()
  if (!q) return DILIB_POPULAR_AUTHORS.slice(0, 16)
  return DILIB_POPULAR_AUTHORS.filter((a) => a.toLowerCase().includes(q))
}

/** 4. BÓC TÁCH CHI TIẾT SÁCH DILIB.VN */
export async function fetchDilibDetail(url: string): Promise<UnifiedBookDetail | null> {
  try {
    const res = await fetch(url)
    const html = await res.text()

    // Title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Sách chưa có tiêu đề'

    // Author
    const authorMatch = html.match(/Tác giả:\s*<[^>]+>([^<]+)<\/a>/i) || html.match(/Tác giả:\s*([^<\n.]+)/i)
    let author = authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : 'Chưa rõ tác giả'
    if (author.toLowerCase().includes('định dạng') || author.length > 50) {
      author = author.split('.')[0].trim()
    }

    // Genre
    const genreMatches = [...html.matchAll(/Thể loại:\s*<[^>]+>([^<]+)<\/a>/gi)].map((m) => m[1].trim())
    const genre = genreMatches.join(', ') || 'Sách tổng hợp'

    // Cover
    const imgMatch =
      html.match(/<img[^>]+id="img_01"[^>]+src="([^"]+)"/i) ||
      html.match(/<img[^>]+class="attachment-shop_single[^"]*"[^>]+src="([^"]+)"/i) ||
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    let cover = imgMatch ? imgMatch[1] : ''
    if (cover && !cover.startsWith('http')) cover = 'https://dilib.vn' + (cover.startsWith('/') ? '' : '/') + cover

    // Description
    const descMatch =
      html.match(/<div[^>]*id="tab-description"[^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<div[^>]*class="[^"]*(?:description|entry-content|summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const description = descMatch
      ? descMatch[1]
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : ''

    // Audio tracks
    const audioTracks: Array<{ id: string; title: string; url: string; duration?: number }> = []
    const audioRegex = /<audio[^>]*src="([^"]+)"/gi
    let am: RegExpExecArray | null
    while ((am = audioRegex.exec(html)) !== null) {
      let aUrl = am[1]
      if (!aUrl.startsWith('http')) aUrl = 'https://dilib.vn' + (aUrl.startsWith('/') ? '' : '/') + aUrl
      audioTracks.push({
        id: `track-${audioTracks.length + 1}`,
        title: `${title} - Phần ${audioTracks.length + 1}`,
        url: aUrl,
      })
    }
    const playlistMatches = [...html.matchAll(/(?:data-src|data-audio|data-mp3|source\s+src)="([^"]+\.mp3[^"]*)"/gi)]
    for (const pm of playlistMatches) {
      let aUrl = pm[1]
      if (!aUrl.startsWith('http')) aUrl = 'https://dilib.vn' + (aUrl.startsWith('/') ? '' : '/') + aUrl
      if (!audioTracks.some((t) => t.url === aUrl)) {
        audioTracks.push({
          id: `track-${audioTracks.length + 1}`,
          title: `${title} - Phần ${audioTracks.length + 1}`,
          url: aUrl,
        })
      }
    }

    // Readbook / PDF
    const readbookMatches = [...html.matchAll(/href="([^"]*(?:readbook|doc-sach)[^"]*)"/gi)].map((m) => m[1])
    let readbookUrl = readbookMatches[0] || null
    if (readbookUrl && !readbookUrl.startsWith('http')) {
      readbookUrl = 'https://dilib.vn' + (readbookUrl.startsWith('/') ? '' : '/') + readbookUrl
    }

    const pdfMatches = [...html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1])
    let pdfUrl = pdfMatches[0] || null
    if (pdfUrl && !pdfUrl.startsWith('http')) {
      pdfUrl = 'https://dilib.vn' + (pdfUrl.startsWith('/') ? '' : '/') + pdfUrl
    }

    const hasAudio = audioTracks.length > 0
    const hasPdf = Boolean(readbookUrl || pdfUrl)

    return {
      url,
      source: 'Dilib',
      title,
      author,
      genre,
      cover,
      description,
      hasAudio,
      hasPdf,
      audioTracks,
      readbookUrl,
      pdfUrl,
    }
  } catch (err) {
    console.warn('[dilibCrawler] Lỗi fetch detail Dilib:', err)
    return null
  }
}

/** 5. BÓC TÁCH CHI TIẾT SÁCH DTV-EBOOK.COM.VN */
export async function fetchDtvDetail(url: string): Promise<UnifiedBookDetail | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await res.text()

    // Title, Author, Genre from Title Tag
    const rawTitle = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
    let title = rawTitle.replace(/^Tải\s+(?:ebook|sách|truyện|audiobook)\s+/i, '')
    let genre = ''
    const genreMatch = title.match(/\[([^\]]+)\]$/)
    if (genreMatch) {
      genre = genreMatch[1].trim()
      title = title.replace(/\[[^\]]+\]$/, '').trim()
    }
    title = title.replace(/\s+full\s+(?:mobi|pdf|epub|azw3|audio|truyện|mp3|prc).*$/i, '').trim()
    title = title.replace(/\s*-\s*DTV\s*eBook.*$/i, '').trim()

    let author = 'Chưa rõ tác giả'
    if (title.includes(' - ')) {
      const parts = title.split(' - ')
      title = parts[0].trim()
      author = parts.slice(1).join(' - ').trim()
    }

    // Cover image
    const imgMatches = [...html.matchAll(/<img[^>]+(?:src|data-src)="([^"]+)"/gi)].map((m) => m[1])
    let cover =
      imgMatches.find(
        (src) =>
          (src.includes('files_') || src.includes('images/') || src.includes('upload')) &&
          !src.includes('logo') &&
          !src.includes('icon') &&
          !src.includes('top.png') &&
          !src.includes('banner')
      ) || ''
    if (cover && !cover.startsWith('http')) {
      cover = 'https://dtv-ebook.com.vn/' + cover.replace(/^\//, '')
    }

    // Description
    const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || ''

    // Read Online Link (embedded doconline.php reader)
    const readOnlineMatch = html.match(/href="([^"]*doconline\.php\?[^"]*)"/i)?.[1] || null
    const readbookUrl = readOnlineMatch
      ? readOnlineMatch.startsWith('http')
        ? readOnlineMatch
        : 'https://dtv-ebook.com.vn/' + readOnlineMatch.replace(/^\//, '')
      : null

    // Download Links
    const downloadBtns = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
      href: m[1],
      text: m[2].replace(/<[^>]+>/g, '').trim().toUpperCase(),
    }))

    const pdfUrl = downloadBtns.find((b) => b.text.includes('PDF') && b.href.includes('google'))?.href || null
    const epubUrl = downloadBtns.find((b) => b.text.includes('EPUB') && b.href.includes('google'))?.href || null
    const mobiUrl = downloadBtns.find((b) => (b.text.includes('MOBI') || b.text.includes('AZW3')) && b.href.includes('google'))?.href || null

    // Audio tracks
    const audioTracks: Array<{ id: string; title: string; url: string; duration?: number }> = []
    const mp3Matches = [...html.matchAll(/(?:src|data-src|href)="([^"]+\.mp3[^"]*)"/gi)].map((m) => m[1])
    for (const mp3 of mp3Matches) {
      let mp3Url = mp3
      if (!mp3Url.startsWith('http')) mp3Url = 'https://dtv-ebook.com.vn/' + mp3Url.replace(/^\//, '')
      if (!audioTracks.some((t) => t.url === mp3Url)) {
        audioTracks.push({
          id: `track-${audioTracks.length + 1}`,
          title: `${title} - Phần ${audioTracks.length + 1}`,
          url: mp3Url,
        })
      }
    }

    const hasAudio = audioTracks.length > 0
    const hasPdf = Boolean(readbookUrl || pdfUrl || epubUrl)

    return {
      url,
      source: 'DTV eBook',
      title,
      author,
      genre: genre || 'Sách tổng hợp',
      cover,
      description: metaDesc,
      hasAudio,
      hasPdf,
      audioTracks,
      readbookUrl,
      pdfUrl: pdfUrl || readbookUrl,
      epubUrl,
      mobiUrl,
    }
  } catch (err) {
    console.warn('[dilibCrawler] Lỗi fetch detail DTV eBook:', err)
    return null
  }
}

/** 6. BÓC TÁCH CHI TIẾT TỔNG HỢP TỪ BẤT KỲ NGUỒN NÀO */
export async function fetchUnifiedDetail(url: string): Promise<UnifiedBookDetail | null> {
  if (url.includes('dtv-ebook.com.vn')) {
    return fetchDtvDetail(url)
  }
  return fetchDilibDetail(url)
}

export const fetchDilibDetailAuto = fetchUnifiedDetail

/** 7. LƯU SÁCH VÀO SUPABASE & LOCAL STORAGE */
export async function saveDilibBook(detail: UnifiedBookDetail): Promise<{ addedAudio: boolean; addedPdf: boolean }> {
  let addedAudio = false
  let addedPdf = false

  const idSlug = detail.url.split('/').pop()?.replace('.html', '') || `${Date.now()}`

  // 1. Lưu Sách Nói (Audiobook)
  if (detail.hasAudio) {
    const audiobook: Audiobook = {
      id: `ab-${idSlug}`,
      title: detail.title,
      author: detail.author,
      genre: detail.genre,
      cover: detail.cover,
      description: detail.description,
      tracks: detail.audioTracks,
      dilibUrl: detail.url,
      hasPdf: detail.hasPdf,
      readbookUrl: detail.readbookUrl ?? undefined,
      pdfUrl: detail.pdfUrl ?? undefined,
      status: 'PLANNED',
      created_at: new Date().toISOString(),
    }
    await saveAudiobook(audiobook)
    addedAudio = true
  }

  // 2. Lưu Sách Đọc (PDF / EPUB / Reader) vào media_items
  if (detail.hasPdf && supabase) {
    try {
      const pdfRecord = {
        title: detail.title,
        author: detail.author,
        genre: detail.genre,
        type: 'BOOK',
        book_format: 'READ',
        cover_url: detail.cover,
        description: detail.description,
        url: detail.readbookUrl || detail.pdfUrl || detail.url,
        notes: JSON.stringify({
          source: detail.source,
          dilibUrl: detail.url,
          readbookUrl: detail.readbookUrl,
          pdfUrl: detail.pdfUrl,
          epubUrl: detail.epubUrl,
          hasAudio: detail.hasAudio,
        }),
        status: 'PLANNED',
        updated_at: new Date().toISOString(),
      }

      await supabase.from('media_items').insert(pdfRecord)
      addedPdf = true
    } catch (err) {
      console.warn('[dilibCrawler] Lỗi lưu PDF media_items:', err)
    }
  }

  return { addedAudio, addedPdf }
}

/** 8. BỘ ĐIỀU KHIỂN CÀO TỰ ĐỘNG ĐA NGUỒN (HỖ TRỢ HẸN GIỜ) */
export async function crawlUnified({
  category,
  author,
  searchQuery,
  source = 'ALL',
  maxMinutes = 3,
  signal,
  onProgress,
}: {
  category?: UnifiedBookCategory
  author?: string
  searchQuery?: string
  source?: CrawlerSource
  maxMinutes?: number
  signal?: AbortSignal
  onProgress?: (progress: {
    scanned: number
    addedAudio: number
    addedPdf: number
    currentBook?: string
    statusMessage: string
    elapsedSeconds: number
    remainingSeconds: number
  }) => void
}): Promise<CrawlReport> {
  const startTime = Date.now()
  const maxDurationMs = (maxMinutes || 3) * 60 * 1000
  const isUnlimited = maxMinutes <= 0

  let scanned = 0
  let addedAudio = 0
  let addedPdf = 0
  let totalAudioFiles = 0
  let dilibCount = 0
  let dtvCount = 0
  const itemsReport: CrawlReport['items'] = []

  const updateStatus = (currentBook: string, msg: string) => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const remaining = isUnlimited ? 9999 : Math.max(0, Math.floor((maxDurationMs - (Date.now() - startTime)) / 1000))
    onProgress?.({
      scanned,
      addedAudio,
      addedPdf,
      currentBook,
      statusMessage: msg,
      elapsedSeconds: elapsed,
      remainingSeconds: remaining,
    })
  }

  // 1. Thu thập danh sách URLs cần quét
  const urlsToVisit = new Set<string>()

  if (author) {
    updateStatus('', `Đang tìm tất cả sách của tác giả "${author}" từ cả 2 nguồn...`)
    const results = await searchMultiSource(author, source)
    results.forEach((r) => urlsToVisit.add(r.url))
  } else if (searchQuery) {
    updateStatus('', `Đang tìm kiếm sách với từ khóa "${searchQuery}" từ cả 2 nguồn...`)
    const results = await searchMultiSource(searchQuery, source)
    results.forEach((r) => urlsToVisit.add(r.url))
  } else if (category) {
    updateStatus('', `Đang nạp danh mục "${category.name}" từ cả 2 nguồn...`)

    // A. Quét Dilib category
    if ((source === 'ALL' || source === 'DILIB') && category.dilibUrl) {
      try {
        const catRes = await fetch(category.dilibUrl)
        const catHtml = await catRes.text()
        const regex = /<a[^>]+href="([^"]+-\d+\.html)"[^>]*title="([^"]+)"/gi
        let m: RegExpExecArray | null
        while ((m = regex.exec(catHtml)) !== null) {
          let u = m[1]
          if (!u.startsWith('http')) u = 'https://dilib.vn' + (u.startsWith('/') ? '' : '/') + u
          urlsToVisit.add(u)
        }
      } catch (e) {
        console.warn('Lỗi đọc category Dilib:', e)
      }
    }

    // B. Quét DTV eBook category
    if ((source === 'ALL' || source === 'DTV') && category.dtvUrl) {
      try {
        const dtvRes = await fetch(category.dtvUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        })
        const dtvHtml = await dtvRes.text()
        const linkMatches = [...dtvHtml.matchAll(/<a[^>]+href="([^"]+_\d+\.html)"[^>]*>/gi)]
        for (const m of linkMatches) {
          let u = m[1]
          if (!u.startsWith('http')) u = 'https://dtv-ebook.com.vn/' + u.replace(/^\//, '')
          if (!u.includes('ung-ho') && !u.includes('huong-dan')) {
            urlsToVisit.add(u)
          }
        }
      } catch (e) {
        console.warn('Lỗi đọc category DTV:', e)
      }
    }

    // C. Quét thêm theo từ khóa của danh mục
    for (const kw of category.keywords.slice(0, 3)) {
      if (signal?.aborted || (!isUnlimited && Date.now() - startTime >= maxDurationMs)) break
      updateStatus('', `Đang quét từ khóa "${kw}"...`)
      const kwResults = await searchMultiSource(kw, source)
      kwResults.forEach((r) => urlsToVisit.add(r.url))
    }
  }

  updateStatus('', `Đã phát hiện ${urlsToVisit.size} đầu sách từ 2 nguồn. Đang tiến hành bóc tách...`)

  // 2. Duyệt từng sách và kiểm tra Audio / PDF
  for (const bookUrl of Array.from(urlsToVisit)) {
    if (signal?.aborted) break
    if (!isUnlimited && Date.now() - startTime >= maxDurationMs) {
      updateStatus('', `Đã hết thời gian hẹn giờ ${maxMinutes} phút. Hoàn tất cào!`)
      break
    }

    scanned++
    updateStatus(bookUrl, `Đang kiểm tra: ${bookUrl}...`)

    const detail = await fetchUnifiedDetail(bookUrl)
    if (!detail) continue

    if (detail.source === 'Dilib') dilibCount++
    else dtvCount++

    updateStatus(
      detail.title,
      `[${detail.source}] Đang xử lý: ${detail.title} (Audio: ${detail.hasAudio ? 'Có' : 'Không'}, PDF/EPUB: ${detail.hasPdf ? 'Có' : 'Không'})`
    )

    const result = await saveDilibBook(detail)
    if (result.addedAudio) {
      addedAudio++
      totalAudioFiles += detail.audioTracks.length
    }
    if (result.addedPdf) addedPdf++

    itemsReport.push({
      title: detail.title,
      author: detail.author,
      source: detail.source,
      hasAudio: detail.hasAudio,
      hasPdf: detail.hasPdf,
      audioCount: detail.audioTracks.length,
      readbookUrl: detail.readbookUrl,
    })

    await new Promise((r) => setTimeout(r, 70))
  }

  const durationSec = Math.floor((Date.now() - startTime) / 1000)

  return {
    totalScanned: scanned,
    audiobooksAdded: addedAudio,
    booksPdfAdded: addedPdf,
    totalAudioFiles,
    durationSeconds: durationSec,
    dilibCount,
    dtvCount,
    items: itemsReport,
  }
}

export const crawlDilib = crawlUnified
