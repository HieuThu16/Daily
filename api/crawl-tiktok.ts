import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { groupVideosIntoSeries } from '../src/lib/tiktokSeries.js'

const execFileAsync = promisify(execFile)

export const config = { maxDuration: 60 }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const BASE_HEADERS = {
  'User-Agent': UA,
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  Referer: 'https://www.tiktok.com/',
}

type RawEntry = {
  id: string
  title: string
  url: string
  thumbnail: string | null
  duration: number | null
  timestamp: number | null
}

type CreatorProfile = {
  creator_id: string
  creator_name: string
  creator_url: string
  sec_uid: string | null
  avatar: string | null
  follower_count: number | null
  video_count: number | null
  signature: string | null
}

function extractUsername(input: string): string {
  const m = input.match(/@([\w.\-]+)/)
  if (m) return m[1]
  return input.replace(/^https?:\/\/[^/]+\//, '').split(/[/?#]/)[0].trim()
}

function extractJsonScript(html: string, id: string): any | null {
  const marker = `<script id="${id}"`
  const start = html.indexOf(marker)
  if (start === -1) return null
  const open = html.indexOf('>', start)
  const close = html.indexOf('</script>', open)
  if (open === -1 || close === -1) return null
  try {
    return JSON.parse(html.slice(open + 1, close))
  } catch {
    return null
  }
}

function mapTikTokItem(item: any, username: string): RawEntry | null {
  const id = String(item?.id || '')
  if (!id) return null
  const author = item?.author?.uniqueId || username
  return {
    id,
    title: item?.desc || '',
    url: `https://www.tiktok.com/@${author}/video/${id}`,
    thumbnail: item?.video?.cover || item?.video?.dynamicCover || item?.video?.originCover || null,
    duration: item?.video?.duration || null,
    timestamp: item?.createTime ? Number(item.createTime) : null,
  }
}

/** Map item TikTok sang video cho feed, giữ đủ stats/nhạc để hiển thị y như app thật. */
function mapFeedItem(item: any) {
  const id = String(item?.id || '')
  if (!id) return null
  const author = item?.author?.uniqueId || 'tiktok'
  return {
    video_id: id,
    title: item?.desc || '',
    canonical_url: `https://www.tiktok.com/@${author}/video/${id}`,
    embed_url: `https://www.tiktok.com/embed/v2/${id}`,
    thumbnail: item?.video?.cover || item?.video?.dynamicCover || item?.video?.originCover || null,
    duration: item?.video?.duration || null,
    creator_id: author,
    creator_name: item?.author?.nickname || author,
    avatar: item?.author?.avatarThumb || item?.author?.avatarMedium || null,
    like_count: item?.stats?.diggCount ?? null,
    comment_count: item?.stats?.commentCount ?? null,
    share_count: item?.stats?.shareCount ?? null,
    play_count: item?.stats?.playCount ?? null,
    music: item?.music?.title ? `${item.music.title} - ${item.music.authorName || author}` : null,
    published_at: item?.createTime ? new Date(Number(item.createTime) * 1000).toISOString() : null,
  }
}


/**
 * Lấy toàn bộ video ID cũ của kênh từ kho lưu trữ Wayback Machine.
 * TikTok chỉ để lộ 10 video mới nhất, nhưng archive.org đã lưu link video từ nhiều năm trước.
 */
async function fetchArchivedIds(username: string): Promise<string[]> {
  const url =
    `http://web.archive.org/cdx/search/cdx?url=tiktok.com/@${encodeURIComponent(username)}/video/*` +
    '&output=json&fl=original&collapse=urlkey&limit=3000'
  const res = await fetch(url)
  if (!res.ok) return []
  let rows: any[]
  try {
    rows = JSON.parse(await res.text())
  } catch {
    return []
  }
  const ids = new Set<string>()
  for (const row of rows.slice(1)) {
    const m = String(row[0] || '').match(/video\/(\d{15,25})/)
    if (m) ids.add(m[1])
  }
  return [...ids]
}

/** Bổ sung tiêu đề + ảnh bìa cho từng ID qua oEmbed (TikTok chặn tốc độ nên phải giãn nhịp). */
async function resolveIds(username: string, ids: string[]): Promise<RawEntry[]> {
  const out: RawEntry[] = []
  for (const id of ids) {
    const url = `https://www.tiktok.com/@${username}/video/${id}`
    const meta = await fetchOembed(url)
    out.push({
      id,
      title: meta?.title || '',
      url,
      thumbnail: meta?.thumbnail || null,
      duration: null,
      timestamp: (() => {
        const d = idToDate(id)
        return d ? Math.floor(new Date(d).getTime() / 1000) : null
      })(),
    })
    await new Promise((r) => setTimeout(r, 250))
  }
  return out
}

/** ID video TikTok mã hoá sẵn thời điểm đăng ở 32 bit cao. */
function idToDate(id: string): string | null {
  try {
    const sec = Number(BigInt(id) >> 32n)
    return sec > 1_000_000_000 ? new Date(sec * 1000).toISOString() : null
  } catch {
    return null
  }
}

/** Trang /embed/... của TikTok vẫn nhúng sẵn dữ liệu video (không cần chữ ký msToken/X-Bogus). */
async function fetchFeedFromEmbed(path: string): Promise<any[]> {
  const res = await fetch(`https://www.tiktok.com/embed/${path}`, { headers: BASE_HEADERS })
  if (!res.ok) return []
  const state = extractJsonScript(await res.text(), '__FRONTITY_CONNECT_STATE__')
  const data = state?.source?.data || {}
  const list = Object.values<any>(data).map((d) => d?.videoList).find(Array.isArray) || []
  return list
    .filter((v: any) => v?.id && !v.privateItem)
    .map((v: any) => {
      const author = v.authorUniqueId || 'tiktok'
      return {
        video_id: String(v.id),
        title: v.desc || '',
        canonical_url: `https://www.tiktok.com/@${author}/video/${v.id}`,
        embed_url: `https://www.tiktok.com/embed/v2/${v.id}`,
        play_url: v.playAddr || null,
        thumbnail: v.coverUrl || v.dynamicCoverUrl || v.originCoverUrl || null,
        duration: null,
        creator_id: author,
        creator_name: author,
        avatar: null,
        like_count: null,
        comment_count: null,
        share_count: null,
        play_count: v.playCount ?? null,
        music: null,
        published_at: idToDate(String(v.id)),
      }
    })
}

/**
 * Cào sâu một kênh: trang /embed chỉ trả 10 video mới nhất, nên lần theo hashtag
 * trong mô tả để tìm tiếp video cũ hơn của cùng kênh, lặp cho tới khi hết hoặc hết giờ.
 * ponytail: BFS theo hashtag, đổi sang API ký msToken nếu cần lấy đủ 100%.
 */
async function crawlChannelDeep(username: string, budgetMs = 45_000) {
  const deadline = Date.now() + budgetMs
  const found = new Map<string, any>()
  const doneTags = new Set<string>()
  const queue: string[] = []

  const absorb = (list: any[]) => {
    for (const v of list) {
      if (v.creator_id !== username || found.has(v.video_id)) continue
      found.set(v.video_id, { ...v, published_at: v.published_at || idToDate(v.video_id) })
      for (const m of String(v.title || '').matchAll(/#([\p{L}\p{N}_]+)/gu)) {
        const tag = m[1]
        if (!doneTags.has(tag) && !queue.includes(tag)) queue.push(tag)
      }
    }
  }

  absorb(await fetchFeedFromEmbed(`@${username}`))

  while (queue.length > 0 && Date.now() < deadline && found.size < 600) {
    const tag = queue.shift() as string
    doneTags.add(tag)
    try {
      absorb(await fetchFeedFromEmbed(`tag/${encodeURIComponent(tag)}`))
    } catch {
      // hashtag lỗi thì bỏ qua, đi tiếp
    }
  }

  return { videos: [...found.values()], scannedTags: doneTags.size, pendingTags: queue.length }
}

/** ponytail: seed hashtag cứng, chuyển sang bảng cấu hình nếu cần đổi mà không deploy. */
const FEED_SEEDS = ['tag/xuhuong', 'tag/reviewphim', 'tag/phimhay', 'tag/giaitri', 'tag/anvat']

/** Bước 1: tải HTML profile → lấy hồ sơ creator (secUid, avatar, stats) + video nhúng sẵn trong trang. */
async function fetchProfile(username: string): Promise<{ profile: CreatorProfile; entries: RawEntry[] }> {
  const url = `https://www.tiktok.com/@${username}`
  const res = await fetch(url, { headers: BASE_HEADERS })
  if (!res.ok) throw new Error(`TikTok trả về HTTP ${res.status} khi mở trang kênh`)
  const html = await res.text()

  const profile: CreatorProfile = {
    creator_id: username,
    creator_name: username,
    creator_url: url,
    sec_uid: null,
    avatar: null,
    follower_count: null,
    video_count: null,
    signature: null,
  }
  const entries: RawEntry[] = []
  const seen = new Set<string>()
  const push = (e: RawEntry | null) => {
    if (e && !seen.has(e.id)) {
      seen.add(e.id)
      entries.push(e)
    }
  }

  const universal = extractJsonScript(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__')
  const scope = universal?.__DEFAULT_SCOPE__
  const userInfo = scope?.['webapp.user-detail']?.userInfo
  if (userInfo?.user) {
    profile.creator_id = userInfo.user.uniqueId || username
    profile.creator_name = userInfo.user.nickname || userInfo.user.uniqueId || username
    profile.sec_uid = userInfo.user.secUid || null
    profile.avatar = userInfo.user.avatarLarger || userInfo.user.avatarMedium || null
    profile.signature = userInfo.user.signature || null
    profile.follower_count = userInfo.stats?.followerCount ?? null
    profile.video_count = userInfo.stats?.videoCount ?? null
  }
  for (const item of scope?.['webapp.user-post']?.itemList || []) push(mapTikTokItem(item, username))

  const sigi = extractJsonScript(html, 'SIGI_STATE')
  if (sigi?.ItemModule) {
    for (const item of Object.values<any>(sigi.ItemModule)) push(mapTikTokItem(item, username))
    const users = sigi.UserModule?.users || {}
    const sigiUser = users[username] || users[username.toLowerCase()] || Object.values<any>(users)[0]
    if (sigiUser) {
      profile.sec_uid = profile.sec_uid || sigiUser.secUid || null
      profile.avatar = profile.avatar || sigiUser.avatarLarger || null
      if (profile.creator_name === username && sigiUser.nickname) profile.creator_name = sigiUser.nickname
    }
  }

  return { profile, entries }
}

/** Bước 2: gọi API item_list nội bộ của TikTok theo secUid, phân trang bằng cursor. */
async function fetchItemList(secUid: string, username: string): Promise<RawEntry[]> {
  const entries: RawEntry[] = []
  const seen = new Set<string>()
  let cursor = '0'
  for (let page = 0; page < 12; page++) {
    const params = new URLSearchParams({
      aid: '1988',
      app_language: 'en',
      count: '35',
      cursor,
      secUid,
      device_platform: 'web_pc',
    })
    const res = await fetch(`https://www.tiktok.com/api/post/item_list/?${params}`, { headers: BASE_HEADERS })
    if (!res.ok) break
    const text = await res.text()
    if (!text) break
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      break
    }
    for (const item of data.itemList || []) {
      const e = mapTikTokItem(item, username)
      if (e && !seen.has(e.id)) {
        seen.add(e.id)
        entries.push(e)
      }
    }
    if (!data.hasMore || !data.cursor) break
    cursor = String(data.cursor)
  }
  return entries
}

/** Fallback cuối: yt-dlp nếu có cài trên máy (chỉ chạy được ở local dev). */
async function fetchViaYtDlp(channelUrl: string): Promise<RawEntry[]> {
  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['--flat-playlist', '-J', channelUrl],
    { maxBuffer: 50 * 1024 * 1024 },
  )
  const data = JSON.parse(stdout)
  return (data.entries || []).map((item: any) => ({
    id: String(item.id || ''),
    title: item.title || item.description || '',
    url: item.url || item.webpage_url,
    thumbnail: item.thumbnail || (Array.isArray(item.thumbnails) ? item.thumbnails.at(-1)?.url : null),
    duration: item.duration || null,
    timestamp: item.timestamp || null,
  }))
}

async function fetchOembed(url: string) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: BASE_HEADERS,
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      url,
      title: data.title || null,
      thumbnail: data.thumbnail_url || null,
      author_name: data.author_name || null,
      author_id: data.author_unique_id || null,
    }
  } catch {
    return null
  }
}

