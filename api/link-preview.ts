/**
 * GET /api/link-preview?url=...
 *
 * 1. Đọc thẻ Open Graph của một trang để tự điền tên phim, ảnh bìa và mô tả.
 * 2. Tải HTML thô khi có param `raw=1` (dùng cho crawler).
 * 3. Proxy stream audio khi có param `audio=1` hoặc `stream=1` (dùng phát sách nói và media chặn CORS/hotlink).
 */
import { requireAuth } from './_auth.js'
import { parseLinkPreview } from '../src/lib/linkPreviewParse.js'

export const config = { maxDuration: 30 }

/** Chỉ đọc phần đầu trang nếu là preview metadata: thẻ meta nằm trong <head>. */
const MAX_BYTES = 512 * 1024

/**
 * Chặn SSRF: đây là endpoint fetch URL do NGƯỜI DÙNG nhập.
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
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host) ||
    host === '::1' ||
    host.startsWith('[::1') ||
    host.startsWith('[fc') ||
    host.startsWith('[fd')
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

  const targetUrl = check.url!.toString()
  const isAudio =
    req.query?.audio === '1' ||
    req.query?.stream === '1' ||
    req.body?.audio === true ||
    req.body?.stream === true ||
    /\.(mp3|m4a|aac|wav|ogg)(?:\?.*)?$/i.test(targetUrl)

  const isRaw = req.query?.raw === '1' || req.query?.format === 'html' || req.body?.format === 'html'

  // Xác định Referer thích hợp nếu là stream audio để vượt qua tường lửa chống hotlinking
  let referer = 'https://dtv-ebook.com.vn/'
  if (targetUrl.includes('dilib.vn')) {
    referer = 'https://dilib.vn/'
  } else if (targetUrl.includes('dtv-ebook')) {
    referer = 'https://dtv-ebook.com.vn/'
  } else {
    try {
      referer = `${check.url!.protocol}//${check.url!.host}/`
    } catch {}
  }

  const forwardHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Referer: referer,
    'Accept-Language': 'vi,en;q=0.8',
    Accept: isAudio ? 'audio/*,*/*;q=0.9' : 'text/html,application/xhtml+xml,application/json,*/*',
  }

  // Chuyển tiếp Range header nếu có (cho phép tua / seek audio mượt mà)
  if (req.headers?.range) {
    forwardHeaders.Range = req.headers.range
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: forwardHeaders,
      redirect: 'follow',
    })

    // XỬ LÝ AUDIO STREAMING / PROXY
    if (isAudio) {
      if (!upstream.ok && upstream.status !== 206) {
        return res.status(upstream.status).send(`Upstream audio error: HTTP ${upstream.status}`)
      }

      const contentType = upstream.headers.get('content-type') || 'audio/mpeg'
      const contentLength = upstream.headers.get('content-length')
      const contentRange = upstream.headers.get('content-range')
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes'

      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
      res.setHeader('Content-Type', contentType.includes('html') ? 'audio/mpeg' : contentType)
      res.setHeader('Accept-Ranges', acceptRanges)

      if (contentLength) res.setHeader('Content-Length', contentLength)
      if (contentRange) res.setHeader('Content-Range', contentRange)

      res.status(upstream.status)

      if (upstream.body) {
        const reader = upstream.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
        return res.end()
      } else {
        const buffer = await upstream.arrayBuffer()
        return res.send(Buffer.from(buffer))
      }
    }

    // XỬ LÝ RAW HTML
    if (isRaw) {
      const fullText = await upstream.text()
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(upstream.status).send(fullText)
    }

    if (!upstream.ok) {
      return res.status(200).json({ title: '', image: '', description: '', siteName: '', error: `HTTP ${upstream.status}` })
    }

    const type = upstream.headers.get('content-type') ?? ''
    if (!type.includes('html')) {
      return res.status(200).json({ title: '', image: '', description: '', siteName: '', error: 'Không phải trang web' })
    }

    // Đọc từng mẩu và dừng sớm: preview chỉ cần phần <head>
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

    // Ảnh bìa đổi về tuyệt đối cho <img> dùng được
    if (preview.image && !/^https?:\/\//i.test(preview.image)) {
      try {
        preview.image = new URL(preview.image, check.url).toString()
      } catch {
        preview.image = ''
      }
    }

    return res.status(200).json(preview)
  } catch (err: any) {
    if (isAudio && !res.headersSent) {
      return res.status(500).send('Proxy audio error: ' + (err?.message || 'Không kết nối được nguồn audio'))
    }
    return res.status(200).json({
      title: '',
      image: '',
      description: '',
      siteName: '',
      error: err?.message || 'Không đọc được link',
    })
  }
}
