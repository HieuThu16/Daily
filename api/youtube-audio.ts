export const config = {
  maxDuration: 60,
}

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacydev.net',
  'https://invidious.flokinet.to',
  'https://vid.puffyan.us',
  'https://inv.riverside.rocks',
  'https://invidious.projectsegfau.lt',
  'https://invidious.asir.dev',
]

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.leptons.xyz',
  'https://api.piped.private.coffee',
  'https://piped-api.lunar.icu',
]

const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.api.kwiatekm.me',
  'https://co.wuk.sh',
  'https://cobalt-backend.canine.tools',
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
    // 1. THỬ YOUTUBE INNERTUBE API (Nhanh nhất, trực tiếp từ máy chủ YouTube với Android/iOS/TV context)
    const clients = [
      {
        clientName: 'ANDROID',
        clientVersion: '19.09.37',
        androidSdkVersion: 30,
        hl: 'vi',
        gl: 'VN',
      },
      {
        clientName: 'IOS',
        clientVersion: '19.29.1',
        deviceModel: 'iPhone16,2',
        hl: 'vi',
        gl: 'VN',
      },
      {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'vi',
        gl: 'VN',
      },
    ]

    for (const client of clients) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const ytRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              client.clientName === 'ANDROID'
                ? 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
                : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
          },
          body: JSON.stringify({
            videoId: cleanVideoId,
            context: {
              client,
              thirdParty: { embedUrl: 'https://www.youtube.com' },
            },
          }),
        })
        clearTimeout(timeout)

        if (ytRes.ok) {
          const ytData: any = await ytRes.json()
          const streamingData = ytData.streamingData
          const formats = [
            ...(streamingData?.adaptiveFormats || []),
            ...(streamingData?.formats || []),
          ]

          // Lọc audio stream có sẵn url (không cần giải mã cipher)
          const audioFormats = formats.filter(
            (f: any) =>
              (f.mimeType?.startsWith('audio/') || f.itag === 140 || f.itag === 251 || f.itag === 249 || f.itag === 250) &&
              Boolean(f.url)
          )

          if (audioFormats.length > 0) {
            audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
            const best = audioFormats.find((f: any) => f.mimeType?.includes('audio/mp4') || f.itag === 140) || audioFormats[0]

            if (best?.url) {
              if (streamMode) {
                return proxyStream(best.url, res, best.mimeType || 'audio/mp4')
              }
              return res.status(200).json({
                success: true,
                audioUrl: best.url,
                proxyUrl: `/api/youtube-audio?videoId=${cleanVideoId}&stream=true`,
                mimeType: best.mimeType || 'audio/mp4',
                bitrate: best.bitrate,
                title: ytData.videoDetails?.title,
                uploader: ytData.videoDetails?.author,
                duration: Number(ytData.videoDetails?.lengthSeconds) || undefined,
                source: 'innertube',
              })
            }
          }
        }
      } catch {}
    }

    // 2. THỬ PIPED INSTANCES
    for (const piped of PIPED_INSTANCES) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
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

    // 3. THỬ INVIDIOUS INSTANCES
    for (const invidious of INVIDIOUS_INSTANCES) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
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
          const audioFormats = adaptiveFormats.filter((f: any) => f.type?.startsWith('audio/') && Boolean(f.url))
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

    // 4. THỬ COBALT INSTANCES
    for (const cobalt of COBALT_INSTANCES) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const cobaltRes = await fetch(`${cobalt}/api/json`, {
          method: 'POST',
          signal: controller.signal,
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
        clearTimeout(timeout)

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
    }

    // 5. FALLBACK SAVETUBE / Y2MATE PUBLIC CONVERTER STREAM
    try {
      const saveRes = await fetch(`https://api.vevioz.com/api/button/mp3/${cleanVideoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (saveRes.ok) {
        const html = await saveRes.text()
        const match = html.match(/href="([^"]+download[^"]+)"/) || html.match(/href="([^"]+\.mp3[^"]*)"/)
        if (match && match[1]) {
          return res.status(200).json({
            success: true,
            audioUrl: match[1],
            proxyUrl: match[1],
            mimeType: 'audio/mpeg',
            source: 'vevioz',
          })
        }
      }
    } catch {}

    return res.status(404).json({
      success: false,
      error: 'Không tìm thấy stream audio cho video này (YouTube đang chặn IP hoặc video giới hạn)',
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
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Range: 'bytes=0-',
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
