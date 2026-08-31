import { saveAudiobook } from './audiobookRepository'
import { supabase } from './supabase'
import type { Audiobook, DilibCategory } from '../types/audiobook'

export const DILIB_CATEGORIES: DilibCategory[] = [
  // 1. Tủ sách & Kinh điển
  {
    id: 'tac-pham-kinh-dien',
    name: 'Tác Phẩm Kinh Điển',
    icon: '🏛️',
    url: 'https://dilib.vn/thu-vien/tac-pham-kinh-dien/',
    keywords: ['kinh điển', 'tác phẩm kinh điển', 'văn học kinh điển', 'danh tác'],
  },
  {
    id: 'tu-sach-tinh-hoa',
    name: 'Tủ Sách Tinh Hoa',
    icon: '💎',
    url: 'https://dilib.vn/tu-sach-tinh-hoa/',
    keywords: ['tinh hoa', 'tủ sách tinh hoa', 'kiến thức tinh hoa'],
  },
  {
    id: 'gioi-thieu-sach-moi',
    name: 'Giới Thiệu Sách Mới',
    icon: '✨',
    url: 'https://dilib.vn/gioi-thieu-sach-moi/',
    keywords: ['sách mới', 'mới nhất', 'phát hành'],
  },
  {
    id: 'sach-bo',
    name: 'Sách Bộ (Trọn Bộ)',
    icon: '📚',
    url: 'https://dilib.vn/sach-bo/',
    keywords: ['sách bộ', 'trọn bộ', 'tinh hoa', 'kinh điển'],
  },
  {
    id: 'sach-noi',
    name: 'Sách Nói (Audiobooks)',
    icon: '🎧',
    url: 'https://dilib.vn/sach-noi/',
    keywords: ['sách nói', 'audiobook', 'nghe sách', 'mp3'],
  },
  {
    id: 'radio',
    name: 'Radio & Tâm Hồn',
    icon: '📻',
    url: 'https://dilib.vn/radio/',
    keywords: ['radio', 'tâm hồn', 'suy ngẫm', 'truyện ngắn'],
  },

  // 2. Kỹ năng & Phát triển bản thân
  {
    id: 'tam-ly-ky-nang',
    name: 'Tâm Lý - Kỹ Năng',
    icon: '🧠',
    url: 'https://dilib.vn/thu-vien/tam-ly-ky-nang/',
    keywords: ['tâm lý', 'kỹ năng', 'đắc nhân tâm', 'giao tiếp', 'tư duy', 'thuyết phục'],
  },
  {
    id: 'phat-trien-ban-than',
    name: 'Phát Triển Bản Thân',
    icon: '🌱',
    url: 'https://dilib.vn/thu-vien/phat-trien-ban-than/',
    keywords: ['phát triển bản thân', 'thành công', 'thói quen nguyên tử', 'tự lực'],
  },
  {
    id: 'nuoi-duong-tam-hon',
    name: 'Nuôi Dưỡng Tâm Hồn',
    icon: '🌸',
    url: 'https://dilib.vn/thu-vien/nuoi-duong-tam-hon/',
    keywords: ['tâm hồn', 'nuôi dưỡng', 'bình an', 'hạnh phúc', 'sống đẹp'],
  },
  {
    id: 'khai-tam-mo-tri',
    name: 'Khai Tâm - Mở Trí',
    icon: '💡',
    url: 'https://dilib.vn/thu-vien/khai-tam-mo-tri/',
    keywords: ['khai tâm', 'mở trí', 'trí tuệ', 'nhận thức', 'khai sáng'],
  },

  // 3. Kinh doanh & Quản trị
  {
    id: 'quan-tri-kinh-doanh',
    name: 'Quản Trị - Kinh Doanh',
    icon: '💼',
    url: 'https://dilib.vn/thu-vien/quan-tri-kinh-doanh/',
    keywords: ['kinh doanh', 'quản trị', 'lãnh đạo', 'doanh nghiệp'],
  },
  {
    id: 'self-help-khoi-nghiep',
    name: 'Self Help - Khởi Nghiệp',
    icon: '🚀',
    url: 'https://dilib.vn/thu-vien/self-help-khoi-nghiep/',
    keywords: ['khởi nghiệp', 'startup', 'làm giàu', 'tài chính', 'cha giàu'],
  },
  {
    id: 'marketing-ban-hang',
    name: 'Marketing - Bán Hàng',
    icon: '📈',
    url: 'https://dilib.vn/thu-vien/marketing-ban-hang/',
    keywords: ['marketing', 'bán hàng', 'quảng cáo', 'truyền thông'],
  },

  // 4. Tâm linh, Triết học & Y học
  {
    id: 'ton-giao-tam-linh',
    name: 'Tôn Giáo - Tâm Linh',
    icon: '🧘',
    url: 'https://dilib.vn/thu-vien/ton-giao-tam-linh/',
    keywords: ['tâm linh', 'thiền', 'phật giáo', 'thức tỉnh', 'tâm thức', 'linh hồn'],
  },
  {
    id: 'yoga-thien',
    name: 'Yoga - Thiền',
    icon: '🧘‍♂️',
    url: 'https://dilib.vn/thu-vien/yoga-thien/',
    keywords: ['yoga', 'thiền định', 'chánh niệm', 'năng lượng', 'thở'],
  },
  {
    id: 'triet-hoc-ly-luan',
    name: 'Triết Học - Lý Luận',
    icon: '📜',
    url: 'https://dilib.vn/thu-vien/triet-hoc-ly-luan/',
    keywords: ['triết học', 'lý luận', 'tư tưởng', 'khắc kỷ', 'đạo đức'],
  },
  {
    id: 'y-hoc-suc-khoe',
    name: 'Y Học - Sức Khỏe',
    icon: '🩺',
    url: 'https://dilib.vn/thu-vien/y-hoc-suc-khoe/',
    keywords: ['sức khỏe', 'y học', 'dinh dưỡng', 'chữa lành', 'dưỡng sinh'],
  },

  // 5. Lịch sử, Khoa học & Xã hội
  {
    id: 'lich-su-quan-su',
    name: 'Lịch Sử - Quân Sự',
    icon: '⚔️',
    url: 'https://dilib.vn/thu-vien/lich-su-quan-su/',
    keywords: ['lịch sử', 'quân sự', 'chiến tranh', 'việt nam', 'thế giới'],
  },
  {
    id: 'nhan-vat-lich-su',
    name: 'Nhân Vật Lịch Sử',
    icon: '👑',
    url: 'https://dilib.vn/thu-vien/nhan-vat-lich-su/',
    keywords: ['nhân vật', 'danh nhân', 'lãnh tụ', 'danh tướng', 'vua chúa'],
  },
  {
    id: 'hoi-ky-tuy-but',
    name: 'Hồi Ký - Tùy Bút',
    icon: '🖋️',
    url: 'https://dilib.vn/thu-vien/hoi-ky-tuy-but/',
    keywords: ['hồi ký', 'tự truyện', 'tùy bút', 'nhân vật', 'cuộc đời'],
  },
  {
    id: 'khoa-hoc-cong-nghe',
    name: 'Khoa Học - Công Nghệ',
    icon: '🔬',
    url: 'https://dilib.vn/thu-vien/khoa-hoc-cong-nghe/',
    keywords: ['khoa học', 'vũ trụ', 'công nghệ', 'ai', 'vật lý', 'thiên văn'],
  },
  {
    id: 'cong-nghe-thong-tin',
    name: 'Công Nghệ Thông Tin',
    icon: '💻',
    url: 'https://dilib.vn/thu-vien/cong-nghe-thong-tin/',
    keywords: ['lập trình', 'tin học', 'it', 'mạng', 'phần mềm', 'python'],
  },
  {
    id: 'van-hoa-xa-hoi',
    name: 'Văn Hóa - Xã Hội',
    icon: '🌐',
    url: 'https://dilib.vn/thu-vien/van-hoa-xa-hoi/',
    keywords: ['văn hóa', 'xã hội', 'phong tục', 'con người'],
  },
  {
    id: 'giao-duc-dao-tao',
    name: 'Giáo Dục - Đào Tạo',
    icon: '🎓',
    url: 'https://dilib.vn/thu-vien/giao-duc-dao-tao/',
    keywords: ['giáo dục', 'đào tạo', 'học tập', 'phương pháp'],
  },
  {
    id: 'tai-lieu-tham-khao',
    name: 'Tài Liệu - Tham Khảo',
    icon: '📑',
    url: 'https://dilib.vn/thu-vien/tai-lieu-tham-khao/',
    keywords: ['tài liệu', 'tham khảo', 'giáo trình', 'nghiên cứu'],
  },

  // 6. Văn học, Tiểu thuyết & Truyện
  {
    id: 'van-hoc-nghe-thuat',
    name: 'Văn Học - Nghệ Thuật',
    icon: '🎨',
    url: 'https://dilib.vn/thu-vien/van-hoc-nghe-thuat/',
    keywords: ['văn học', 'nghệ thuật', 'thơ ca', 'tiểu thuyết'],
  },
  {
    id: 'truyen-ngan-tieu-thuyet',
    name: 'Truyện Ngắn - Tiểu Thuyết',
    icon: '📖',
    url: 'https://dilib.vn/thu-vien/truyen-ngan-tieu-thuyet/',
    keywords: ['truyện ngắn', 'tiểu thuyết', 'truyện chữ'],
  },
  {
    id: 'trinh-tham-hinh-su-kinh-di',
    name: 'Trinh Thám - Kinh Dị',
    icon: '🔍',
    url: 'https://dilib.vn/thu-vien/trinh-tham-hinh-su-kinh-di/',
    keywords: ['trinh thám', 'hình sự', 'kinh dị', 'vụ án', 'bí ẩn'],
  },
  {
    id: 'kiem-hiep-tien-hiep',
    name: 'Kiếm Hiệp - Tiên Hiệp',
    icon: '🗡️',
    url: 'https://dilib.vn/thu-vien/kiem-hiep-tien-hiep/',
    keywords: ['kiếm hiệp', 'tiên hiệp', 'tu chân', 'võ hiệp', 'kim dung'],
  },
  {
    id: 'lang-man-ngon-tinh',
    name: 'Lãng Mạn - Ngôn Tình',
    icon: '💖',
    url: 'https://dilib.vn/thu-vien/lang-man-ngon-tinh/',
    keywords: ['ngôn tình', 'lãng mạn', 'tình yêu', 'tình cảm'],
  },
  {
    id: 'dam-my-bach-hop',
    name: 'Đam Mỹ - Bách Hợp',
    icon: '🌈',
    url: 'https://dilib.vn/thu-vien/dam-my-bach-hop/',
    keywords: ['đam mỹ', 'bách hợp', 'bl', 'gl'],
  },
  {
    id: 'tinh-cam-gia-dinh',
    name: 'Tình Cảm - Gia Đình',
    icon: '🏡',
    url: 'https://dilib.vn/thu-vien/tinh-cam-gia-dinh/',
    keywords: ['gia đình', 'cha mẹ', 'con cái', 'hôn nhân'],
  },
  {
    id: 'tre-em-thieu-nhi',
    name: 'Trẻ Em - Thiếu Nhi',
    icon: '🧸',
    url: 'https://dilib.vn/thu-vien/tre-em-thieu-nhi/',
    keywords: ['thiếu nhi', 'trẻ em', 'cổ tích', 'đồng dao'],
  },
  {
    id: 'tuoi-hoc-tro',
    name: 'Tuổi Học Trò',
    icon: '🎒',
    url: 'https://dilib.vn/thu-vien/tuoi-hoc-tro/',
    keywords: ['học trò', 'áo trắng', 'tuổi thơ', 'nguyễn nhật ánh'],
  },
  {
    id: 'tu-vi-phong-thuy',
    name: 'Tử Vi - Phong Thủy',
    icon: '☯️',
    url: 'https://dilib.vn/thu-vien/tu-vi-phong-thuy/',
    keywords: ['tử vi', 'phong thủy', 'kinh dịch', 'tướng số'],
  },
  {
    id: 'bien-khao-dia-ly',
    name: 'Biên Khảo - Địa Lý',
    icon: '🗺️',
    url: 'https://dilib.vn/thu-vien/bien-khao-dia-ly/',
    keywords: ['biên khảo', 'địa lý', 'danh lam', 'thắng cảnh'],
  },
  {
    id: 'kham-pha-bi-an',
    name: 'Khám Phá - Bí Ẩn',
    icon: '🛸',
    url: 'https://dilib.vn/thu-vien/kham-pha-bi-an/',
    keywords: ['khám phá', 'bí ẩn', 'tam giác quỷ', 'ufo'],
  },
  {
    id: 'phieu-luu-mao-hiem',
    name: 'Phiêu Lưu - Mạo Hiểm',
    icon: '🧭',
    url: 'https://dilib.vn/thu-vien/phieu-luu-mao-hiem/',
    keywords: ['phiêu lưu', 'mạo hiểm', 'thám hiểm', 'rừng rậm'],
  },
]

