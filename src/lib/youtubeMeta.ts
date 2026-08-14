/**
 * Đọc tiêu đề và kênh của một video YouTube rồi đoán ra tên bài / ca sĩ.
 *
 * Dùng oEmbed công khai của YouTube (`/oembed`), không cần API key và có sẵn
 * CORS nên gọi thẳng từ trình duyệt được — khỏi dựng thêm edge function.
 */

export type YouTubeMeta = { title: string; author: string }

/** Lấy id video từ mọi dạng link hay gặp; không phải link video thì null. */
export function youtubeVideoId(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  const host = parsed.hostname.replace(/^www\./, '')
  const isYouTube = host === 'youtube.com' || host === 'music.youtube.com' || host === 'm.youtube.com'

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    return isVideoId(id) ? id : null
  }

  if (!isYouTube) return null

  const fromQuery = parsed.searchParams.get('v')
  if (fromQuery && isVideoId(fromQuery)) return fromQuery

  // /shorts/<id>, /embed/<id>, /live/<id>
  const match = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)
  if (match && isVideoId(match[1])) return match[1]

  return null
}

const isVideoId = (value: string) => /^[\w-]{11}$/.test(value)

/** Gọi oEmbed. Link hỏng, video riêng tư, mất mạng — đều trả null, không ném. */
export async function fetchYouTubeMeta(url: string, fetchImpl: typeof fetch = fetch): Promise<YouTubeMeta | null> {
  const id = youtubeVideoId(url)
  if (!id) return null

  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`

  try {
    const response = await fetchImpl(endpoint)
    if (!response.ok) return null
    const data = (await response.json()) as { title?: string; author_name?: string }
    if (!data.title) return null
    return { title: data.title, author: data.author_name ?? '' }
  } catch {
    return null
  }
}

/* ---------------------------------------------------------------------------
   Dọn tiêu đề
   ------------------------------------------------------------------------- */

/** Những từ chỉ có tác dụng quảng cáo, không thuộc tên bài. */
const NOISE = /\b(?:official|officiel|mv|m\/v|music\s*video|lyrics?|lyric\s*video|audio|visuali[sz]er|teaser|trailer|full|hd|full\s*hd|4k|8k|remaster(?:ed)?|video)\b/i

/**
 * Đuôi kênh không phải tên nghệ sĩ.
 * `vevo` để riêng không có \b đầu vì kênh VEVO hay viết dính: "SonTungMTPVEVO".
 */
const CHANNEL_SUFFIX = /(?:\s*-\s*topic|\s*\bofficial\b|\s*vevo\b|\s*\bmusic\b|\s*\brecords?\b|\s*\bentertainment\b|\s*\bmedia\b|\s*\bchannel\b)+\s*$/i

/**
 * Bỏ các cụm quảng cáo. Chỉ bỏ ngoặc nào TOÀN là từ quảng cáo — "(Remix)" hay
 * "(feat. Đen)" là một phần tên bài nên phải giữ, bỏ đi là sai tên.
 */
export function stripTitleNoise(raw: string): string {
  let out = raw

  out = out.replace(/[([{]([^)\]}]*)[)\]}]/g, (whole, inner: string) => {
    const words = inner.split(/[\s|/,-]+/).filter(Boolean)
    if (words.length === 0) return ''
    const allNoise = words.every((w) => NOISE.test(w) || /^\d+$/.test(w))
    return allNoise ? '' : whole
  })

  // Vế cuối sau dấu | mà toàn từ quảng cáo thì cắt bỏ.
  const parts = out.split('|').map((p) => p.trim())
  while (parts.length > 1 && isAllNoise(parts[parts.length - 1])) parts.pop()
  out = parts.join(' | ')

  return tidy(out)
}

const isAllNoise = (value: string) => {
  const words = value.split(/[\s/,-]+/).filter(Boolean)
  return words.length > 0 && words.every((w) => NOISE.test(w))
}

const tidy = (value: string) => value.replace(/\s{2,}/g, ' ').replace(/^[\s|\-–—:]+|[\s|\-–—:]+$/g, '').trim()

/** Bỏ "Official", "VEVO", "- Topic"… khỏi tên kênh. */
export function parseChannelName(author: string): string {
  let out = author.trim()
  let previous = ''
  while (out !== previous) {
    previous = out
    out = out.replace(CHANNEL_SUFFIX, '').trim()
  }
  return out || author.trim()
}

/** So khớp tên bỏ qua dấu tiếng Việt, hoa thường và khoảng trắng. */
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const looksLikeChannel = (candidate: string, channel: string) => {
  const a = normalize(candidate)
  const b = normalize(channel)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/**
 * Đoán tên bài và ca sĩ từ tiêu đề video.
 *
 * Không có quy ước chung nào cho thứ tự: phương Tây hay dùng "Ca sĩ - Tên bài",
 * MV Việt lại hay "TÊN BÀI | CA SĨ". Nên thay vì đoán theo vị trí, ta so từng
 * vế với tên kênh — vế nào giống tên kênh thì đó là ca sĩ. Chỉ khi không vế
 * nào khớp mới lùi về quy ước "vế đầu là ca sĩ".
 */
export function parseMusicTitle(rawTitle: string, author: string): { name: string; artist: string } {
  const channel = parseChannelName(author)
  const cleaned = stripTitleNoise(rawTitle)

  if (!cleaned) return { name: '', artist: channel }

  const parts = cleaned
    .split(/\s*[|]\s*|\s+[-–—]\s+/)
    .map((p) => tidy(p))
    .filter(Boolean)

  if (parts.length < 2) return { name: cleaned, artist: channel || cleaned }

  const channelIndex = channel ? parts.findIndex((p) => looksLikeChannel(p, channel)) : -1

  if (channelIndex >= 0) {
    const rest = parts.filter((_, i) => i !== channelIndex)
    return { name: rest[0] ?? parts[channelIndex], artist: parts[channelIndex] }
  }

  // Không vế nào khớp kênh: theo quy ước phổ biến nhất, vế đầu là ca sĩ.
  return { name: parts.slice(1).join(' - '), artist: parts[0] }
}