async function saveGroupedSeries(db: any, grouped: any[], creatorInfo: any) {
  await db.from('review_creators').upsert(
    {
      platform: 'tiktok',
      creator_url: creatorInfo.creator_url,
      creator_id: String(creatorInfo.creator_id),
      creator_name: creatorInfo.creator_name,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'platform,creator_url' },
  )

  for (const s of grouped) {
    await db.from('review_series').upsert(
      {
        series_key: s.series_key,
        platform: 'tiktok',
        creator_id: String(s.creator_id),
        creator_name: s.creator_name,
        title: s.title,
        movie_title: s.title,
        status: s.status === 'COMPLETE' ? 'COMPLETE' : 'UNKNOWN',
        found_parts: s.found_parts || s.videos?.length || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'series_key' },
    )

    for (const v of s.videos || []) {
      await db.from('review_videos').upsert(
        {
          platform: 'tiktok',
          video_id: v.video_id,
          series_key: s.series_key,
          creator_id: String(s.creator_id),
          creator_name: s.creator_name,
          title: v.title,
          canonical_url: v.url || v.canonical_url,
          embed_url: v.embed_url || `https://www.tiktok.com/embed/v2/${v.video_id}`,
          thumbnail: v.thumbnail,
          duration: v.duration,
          published_at: v.published_at || null,
          part_number: v.part_number,
          total_parts: v.total_parts,
          is_final: v.is_final,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'platform,video_id' },
      )
    }
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' })

  const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  const db =
    VITE_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null

  const action = req.body?.action || 'crawl_channel'

  try {
    // Feed ngẫu nhiên "Dành cho bạn": lấy video đề xuất công khai từ TikTok
    if (action === 'feed') {
      const count = Math.min(Number(req.body?.count) || 20, 30)
      const endpoints = [
        `https://www.tiktok.com/api/recommend/item_list/?aid=1988&app_language=vi&region=VN&count=${count}`,
        `https://www.tiktok.com/api/explore/item_list/?aid=1988&app_language=vi&region=VN&count=${count}&categoryType=119`,
      ]

      for (const endpoint of endpoints) {
        try {
          const r = await fetch(endpoint, { headers: BASE_HEADERS })
          if (!r.ok) continue
          const text = await r.text()
          if (!text) continue
          const data = JSON.parse(text)
          const items = (data.itemList || data.body?.itemList || []).map(mapFeedItem).filter(Boolean)
          if (items.length > 0) {
            return res.status(200).json({ success: true, source: 'tiktok', videos: items })
          }
        } catch {
          // thử endpoint tiếp theo
        }
      }

      // Lớp 2: trang /embed công khai — không cần chữ ký
      const htmlItems: any[] = []
      const seenFeed = new Set<string>()
      for (const seed of FEED_SEEDS) {
        try {
          for (const v of await fetchFeedFromEmbed(seed)) {
            if (!seenFeed.has(v.video_id)) {
              seenFeed.add(v.video_id)
              htmlItems.push(v)
            }
          }
        } catch {
          // thử seed tiếp theo
        }
        if (htmlItems.length >= count * 2) break
      }
      if (htmlItems.length > 0) {
        for (let i = htmlItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[htmlItems[i], htmlItems[j]] = [htmlItems[j], htmlItems[i]]
        }
        return res.status(200).json({ success: true, source: 'tiktok_embed', videos: htmlItems.slice(0, count) })
      }

      // TikTok chặn → dùng kho video đã lưu trong Supabase, xáo trộn cho giống feed
      if (db) {
        const { data: rows } = await db
          .from('review_videos')
          .select('*')
          .eq('platform', 'tiktok')
          .limit(300)
        if (rows && rows.length > 0) {
          const shuffled = [...rows]
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
          }
          const videos = shuffled.slice(0, count).map((v: any) => ({
            video_id: v.video_id,
            title: v.title,
            canonical_url: v.canonical_url,
            embed_url: v.embed_url || `https://www.tiktok.com/embed/v2/${v.video_id}`,
            thumbnail: v.thumbnail,
            duration: v.duration,
            creator_id: v.creator_id,
            creator_name: v.creator_name,
            avatar: null,
            like_count: null,
            comment_count: null,
            share_count: null,
            play_count: null,
            music: null,
            published_at: v.published_at,
          }))
          return res.status(200).json({ success: true, source: 'library', videos })
        }
      }

      return res.status(502).json({
        error: 'Không lấy được video đề xuất từ TikTok lúc này. Thử lại sau ít phút.',
        videos: [],
      })
    }

    // Bước 1 của nút "cào cả kênh": gom mọi video ID biết được (embed mới nhất + kho lưu trữ)
    if (action === 'channel_ids') {
      const username = extractUsername(String(req.body?.channelUrl || ''))
      if (!username) return res.status(400).json({ error: 'Thiếu link kênh TikTok' })
      const [recent, archived] = await Promise.all([
        fetchFeedFromEmbed(`@${username}`).catch(() => []),
        fetchArchivedIds(username).catch(() => []),
      ])
      const ids = [...new Set([...recent.map((v: any) => v.video_id), ...archived])].sort((a, b) =>
        a < b ? 1 : -1,
      )
      return res.status(200).json({ success: true, username, total: ids.length, ids })
    }

    // Bước 2: xử lý từng lô ID -> lấy metadata rồi lưu vào kho
    if (action === 'channel_meta') {
      const username = extractUsername(String(req.body?.username || req.body?.channelUrl || ''))
      const ids: string[] = (req.body?.ids || []).slice(0, 40)
      if (!username || ids.length === 0) return res.status(400).json({ error: 'Thiếu username hoặc ids' })

      const entries = await resolveIds(username, ids)
      const creatorInfo = {
        creator_id: username,
        creator_name: username,
        creator_url: `https://www.tiktok.com/@${username}`,
      }
      const grouped = groupVideosIntoSeries(entries, creatorInfo)
      if (db) await saveGroupedSeries(db, grouped, creatorInfo)
      return res.status(200).json({
        success: true,
        saved: entries.length,
        with_title: entries.filter((e) => e.title).length,
      })
    }

    // Tìm kiếm thật trên TikTok: "@user" -> kênh, còn lại -> hashtag tương ứng
    if (action === 'search') {
      const q = String(req.body?.query || '').trim()
      if (!q) return res.status(400).json({ error: 'Thiếu từ khoá tìm kiếm' })
      const paths = q.startsWith('@')
        ? [`@${extractUsername(q)}`]
        : [`tag/${encodeURIComponent(q.replace(/[#\s]+/g, ''))}`, `@${extractUsername(q)}`]

      for (const path of paths) {
        try {
          const videos = await fetchFeedFromEmbed(path)
          if (videos.length > 0) return res.status(200).json({ success: true, source: path, videos })
        } catch {
          // thử kiểu tìm tiếp theo
        }
      }
      return res.status(200).json({ success: true, source: 'empty', videos: [] })
    }

    // Lấy bình luận thật của một video qua API comment nội bộ của TikTok
    if (action === 'get_comments') {
      const videoId = String(req.body?.videoId || '').trim()
      if (!videoId) return res.status(400).json({ error: 'Thiếu videoId' })
      const params = new URLSearchParams({
        aid: '1988',
        aweme_id: videoId,
        count: '50',
        cursor: String(req.body?.cursor || 0),
      })
      const r = await fetch(`https://www.tiktok.com/api/comment/list/?${params}`, { headers: BASE_HEADERS })
      const text = r.ok ? await r.text() : ''
      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
      if (!data || !Array.isArray(data.comments)) {
        return res.status(502).json({ error: 'TikTok đang chặn tải bình luận từ server. Thử lại sau.' })
      }
      const comments = data.comments.map((c: any) => ({
        id: String(c.cid || ''),
        text: c.text || '',
        likes: c.digg_count || 0,
        created_at: c.create_time ? new Date(c.create_time * 1000).toISOString() : null,
        author: c.user?.nickname || c.user?.unique_id || 'Ẩn danh',
        author_id: c.user?.unique_id || null,
        avatar: c.user?.avatar_thumb?.url_list?.[0] || null,
        reply_count: c.reply_comment_total || 0,
      }))
      return res.status(200).json({
        success: true,
        comments,
        total: data.total ?? comments.length,
        has_more: Boolean(data.has_more),
        cursor: data.cursor ?? null,
      })
    }

    // Resolve metadata thật (title, thumbnail, author) cho link dán tay, qua TikTok oEmbed
    if (action === 'resolve_links') {
      const urls: string[] = (req.body?.urls || []).slice(0, 100)
      if (urls.length === 0) return res.status(400).json({ error: 'Thiếu danh sách link' })
      const items = (await Promise.all(urls.map(fetchOembed))).filter(Boolean)
      return res.status(200).json({ success: true, items })
    }

    if (action === 'crawl_channel') {
      const channelUrl = String(req.body?.channelUrl || '').trim()
      if (!channelUrl) return res.status(400).json({ error: 'Thiếu link kênh TikTok' })
      const username = extractUsername(channelUrl)
      if (!username) return res.status(400).json({ error: 'Không nhận diện được @username từ link' })

      let profile: CreatorProfile = {
        creator_id: username,
        creator_name: username,
        creator_url: `https://www.tiktok.com/@${username}`,
        sec_uid: null,
        avatar: null,
        follower_count: null,
        video_count: null,
        signature: null,
      }
      let entries: RawEntry[] = []
      const sources: string[] = []

      // Lớp 1: HTML profile (kèm hồ sơ creator + video nhúng sẵn)
      try {
        const r = await fetchProfile(username)
        profile = r.profile
        if (r.entries.length > 0) {
          entries = r.entries
          sources.push('html')
        }
      } catch (err: any) {
        sources.push(`html_failed:${err.message}`)
      }

      // Lớp 2: API item_list theo secUid (phân trang, lấy được nhiều video hơn)
      if (profile.sec_uid) {
        try {
          const apiEntries = await fetchItemList(profile.sec_uid, profile.creator_id)
          if (apiEntries.length > entries.length) {
            entries = apiEntries
            sources.push('item_list_api')
          }
        } catch {
          sources.push('item_list_failed')
        }
      }

      // Lớp 3: /embed + lần theo hashtag để moi cả video cũ của kênh
      if (entries.length === 0) {
        try {
          const deep = await crawlChannelDeep(username, Number(req.body?.budgetMs) || 45_000)
          if (deep.videos.length > 0) {
            entries = deep.videos.map((v: any) => ({
              id: v.video_id,
              title: v.title,
              url: v.canonical_url,
              thumbnail: v.thumbnail,
              duration: v.duration,
              timestamp: v.published_at ? Math.floor(new Date(v.published_at).getTime() / 1000) : null,
            }))
            if (profile.creator_name === username && deep.videos[0].creator_name) {
              profile.creator_name = deep.videos[0].creator_name
            }
            sources.push(`embed+tags(${deep.scannedTags} tag, còn ${deep.pendingTags})`)
          }
        } catch {
          sources.push('embed_failed')
        }
      }

      // Lớp 4: yt-dlp (chỉ hoạt động ở local dev có cài yt-dlp)
      if (entries.length === 0) {
        try {
          entries = await fetchViaYtDlp(profile.creator_url)
          sources.push('yt-dlp')
        } catch {
          sources.push('yt-dlp_failed')
        }
      }

      if (entries.length === 0) {
        return res.status(502).json({
          error:
            'TikTok đang chặn cào tự động từ server (không lấy được danh sách video). Hãy thử lại sau, hoặc dùng tab "Dán Link" / "JSON yt-dlp".',
          creator: profile,
          sources,
        })
      }

      const creatorInfo = {
        creator_id: profile.creator_id,
        creator_name: profile.creator_name,
        creator_url: profile.creator_url,
      }
      const grouped = groupVideosIntoSeries(entries, creatorInfo)

      if (db && req.body?.saveToDb !== false) {
        await saveGroupedSeries(db, grouped, creatorInfo)
      }

      return res.status(200).json({
        success: true,
        creator: profile,
        sources,
        total_videos: entries.length,
        total_series: grouped.length,
        series: grouped,
      })
    }

    if (action === 'save_series') {
      const { series, creator } = req.body
      if (!series || !Array.isArray(series)) {
        return res.status(400).json({ error: 'Thiếu dữ liệu series' })
      }
      if (db) {
        if (creator) {
          await saveGroupedSeries(db, series, {
            creator_id: creator.creator_id || creator.creator_name,
            creator_name: creator.creator_name,
            creator_url: creator.creator_url || `https://www.tiktok.com/@${creator.creator_name}`,
          })
        } else {
          for (const s of series) {
            await saveGroupedSeries(db, [s], {
              creator_id: s.creator_id,
              creator_name: s.creator_name,
              creator_url: s.creator_url || `https://www.tiktok.com/@${s.creator_name}`,
            })
          }
        }
      }
      return res.status(200).json({ success: true, saved_series: series.length })
    }

    return res.status(400).json({ error: 'Action không hợp lệ' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi xử lý server' })
  }
}