export const DILIB_POPULAR_AUTHORS: string[] = [
  'Dale Carnegie',
  'Nguyễn Nhật Ánh',
  'Thích Nhất Hạnh',
  'Osho',
  'John C. Maxwell',
  'Napoleon Hill',
  'Brian Tracy',
  'Robert Kiyosaki',
  'Yuval Noah Harari',
  'Robin Sharma',
  'Eckhart Tolle',
  'Paulo Coelho',
  'Tony Buổi Sáng',
  'Haruki Murakami',
  'Dan Brown',
  'Malcolm Gladwell',
  'James Clear',
  'Daniel Kahneman',
  'Warren Buffett',
  'Stephen Covey',
  'Jim Rohn',
  'Victor Hugo',
  'Arthur Conan Doyle',
  'Nam Cao',
  'Vũ Trọng Phụng',
  'Nguyễn Du',
  'Stephen Hawking',
  'J.K. Rowling',
  'Agatha Christie',
  'George Orwell',
  'Mark Manson',
  'Simon Sinek',
  'Jack Ma',
  'Steve Jobs',
  'Bill Gates',
  'Hòa Thượng Thích Thanh Từ',
  'Nguyễn Hiến Lê',
  'Nguyễn Phong',
  'Nguyễn Mạnh Hùng',
  'Thiền Sư Ajahn Chah',
  'Lão Tử',
  'Khổng Tử',
  'Trang Tử',
  'Tô Hoài',
  'Ngô Tất Tố',
  'Xuân Diệu',
  'Hàn Mặc Tử',
  'Trịnh Công Sơn',
  'Khôi Hoàng',
  'Phạm Thành Long',
  'Nguyễn Anh Dũng',
  'Lý Gia Thành',
  'Inamori Kazuo',
  'Morihei Ueshiba',
  'Sun Tzu (Tôn Tử)',
]

