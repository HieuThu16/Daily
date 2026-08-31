/**
 * GET /api/proxy-html?url=...
 *
 * Proxy tải HTML từ các nguồn sách (Dilib, DTV eBook) để vượt qua giới hạn CORS của trình duyệt.
 */

export const config = { maxDuration: 30 }

function isAllowedUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
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
    host === '::1'
  ) {
    return { ok: false, reason: 'Không truy cập link nội bộ' }
  }
  return { ok: true, url }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const rawUrl = String(req.query?.url || req.body?.url || '').trim()
  if (!rawUrl) {
    return res.status(400).json({ error: 'Thiếu tham số url' })
  }

  const check = isAllowedUrl(rawUrl)
  if (!check.ok) {
    return res.status(400).json({ error: check.reason })
  }

  try {
    const upstream = await fetch(check.url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'vi,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    const text = await upstream.text()
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(upstream.status).send(text)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Lỗi proxy HTML' })
  }
}
