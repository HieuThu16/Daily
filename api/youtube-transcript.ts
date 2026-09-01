/**
 * GET /api/youtube-transcript?v=VIDEO_ID&tl=vi
 *
 * Lấy phụ đề gốc của video YouTube rồi dịch sang tiếng Việt theo lô.
 * Phải chạy ở server vì YouTube chặn CORS với endpoint timedtext.
 */
import { requireAuth } from './_auth.js'


export const config = { maxDuration: 60 }

export type TranscriptCue = { start: number; end: number; text: string; vi?: string }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

type Track = { baseUrl: string; languageCode: string; kind?: string }

const INNERTUBE_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w'

function pickTrack(tracks: Track[], want: string): Track | null {
  if (!tracks.length) return null
  // Ưu tiên phụ đề người viết đúng ngôn ngữ, rồi mới tới bản máy tự nghe.
  return (
    tracks.find((t) => t.languageCode?.startsWith(want) && t.kind !== 'asr') ||
    tracks.find((t) => t.languageCode?.startsWith(want)) ||
    tracks.find((t) => t.kind !== 'asr') ||
    tracks[0]
  )
}

/**
 * Hỏi InnerTube để lấy danh sách phụ đề.
 *
 * Không dùng link trong trang watch nữa: từ 2024 YouTube bắt link đó phải kèm
 * "PO token" của trình duyệt, gọi từ server chỉ nhận về nội dung rỗng. Client
 * IOS trả link còn tải được, ANDROID là phương án hai (chỉ trả XML srv3).
 */
async function fetchTracks(videoId: string, clientName: 'IOS' | 'ANDROID'): Promise<Track[]> {
  const client =
    clientName === 'IOS'
      ? { clientName: 'IOS', clientVersion: '20.10.4', deviceModel: 'iPhone16,2', hl: 'en' }
      : { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' }
  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ videoId, contentCheckOk: true, racyCheckOk: true, context: { client } }),
  })
  if (!res.ok) return []
  const data: any = await res.json()
  return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
}

/** Gỡ thẻ HTML và đổi ký tự escape trong phụ đề srv3. */
function unescapeXml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function parseJson3(body: string): TranscriptCue[] {
  const data = JSON.parse(body)
  const cues: TranscriptCue[] = []
  for (const ev of data?.events || []) {
    const text = (ev.segs || []).map((sg: any) => sg.utf8 || '').join('').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const start = (ev.tStartMs || 0) / 1000
    cues.push({ start, end: start + (ev.dDurationMs || 3000) / 1000, text })
  }
  return cues
}

function parseSrv3(body: string): TranscriptCue[] {
  const cues: TranscriptCue[] = []
  const re = /<p t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const text = unescapeXml(m[3]).replace(/\s+/g, ' ').trim()
    if (!text) continue
    const start = Number(m[1]) / 1000
    cues.push({ start, end: start + Number(m[2] || 3000) / 1000, text })
  }
  return cues
}