export type DilibSearchResult = {
  url: string
  title: string
  thumbnail: string
}

export type DilibBookDetail = {
  url: string
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
}

export type CrawlReport = {
  totalScanned: number
  audiobooksAdded: number
  booksPdfAdded: number
  totalAudioFiles: number
  durationSeconds: number
  items: Array<{
    title: string
    author: string
    hasAudio: boolean
    hasPdf: boolean
    audioCount: number
    readbookUrl?: string | null
  }>
}

/** Tìm kiếm sách trực tuyến trên Dilib.vn */
export async function searchDilib(keyword: string): Promise<DilibSearchResult[]> {
  const q = keyword.trim()
  if (!q) return []
  try {
    const res = await fetch(`https://dilib.vn/search/ajax-search.php?keyword=${encodeURIComponent(q)}`)
    const html = await res.text()
    const items: DilibSearchResult[] = []
    const regex = /<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<\/a>/gi
    let m: RegExpExecArray | null

    while ((m = regex.exec(html)) !== null) {
      const rawHref = m[1]
      const title = m[2].trim()
      let thumbnail = m[3]
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = 'https://dilib.vn' + (thumbnail.startsWith('/') ? '' : '/') + thumbnail
      }
      let url = rawHref
      if (url && !url.startsWith('http')) {
        url = 'https://dilib.vn' + (url.startsWith('/') ? '' : '/') + url
      }
      if (url && title && !items.some((i) => i.url === url)) {
        items.push({ url, title, thumbnail })
      }
    }
    return items
  } catch (err) {
    console.warn('[dilibCrawler] Lỗi tìm kiếm Dilib:', err)
    return []
  }
}

