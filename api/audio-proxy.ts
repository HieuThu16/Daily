import { requireAuth } from './_auth.js'

export const config = { maxDuration: 30 }

/**
 * Chặn SSRF: Chỉ cho phép URL công khai
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
  if (!raw) return res.status(400).json({ error: 'Thiếu link audio (url)' })

  const check = isPublicHttpUrl(raw)
  if (!check.ok) return res.status(400).json({ error: check.reason })

  const targetUrl = check.url!.toString()

  // Xác định Referer thích hợp để vượt qua tường lửa chặn hotlinking
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
    Accept: 'audio/*,*/*;q=0.9',
    'Accept-Encoding': 'identity',
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
      res.end()
    } else {
      const buffer = await upstream.arrayBuffer()
      res.send(Buffer.from(buffer))
    }
  } catch (err: any) {
    console.warn('[audio-proxy] Lỗi stream audio:', err)
    if (!res.headersSent) {
      res.status(500).send('Proxy audio error: ' + (err?.message || 'Không kết nối được nguồn audio'))
    }
  }
}
