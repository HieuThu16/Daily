export const config = {
  maxDuration: 60,
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.privacydev.net',
  'https://vid.puffyan.us',
  'https://invidious.nerdvpn.de',
  'https://inv.riverside.rocks',
  'https://invidious.flokinet.to',
  'https://invidious.projectsegfau.lt',
]

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.leptons.xyz',
]

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const videoId = (req.query?.videoId as string) || req.body?.videoId
  const streamMode = req.query?.stream === 'true' || req.body?.stream === true

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ success: false, error: 'Thiếu videoId' })
  }

  const cleanVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!cleanVideoId) {
    return res.status(400).json({ success: false, error: 'videoId không hợp lệ' })
  }

  try {
    // 1. Thử Piped API trước (Rất nhanh và trả về stream audio chất lượng cao m4a/opus)
    for (const piped of PIPED_INSTANCES) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const response = await fetch(`${piped}/streams/${cleanVideoId}`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })
        clearTimeout(timeout)

        if (response.ok) {
          const data: any = await response.json()
          const audioStreams = (data.audioStreams || []).sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
          const bestAudio = audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4') || s.format === 'M4A') || audioStreams[0]

          if (bestAudio?.url) {
            if (streamMode) {
              return proxyStream(bestAudio.url, res, bestAudio.mimeType || 'audio/mp4')
            }

            return res.status(200).json({
              success: true,
              audioUrl: bestAudio.url,
              proxyUrl: `/api/youtube-audio?videoId=${cleanVideoId}&stream=true`,
              mimeType: bestAudio.mimeType || 'audio/mp4',
              bitrate: bestAudio.bitrate,
              title: data.title,
              uploader: data.uploader,
              duration: data.duration,
              source: 'piped',
            })
          }
        }
      } catch {}
    }

    // 2. Thử Invidious API
    for (const invidious of INVIDIOUS_INSTANCES) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const response = await fetch(`${invidious}/api/v1/videos/${cleanVideoId}`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })
        clearTimeout(timeout)

        if (response.ok) {
          const data: any = await response.json()
          const adaptiveFormats = data.adaptiveFormats || []
          const audioFormats = adaptiveFormats.filter((f: any) => f.type?.startsWith('audio/'))
          audioFormats.sort((a: any, b: any) => (parseInt(b.bitrate, 10) || 0) - (parseInt(a.bitrate, 10) || 0))
          const best = audioFormats.find((f: any) => f.type?.includes('audio/mp4') || f.container === 'm4a') || audioFormats[0]

          if (best?.url) {
            if (streamMode) {
              return proxyStream(best.url, res, best.type || 'audio/mp4')
            }

            return res.status(200).json({
              success: true,
              audioUrl: best.url,
              proxyUrl: `/api/youtube-audio?videoId=${cleanVideoId}&stream=true`,
              mimeType: best.type || 'audio/mp4',
              title: data.title,
              uploader: data.author,
              duration: data.lengthSeconds,
              source: 'invidious',
            })
          }
        }
      } catch {}
    }

    // 3. Fallback Cobalt API
    try {
      const cobaltRes = await fetch('https://co.wuk.sh/api/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${cleanVideoId}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
        }),
      })

      if (cobaltRes.ok) {
        const cData: any = await cobaltRes.json()
        if (cData?.url) {
          if (streamMode) {
            return proxyStream(cData.url, res, 'audio/mpeg')
          }
          return res.status(200).json({
            success: true,
            audioUrl: cData.url,
            proxyUrl: `/api/youtube-audio?videoId=${cleanVideoId}&stream=true`,
            mimeType: 'audio/mpeg',
            source: 'cobalt',
          })
        }
      }
    } catch {}

    return res.status(404).json({
      success: false,
      error: 'Không tìm thấy stream audio cho video này',
    })
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi server khi lấy audio YouTube',
    })
  }
}

async function proxyStream(url: string, res: any, contentType: string) {
  try {
    const audioRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!audioRes.ok) {
      return res.status(audioRes.status).send('Không thể truyền stream audio')
    }

    res.setHeader('Content-Type', contentType || 'audio/mp4')
    res.setHeader('Accept-Ranges', 'bytes')

    const length = audioRes.headers.get('content-length')
    if (length) res.setHeader('Content-Length', length)

    if (audioRes.body) {
      const reader = audioRes.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
      res.end()
    } else {
      const buffer = await audioRes.arrayBuffer()
      res.send(Buffer.from(buffer))
    }
  } catch (e: any) {
    res.status(500).send('Proxy audio stream error: ' + e?.message)
  }
}
