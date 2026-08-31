import { apiFetch } from '../../lib/apiFetch'
import { getRemoteAppSetting, saveAppSetting } from '../../lib/userAppSettings'

export type YoutubeCrawlChannelTarget = {
  id: string
  creator_url: string
  creator_name: string
  creator_id?: string | null
  category: string
  tag?: string
  cover?: string | null
  videoCount?: number
  sourceTable?: 'tvshow' | 'review'
}

export interface YoutubeChannelCrawlLogItem {
  creator_url: string
  creator_name: string
  lastCrawledAt: string // ISO string
  newVideosCount: number
  scannedPages?: number
  status: 'completed' | 'skipped_cooldown' | 'timeout' | 'stopped' | 'error'
  errorMessage?: string
}

export type YoutubeChannelCrawlHistoryMap = Record<string, YoutubeChannelCrawlLogItem>

export const YOUTUBE_CHANNEL_CRAWL_HISTORY_KEY = 'youtube_channel_crawl_history'
export const YOUTUBE_CRAWL_HISTORY_UPDATED_EVENT = 'youtube_channel_crawl_history_updated'

export function getLocalYoutubeChannelCrawlHistory(): YoutubeChannelCrawlHistoryMap {
  try {
    const raw = localStorage.getItem(YOUTUBE_CHANNEL_CRAWL_HISTORY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export async function fetchRemoteYoutubeChannelCrawlHistory(): Promise<YoutubeChannelCrawlHistoryMap> {
  try {
    const remote = await getRemoteAppSetting<YoutubeChannelCrawlHistoryMap>(YOUTUBE_CHANNEL_CRAWL_HISTORY_KEY, {})
    if (remote && typeof remote === 'object') {
      const merged = { ...getLocalYoutubeChannelCrawlHistory(), ...remote }
      localStorage.setItem(YOUTUBE_CHANNEL_CRAWL_HISTORY_KEY, JSON.stringify(merged))
      return merged
    }
  } catch (err) {
    console.warn('Lỗi tải lịch sử cào kênh YouTube từ Supabase:', err)
  }
  return getLocalYoutubeChannelCrawlHistory()
}

export async function recordYoutubeChannelCrawlLog(item: YoutubeChannelCrawlLogItem): Promise<void> {
  try {
    const current = getLocalYoutubeChannelCrawlHistory()
    current[item.creator_url] = item
    localStorage.setItem(YOUTUBE_CHANNEL_CRAWL_HISTORY_KEY, JSON.stringify(current))
    window.dispatchEvent(new CustomEvent(YOUTUBE_CRAWL_HISTORY_UPDATED_EVENT, { detail: item }))
    void saveAppSetting(YOUTUBE_CHANNEL_CRAWL_HISTORY_KEY, current)
  } catch (err) {
    console.error('Lỗi lưu lịch sử cào kênh YouTube:', err)
  }
}

export function formatCrawlTimeAgo(isoString?: string): string {
  if (!isoString) return 'Chưa từng cào'
  try {
    const date = new Date(isoString)
    const diffMs = Date.now() - date.getTime()
    if (diffMs < 0 || isNaN(diffMs)) return 'Vừa xong'
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'Vừa xong'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} phút trước`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} giờ trước`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays} ngày trước`
    return date.toLocaleDateString('vi-VN')
  } catch {
    return 'Chưa từng cào'
  }
}

export function isChannelInCooldown(
  creatorUrl: string,
  cooldownMinutes: number,
  historyMap?: YoutubeChannelCrawlHistoryMap
): { inCooldown: boolean; minutesAgo: number; lastLog?: YoutubeChannelCrawlLogItem } {
  if (!creatorUrl || cooldownMinutes <= 0) return { inCooldown: false, minutesAgo: Infinity }
  const map = historyMap || getLocalYoutubeChannelCrawlHistory()
  const log = map[creatorUrl]
  if (!log || !log.lastCrawledAt) return { inCooldown: false, minutesAgo: Infinity }

  const diffMs = Date.now() - new Date(log.lastCrawledAt).getTime()
  if (isNaN(diffMs) || diffMs < 0) return { inCooldown: false, minutesAgo: Infinity, lastLog: log }
  const minutesAgo = Math.floor(diffMs / (60 * 1000))
  return {
    inCooldown: minutesAgo < cooldownMinutes,
    minutesAgo,
    lastLog: log,
  }
}

export type YoutubeCrawlChannelResult = {
  channelId?: string | null
  channelName: string
  creatorUrl: string
  category: string
  tag?: string
  cover?: string | null
  newVideosCount: number
  scannedPages: number
  status: 'completed' | 'skipped_cooldown' | 'timeout' | 'stopped' | 'error'
  errorMessage?: string
}

export type YoutubeCrawlReport = {
  totalNewVideos: number
  totalChannelsScanned: number
  totalChannelsSkipped: number
  totalChannelsTargeted: number
  durationSeconds: number
  targetDurationMinutes: number
  startedAt: string
  finishedAt: string
  isTimedOut: boolean
  isStoppedByUser: boolean
  channelResults: YoutubeCrawlChannelResult[]
}

export type YoutubeCrawlOptions = {
  durationMinutes?: number
  skipRecentlyCrawled?: boolean
  cooldownMinutes?: number
  forceCrawl?: boolean
}

export type YoutubeCrawlerState = {
  isRunning: boolean
  currentChannelName: string
  currentChannelIndex: number
  totalChannels: number
  newVideosFound: number
  skippedChannelsCount: number
  startedAt: number
  elapsedSeconds: number
  targetDurationMinutes: number
  targetDurationSeconds: number
  lastReport: YoutubeCrawlReport | null
}

type Listener = (state: YoutubeCrawlerState) => void

class YoutubeChannelCrawlerManager {
  private state: YoutubeCrawlerState = {
    isRunning: false,
    currentChannelName: '',
    currentChannelIndex: 0,
    totalChannels: 0,
    newVideosFound: 0,
    skippedChannelsCount: 0,
    startedAt: 0,
    elapsedSeconds: 0,
    targetDurationMinutes: 15,
    targetDurationSeconds: 15 * 60,
    lastReport: null,
  }

  private listeners = new Set<Listener>()
  private abortController: AbortController | null = null
  private timerInterval: any = null
  private isUserAborted = false

  public getState(): YoutubeCrawlerState {
    return { ...this.state }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const s = this.getState()
    this.listeners.forEach((l) => {
      try {
        l(s)
      } catch (err) {
        console.error('YoutubeCrawler listener error:', err)
      }
    })
  }

  public clearReport() {
    this.state.lastReport = null
    this.notify()
  }

  public stop() {
    this.isUserAborted = true
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  public async startCrawl(
    channels: YoutubeCrawlChannelTarget[],
    options?: YoutubeCrawlOptions,
  ): Promise<void> {
    if (this.state.isRunning || channels.length === 0) {
      return
    }

    const durationMinutes = options?.durationMinutes ?? 15
    const skipRecentlyCrawled = options?.skipRecentlyCrawled ?? true
    const cooldownMinutes = options?.cooldownMinutes ?? 60
    const forceCrawl = options?.forceCrawl ?? false

    this.isUserAborted = false
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    const startTime = Date.now()
    const maxDurationMs = durationMinutes > 0 ? durationMinutes * 60 * 1000 : Infinity
    const targetDurationSeconds = durationMinutes > 0 ? durationMinutes * 60 : 0

    this.state = {
      isRunning: true,
      currentChannelName: channels[0]?.creator_name || 'Đang chuẩn bị...',
      currentChannelIndex: 0,
      totalChannels: channels.length,
      newVideosFound: 0,
      skippedChannelsCount: 0,
      startedAt: startTime,
      elapsedSeconds: 0,
      targetDurationMinutes: durationMinutes,
      targetDurationSeconds,
      lastReport: null,
    }
    this.notify()

    this.timerInterval = setInterval(() => {
      if (!this.state.isRunning) {
        if (this.timerInterval) clearInterval(this.timerInterval)
        return
      }
      this.state.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      this.notify()
    }, 1000)

    const channelResults: YoutubeCrawlChannelResult[] = []
    let totalNewVideos = 0
    let skippedChannelsCount = 0
    let isTimedOut = false

    // Load category and tag maps to update them incrementally
    const currentCatMap = await getRemoteAppSetting<Record<string, string>>('youtube_channel_categories', {}).catch(() => ({}))
    const currentTagMap = await getRemoteAppSetting<Record<string, string>>('youtube_channel_tags', {}).catch(() => ({}))
    const historyMap = await fetchRemoteYoutubeChannelCrawlHistory().catch(() => getLocalYoutubeChannelCrawlHistory())

    const updatedCatMap = { ...currentCatMap }
    const updatedTagMap = { ...currentTagMap }

    try {
      for (let i = 0; i < channels.length; i++) {
        if (signal.aborted) break
        if (Date.now() - startTime >= maxDurationMs) {
          isTimedOut = true
          break
        }

        const ch = channels[i]
        this.state.currentChannelIndex = i + 1
        this.state.currentChannelName = ch.creator_name
        this.notify()

        // ── Kiểm tra thời gian cào gần nhất (Cơ chế bỏ qua kênh vừa cào) ──
        const cooldownCheck = isChannelInCooldown(ch.creator_url, cooldownMinutes, historyMap)
        if (skipRecentlyCrawled && !forceCrawl && cooldownCheck.inCooldown) {
          skippedChannelsCount++
          this.state.skippedChannelsCount = skippedChannelsCount
          this.state.currentChannelName = `[Bỏ qua] ${ch.creator_name} (vừa cào ${cooldownCheck.minutesAgo}p trước)`
          this.notify()

          channelResults.push({
            channelId: ch.creator_id,
            channelName: ch.creator_name,
            creatorUrl: ch.creator_url,
            category: ch.category,
            tag: ch.tag,
            cover: ch.cover,
            newVideosCount: 0,
            scannedPages: 0,
            status: 'skipped_cooldown',
            errorMessage: `Vừa cào cách đây ${cooldownCheck.minutesAgo} phút (Bỏ qua)`,
          })
          continue
        }

        const apiEndpoint = ch.sourceTable === 'review' ? '/api/sync-review' : '/api/sync-tvshow'
        let newCountForChannel = 0
        let pagesCount = 0
        let channelStatus: 'completed' | 'skipped_cooldown' | 'timeout' | 'stopped' | 'error' = 'completed'
        let errorMsg: string | undefined

        try {
          // 1. Lấy kế hoạch cào (Plan)
          const planRes = await apiFetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'plan', creatorUrl: ch.creator_url }),
            signal,
          })
          const planJson = await planRes.json().catch(() => ({}))
          if (!planRes.ok || !planJson?.plan) {
            throw new Error(planJson?.error || `Không tải được thông tin kênh (HTTP ${planRes.status})`)
          }

          const plan = planJson.plan

          // Gán thể loại và tag của kênh vào maps
          if (ch.category) {
            if (plan.channelId) updatedCatMap[plan.channelId] = ch.category
            if (plan.channelName) updatedCatMap[plan.channelName] = ch.category
            if (ch.creator_id) updatedCatMap[ch.creator_id] = ch.category
            if (ch.creator_name) updatedCatMap[ch.creator_name] = ch.category
            if (ch.creator_url) updatedCatMap[ch.creator_url] = ch.category

            if (ch.tag) {
              if (plan.channelId) updatedTagMap[plan.channelId] = ch.tag
              if (plan.channelName) updatedTagMap[plan.channelName] = ch.tag
              if (ch.creator_id) updatedTagMap[ch.creator_id] = ch.tag
              if (ch.creator_name) updatedTagMap[ch.creator_name] = ch.tag
              if (ch.creator_url) updatedTagMap[ch.creator_url] = ch.tag
            }
          }

          // 2. Duyệt từng trang video và lưu trực tiếp vào cơ sở dữ liệu (Cào tới đâu lưu tới đó)
          for (let entryIndex = 0; entryIndex < (plan.entries?.length || 0); entryIndex++) {
            const entry = plan.entries[entryIndex]
            let pageToken: string | undefined
            let pageNum = 0

            do {
              if (signal.aborted) {
                channelStatus = 'stopped'
                break
              }
              if (Date.now() - startTime >= maxDurationMs) {
                isTimedOut = true
                channelStatus = 'timeout'
                break
              }

              const pageRes = await apiFetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'page',
                  plan,
                  cursor: { entryIndex, pageToken },
                  dryRun: false, // Lưu ngay vào cơ sở dữ liệu
                }),
                signal,
              })

              const pageJson = await pageRes.json().catch(() => ({}))
              if (!pageRes.ok || !pageJson?.outcome) {
                break
              }

              const outcome = pageJson.outcome
              const saved = Number(outcome.saved) || 0
              newCountForChannel += saved
              totalNewVideos += saved
              this.state.newVideosFound = totalNewVideos
              this.notify()

              pagesCount++
              pageNum++

              // Nếu là danh sách uploads và toàn bộ video trên trang đều đã có trong hệ thống -> hoàn tất kênh này
              if (entry.isUploads && outcome.allKnown && pageNum > 1) {
                break
              }

              pageToken = outcome.nextPageToken
              // Giới hạn tối đa 6 trang cho mỗi kênh mỗi lượt cào để tránh vượt quota
              if (pageNum >= 6) {
                break
              }
            } while (pageToken)

            if (channelStatus === 'stopped' || channelStatus === 'timeout') {
              break
            }
          }

          // 3. Hoàn tất kênh
          if (channelStatus !== 'stopped' && channelStatus !== 'timeout') {
            await apiFetch(apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'finish', creatorUrl: ch.creator_url }),
            }).catch(() => {})
          }
        } catch (err: any) {
          if (signal.aborted) {
            channelStatus = 'stopped'
          } else {
            console.warn(`Lỗi khi cào kênh ${ch.creator_name}:`, err)
            channelStatus = 'error'
            errorMsg = err?.message || String(err)
          }
        }

        channelResults.push({
          channelId: ch.creator_id,
          channelName: ch.creator_name,
          creatorUrl: ch.creator_url,
          category: ch.category,
          tag: ch.tag,
          cover: ch.cover,
          newVideosCount: newCountForChannel,
          scannedPages: pagesCount,
          status: channelStatus,
          errorMessage: errorMsg,
        })

        // Ghi nhận lịch sử cào của kênh vào Supabase
        if (channelStatus !== 'stopped') {
          void recordYoutubeChannelCrawlLog({
            creator_url: ch.creator_url,
            creator_name: ch.creator_name,
            lastCrawledAt: new Date().toISOString(),
            newVideosCount: newCountForChannel,
            scannedPages: pagesCount,
            status: channelStatus,
            errorMessage: errorMsg,
          })
          historyMap[ch.creator_url] = {
            creator_url: ch.creator_url,
            creator_name: ch.creator_name,
            lastCrawledAt: new Date().toISOString(),
            newVideosCount: newCountForChannel,
            scannedPages: pagesCount,
            status: channelStatus,
            errorMessage: errorMsg,
          }
        }

        // Tự động lưu cấu hình thể loại & tag kênh sau mỗi kênh hoàn tất
        try {
          await saveAppSetting('youtube_channel_categories', updatedCatMap)
          if (Object.keys(updatedTagMap).length > 0) {
            await saveAppSetting('youtube_channel_tags', updatedTagMap)
          }
        } catch {}

        this.notify()
      }
    } finally {
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
        this.timerInterval = null
      }

      // Lưu lần cuối maps thể loại và tag
      try {
        await saveAppSetting('youtube_channel_categories', updatedCatMap)
        await saveAppSetting('youtube_channel_tags', updatedTagMap)
      } catch {}

      const totalDuration = Math.round((Date.now() - startTime) / 1000)
      const report: YoutubeCrawlReport = {
        totalNewVideos,
        totalChannelsScanned: channelResults.filter((r) => r.status !== 'skipped_cooldown').length,
        totalChannelsSkipped: skippedChannelsCount,
        totalChannelsTargeted: channels.length,
        durationSeconds: totalDuration,
        targetDurationMinutes: durationMinutes,
        startedAt: new Date(startTime).toLocaleTimeString('vi-VN'),
        finishedAt: new Date().toLocaleTimeString('vi-VN'),
        isTimedOut,
        isStoppedByUser: this.isUserAborted,
        channelResults,
      }

      this.state = {
        isRunning: false,
        currentChannelName: '',
        currentChannelIndex: channelResults.length,
        totalChannels: channels.length,
        newVideosFound: totalNewVideos,
        skippedChannelsCount,
        startedAt: 0,
        elapsedSeconds: totalDuration,
        targetDurationMinutes: durationMinutes,
        targetDurationSeconds,
        lastReport: report,
      }
      this.notify()
    }
  }
}

export const youtubeChannelCrawler = new YoutubeChannelCrawlerManager()
