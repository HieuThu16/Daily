/** Proxy phát video TikTok: CDN đòi Referer tiktok.com và chặn CORS, nên stream qua server mình. */
export const config = { maxDuration: 60 }

const ALLOWED = /(^|\.)(tiktokcdn|tiktokcdn-us|tiktokv|tiktokvcdn|byteoversea)\.com$/

export default async function handler(req: any, res: any) {
  const raw = String(req.query?.url || '')
  if (!raw) return res.status(400).json({ error: 'Thiếu url' })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return res.status(400).json({ error: 'URL không hợp lệ' })
  }
  if (target.protocol !== 'https:' || !ALLOWED.test(target.hostname)) {
    return res.status(403).json({ error: 'Chỉ proxy video từ CDN TikTok' })
  }

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Referer: 'https://www.tiktok.com/',
  }
  if (req.headers?.range) headers.Range = String(req.headers.range)

  const upstream = await fetch(target.toString(), { headers })
  res.status(upstream.status)
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h)
    if (v) res.setHeader(h, v)
  }
  res.setHeader('Cache-Control', 'public, max-age=3600')

  if (!upstream.body) return res.end()
  const reader = upstream.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(Buffer.from(value))
  }
  res.end()
}