async function fetchCues(baseUrl: string): Promise<TranscriptCue[]> {
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}fmt=json3`
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  if (!res.ok) return []
  const body = await res.text()
  if (!body.trim()) return []
  // Tuỳ client mà YouTube trả json3 hoặc XML srv3, nhận cả hai.
  const cues = body.trimStart().startsWith('<') ? parseSrv3(body) : parseJson3(body)
  return mergeIntoSentences(cues)
}

/**
 * Phụ đề tự sinh bị cắt vụn giữa câu. Gộp lại tới khi gặp dấu kết câu
 * để mỗi dòng hiện ra là một câu đọc được — đây là điểm ăn tiền của
 * Language Reactor so với phụ đề gốc của YouTube.
 */
function mergeIntoSentences(cues: TranscriptCue[]): TranscriptCue[] {
  const out: TranscriptCue[] = []
  for (const cue of cues) {
    const prev = out[out.length - 1]
    const tooLong = prev && (prev.text.length > 180 || cue.end - prev.start > 12)
    if (prev && !/[.!?…]["')\]]?$/.test(prev.text) && !tooLong) {
      prev.text = `${prev.text} ${cue.text}`.replace(/\s+/g, ' ')
      prev.end = cue.end
    } else {
      out.push({ ...cue })
    }
  }
  return out
}

const norm = (t: string) => t.replace(/\s+/g, ' ').trim()

/** Gọi Google Translate không cần key. gtx hay bị chặn tốc độ nên có bản dự phòng. */
async function translateChunk(lines: string[], tl: string): Promise<string[]> {
  const q = encodeURIComponent(lines.join('\n'))
  for (const client of ['gtx', 'dict-chrome-ex']) {
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=${client}&sl=en&tl=${tl}&dt=t&q=${q}`,
        { headers: { 'user-agent': UA } },
      )
      if (!res.ok) continue
      const data: any = await res.json()
      const segs: any[] = data?.[0] || []
      if (!segs.length) continue

      /*
       * Google cắt theo câu chứ không theo dòng, nên một dòng có thể ra nhiều
       * đoạn. Mỗi đoạn kèm cả bản gốc, dựa vào đó ghép ngược lại cho khớp dòng
       * — lệch một nhịp là phụ đề sai hết phần còn lại.
       */
      const out: string[] = []
      let i = 0
      for (const line of lines) {
        let vi = ''
        let src = ''
        while (i < segs.length && norm(src).length < norm(line).length) {
          vi += segs[i][0] || ''
          src += segs[i][1] || ''
          i++
        }
        out.push(norm(vi))
      }
      return out
    } catch {
      /* thử client kế tiếp */
    }
  }
  return lines.map(() => '')
}

/** Dịch cả phụ đề: chia lô ~1500 ký tự, chạy 3 lô một lượt cho nhanh. */
async function translate(texts: string[], tl: string): Promise<string[]> {
  const chunks: number[][] = []
  let cur: number[] = []
  let size = 0
  for (let i = 0; i < texts.length; i++) {
    if (cur.length && (size + texts[i].length > 1500 || cur.length >= 25)) {
      chunks.push(cur)
      cur = []
      size = 0
    }
    cur.push(i)
    size += texts[i].length
  }
  if (cur.length) chunks.push(cur)

  const out: string[] = new Array(texts.length).fill('')
  for (let c = 0; c < chunks.length; c += 3) {
    await Promise.all(
      chunks.slice(c, c + 3).map(async (idxs) => {
        const vi = await translateChunk(idxs.map((i) => texts[i]), tl)
        idxs.forEach((i, k) => {
          out[i] = vi[k] || ''
        })
      }),
    )
  }
  return out
}

export default async function handler(req: any, res: any) {
  if (await requireAuth(req, res)) return

  const videoId = String(req.query?.v || req.body?.v || '').trim()
  const tl = String(req.query?.tl || 'vi').trim()
  const sl = String(req.query?.sl || req.body?.sl || 'en').trim().toLowerCase()
  if (!/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Thiếu hoặc sai video id (v)' })
  }

  try {
    let cues: TranscriptCue[] = []
    let sourceLang = sl
    let isOfficial = true
    for (const client of ['IOS', 'ANDROID'] as const) {
      const tracks = await fetchTracks(videoId, client)
      const track = pickTrack(tracks, sl)
      if (!track?.baseUrl) continue
      cues = await fetchCues(track.baseUrl)
      if (cues.length) {
        sourceLang = track.languageCode || sl
        isOfficial = track.kind !== 'asr'
        break
      }
    }
    if (!cues.length) return res.status(404).json({ error: 'Video này không có phụ đề' })
    if (!sourceLang.startsWith(tl)) {
      const vi = await translate(cues.map((c) => c.text), tl)
      cues.forEach((c, i) => {
        c.vi = vi[i] || ''
      })
    }

    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).json({ videoId, sourceLang, isOfficial, cues })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Lỗi lấy phụ đề' })
  }
}
