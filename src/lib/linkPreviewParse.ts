/**
 * Bóc thông tin Open Graph từ HTML — hàm THUẦN, không import gì.
 *
 * Tách riêng khỏi linkPreview.ts vì file này còn chạy trong hàm serverless ở
 * api/. Nếu để chung, import sẽ kéo theo apiFetch -> supabase -> cả phần client
 * vào gói serverless, vừa nặng vừa vô nghĩa.
 */

/**
 * Đọc thông tin phim từ link của các trang đánh giá (IMDb, TMDB, Letterboxd,
 * Wikipedia, các trang review tiếng Việt…).
 *
 * Dùng thẻ Open Graph — thứ mọi trang tử tế đều có sẵn để Facebook/Zalo hiện
 * preview. Nhờ vậy không cần khoá API của riêng trang nào, dán link ở đâu cũng
 * chạy. Đổi lại chỉ lấy được tiêu đề / ảnh / mô tả, không có dàn diễn viên hay
 * điểm số — muốn mấy thứ đó phải ký hợp đồng API riêng.
 */

export type LinkPreview = {
  title: string
  image: string
  description: string
  siteName: string
}

const EMPTY: LinkPreview = { title: '', image: '', description: '', siteName: '' }

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

/** Đổi &amp; &#39; … về ký tự thật; tiêu đề phim rất hay có dấu nháy. */
function decodeEntities(text: string): string {
  return text
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const hex = code[1] === 'x' || code[1] === 'X'
        const num = hex ? parseInt(code.slice(2), 16) : Number(code.slice(1))
        return Number.isFinite(num) && num > 0 ? String.fromCodePoint(num) : whole
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? whole
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nội dung của một thẻ meta theo property/name, bất kể thứ tự thuộc tính. */
function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Thẻ meta viết kiểu nào cũng gặp: content trước property, hoặc ngược lại.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    if (m?.[1]) return decodeEntities(m[1])
  }
  return ''
}

/**
 * Bóc thông tin từ HTML một trang.
 * Hàm thuần, không gọi mạng — test được mà không cần internet.
 */
export function parseLinkPreview(html: string): LinkPreview {
  if (!html) return EMPTY

  // og:* là chuẩn phổ biến nhất; twitter:* và thẻ thường làm phương án dự phòng.
  const title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')

  return {
    title,
    image: metaContent(html, 'og:image') || metaContent(html, 'twitter:image'),
    description:
      metaContent(html, 'og:description') ||
      metaContent(html, 'twitter:description') ||
      metaContent(html, 'description'),
    siteName: metaContent(html, 'og:site_name'),
  }
}

/** Bỏ đuôi trang tự thêm: "Inception (2010) - IMDb" -> "Inception (2010)". */
export function cleanMovieTitle(title: string, siteName = ''): string {
  let out = title.trim()
  const tails = [siteName, 'IMDb', 'TMDB', 'The Movie Database', 'Letterboxd', 'Rotten Tomatoes', 'Wikipedia']
  for (const tail of tails) {
    if (!tail) continue
    // Chỉ cắt khi nằm SAU dấu gạch ở cuối chuỗi, tránh cắt nhầm vào tên phim.
    const escaped = tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`\\s*[-–—|·]\\s*${escaped}\\s*$`, 'i'), '').trim()
  }
  return out
}