/** Tìm kiếm tác giả và gợi ý danh sách tác giả */
export function getSuggestedAuthors(input: string): string[] {
  const q = input.trim().toLowerCase()
  if (!q) return DILIB_POPULAR_AUTHORS.slice(0, 15)
  return DILIB_POPULAR_AUTHORS.filter((a) => a.toLowerCase().includes(q))
}

/** Lấy chi tiết sách từ Dilib.vn (bao gồm kiểm tra Audio & PDF) */
export async function fetchDilibDetail(url: string): Promise<DilibBookDetail | null> {
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

    // Genre / Categories
    const genreMatches = [...html.matchAll(/Thể loại:\s*<[^>]+>([^<]+)<\/a>/gi)].map((m) => m[1].trim())
    const genre = genreMatches.join(', ') || 'Sách tổng hợp'

    // Cover image
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

    // Audio tracks (Sách nói)
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

    // Readbook URL / PDF embed
    const readbookMatches = [...html.matchAll(/href="([^"]*(?:readbook|doc-sach)[^"]*)"/gi)].map((m) => m[1])
    let readbookUrl = readbookMatches[0] || null
    if (readbookUrl && !readbookUrl.startsWith('http')) {
      readbookUrl = 'https://dilib.vn' + (readbookUrl.startsWith('/') ? '' : '/') + readbookUrl
    }

    // Direct PDF download
    const pdfMatches = [...html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1])
    let pdfUrl = pdfMatches[0] || null
    if (pdfUrl && !pdfUrl.startsWith('http')) {
      pdfUrl = 'https://dilib.vn' + (pdfUrl.startsWith('/') ? '' : '/') + pdfUrl
    }

    const hasAudio = audioTracks.length > 0
    const hasPdf = Boolean(readbookUrl || pdfUrl)

    return {
      url,
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

/** Lưu một cuốn sách Dilib vào cơ sở dữ liệu (tự động phân loại Sách PDF & Sách Nói) */
export async function saveDilibBook(detail: DilibBookDetail): Promise<{ addedAudio: boolean; addedPdf: boolean }> {
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

  // 2. Lưu Sách Đọc (PDF / Ebook) vào media_items
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
          dilibUrl: detail.url,
          readbookUrl: detail.readbookUrl,
          pdfUrl: detail.pdfUrl,
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

/** Bộ điều khiển cào tự động (hỗ trợ hẹn giờ trong bao nhiêu phút) */
export async function crawlDilib({
  category,
  searchQuery,
  maxMinutes = 3,
  signal,
  onProgress,
}: {
  category?: DilibCategory
  searchQuery?: string
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

  if (searchQuery) {
    updateStatus('', `Đang tìm kiếm sách với từ khóa "${searchQuery}"...`)
    const searchRes = await searchDilib(searchQuery)
    searchRes.forEach((r) => urlsToVisit.add(r.url))
  } else if (category) {
    updateStatus('', `Đang nạp danh mục "${category.name}"...`)
    // Quét trang category gốc
    try {
      const catRes = await fetch(category.url)
      const catHtml = await catRes.text()
      const regex = /<a[^>]+href="([^"]+-\d+\.html)"[^>]*title="([^"]+)"/gi
      let m: RegExpExecArray | null
      while ((m = regex.exec(catHtml)) !== null) {
        let u = m[1]
        if (!u.startsWith('http')) u = 'https://dilib.vn' + (u.startsWith('/') ? '' : '/') + u
        urlsToVisit.add(u)
      }
    } catch (e) {
      console.warn('Lỗi đọc category:', e)
    }

    // Quét thêm theo các từ khóa của category để khai thác tối đa
    for (const kw of category.keywords) {
      if (signal?.aborted || (!isUnlimited && Date.now() - startTime >= maxDurationMs)) break
      updateStatus('', `Đang quét từ khóa "${kw}"...`)
      const kwRes = await searchDilib(kw)
      kwRes.forEach((r) => urlsToVisit.add(r.url))
    }
  }

  updateStatus('', `Đã phát hiện ${urlsToVisit.size} đầu sách. Đang tiến hành bóc tách...`)

  // 2. Duyệt từng sách và kiểm tra Audio / PDF
  for (const bookUrl of Array.from(urlsToVisit)) {
    if (signal?.aborted) break
    if (!isUnlimited && Date.now() - startTime >= maxDurationMs) {
      updateStatus('', `Đã hết thời gian hẹn giờ ${maxMinutes} phút. Hoàn tất cào!`)
      break
    }

    scanned++
    updateStatus(bookUrl, `Đang kiểm tra: ${bookUrl}...`)

    const detail = await fetchDilibDetail(bookUrl)
    if (!detail) continue

    updateStatus(detail.title, `Đang xử lý: ${detail.title} (Audio: ${detail.hasAudio ? 'Có' : 'Không'}, PDF: ${detail.hasPdf ? 'Có' : 'Không'})`)

    const result = await saveDilibBook(detail)
    if (result.addedAudio) {
      addedAudio++
      totalAudioFiles += detail.audioTracks.length
    }
    if (result.addedPdf) addedPdf++

    itemsReport.push({
      title: detail.title,
      author: detail.author,
      hasAudio: detail.hasAudio,
      hasPdf: detail.hasPdf,
      audioCount: detail.audioTracks.length,
      readbookUrl: detail.readbookUrl,
    })

    // Nghỉ nhẹ 80ms giữa các request để giữ kết nối mượt mà
    await new Promise((r) => setTimeout(r, 80))
  }

  const durationSec = Math.floor((Date.now() - startTime) / 1000)

  return {
    totalScanned: scanned,
    audiobooksAdded: addedAudio,
    booksPdfAdded: addedPdf,
    totalAudioFiles,
    durationSeconds: durationSec,
    items: itemsReport,
  }
}
