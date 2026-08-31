/**
 * GET /api/link-preview?url=...
 *
 * Đọc thẻ Open Graph của một trang để tự điền tên phim, ảnh bìa và mô tả khi
 * dán link từ IMDb / TMDB / Letterboxd / Wikipedia / trang review tiếng Việt.
 *
 * Chạy ở server vì trình duyệt không fetch chéo miền được (CORS).
 */
import { requireAuth } from './_auth.js'
import { parseLinkPreview } from '../src/lib/linkPreviewParse.js'

export const config = { maxDuration: 15 }

/** Chỉ đọc phần đầu trang: thẻ meta nằm trong <head>, tải cả trang là phí. */
const MAX_BYTES = 512 * 1024

/**
 * Chặn SSRF: đây là endpoint fetch URL do NGƯỜI DÙNG nhập, nên nếu không chặn
 * thì có thể bị lợi dụng để dò mạng nội bộ hoặc endpoint metadata của nhà cung
 * cấp đám mây (169.254.169.254).
 */
function isPublicHttpUrl(raw: string): { ok: boolean; url?: URL; reason?: string } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Link không hợp lệ' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Chỉ nhận link http/https' }
  }

  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    // IPv4 riêng tư và loopback
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host) ||
    // IPv6 loopback và địa chỉ nội bộ
    host === '::1' || host.startsWith('[::1') || host.startsWith('[fc') || host.startsWith('[fd')
  ) {
    return { ok: false, reason: 'Không đọc được link nội bộ' }
  }
  return { ok: true, url }
}

export default async function handler(req: any, res: any) {
  if (await requireAuth(req, res)) return

  const raw = String(req.query?.url || req.body?.url || '').trim()
  if (!raw) return res.status(400).json({ error: 'Thiếu link (url)' })

  const check = isPublicHttpUrl(raw)
  if (!check.ok) return res.status(400).json({ error: check.reason })

  try {
    const upstream = await fetch(check.url!.toString(), {
      headers: {
        // Không có User-Agent thì nhiều trang trả 403.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'vi,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!upstream.ok) {
      return res.status(200).json({ title: '', image: '', description: '', siteName: '', error: `HTTP ${upstream.status}` })
    }

    const type = upstream.headers.get('content-type') ?? ''
    if (!type.includes('html')) {
      return res.status(200).json({ title: '', image: '', description: '', siteName: '', error: 'Không phải trang web' })
    }

    const isRaw = req.query?.raw === '1' || req.query?.format === 'html' || req.body?.format === 'html'

    if (isRaw) {
      const fullText = await upstream.text()
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(upstream.status).send(fullText)
    }

    // Đọc từng mẩu và dừng sớm: trang phim hay nặng vài MB, mình chỉ cần <head>.
    let html = ''
    const reader = upstream.body?.getReader()
    if (reader) {
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        if (html.length >= MAX_BYTES || html.includes('</head>')) {
          void reader.cancel()
          break
        }
      }
    } else {
      html = (await upstream.text()).slice(0, MAX_BYTES)
    }

    const preview = parseLinkPreview(html)

    // Ảnh bìa có thể là đường dẫn tương đối — đổi về tuyệt đối cho <img> dùng được.
    if (preview.image && !/^https?:\/\//i.test(preview.image)) {
      try {
        preview.image = new URL(preview.image, check.url).toString()
      } catch {
        preview.image = ''
      }
    }

    return res.status(200).json(preview)
  } catch (err: any) {
    return res.status(200).json({
      title: '', image: '', description: '', siteName: '',
      error: err?.message || 'Không đọc được link',
    })
  }
}
