import { BLManga } from '../../types/manga'
import { syncBLMangaChapters, getCustomBLMangaList, fetchBLMangaList } from './mangaService'
import { syncHMangaChapters, getCustomHMangaList, fetchHMangaList, type HManga } from './hMangaService'
import { fetchNgontinhList, fetchNgontinhChapters } from './ngontinhService'

export type MangaCategory = 'h' | 'bl' | 'ngontinh'

export type CrawlUpdateItem = {
  slug: string
  title: string
  category: MangaCategory
  addedCount: number
  oldCount: number
  newCount: number
}

export type CrawlReport = {
  category: MangaCategory
  totalScanned: number
  updatedItems: CrawlUpdateItem[]
  totalNewChapters: number
  durationSeconds: number
  startedAt: string
  finishedAt: string
  isTimedOut: boolean
}

export type CrawlerState = {
  isRunning: boolean
  category: MangaCategory | null
  currentTitle: string
  scannedCount: number
  totalCount: number
  newChaptersFound: number
  startedAt: number
  elapsedSeconds: number
  lastReport: CrawlReport | null
}

type Listener = (state: CrawlerState) => void

class MangaChapterCrawlerManager {
  private state: CrawlerState = {
    isRunning: false,
    category: null,
    currentTitle: '',
    scannedCount: 0,
    totalCount: 0,
    newChaptersFound: 0,
    startedAt: 0,
    elapsedSeconds: 0,
    lastReport: null,
  }

  private listeners = new Set<Listener>()
  private abortController: AbortController | null = null
  private timerInterval: any = null

  public getState(): CrawlerState {
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
        console.error('Crawler listener error:', err)
      }
    })
  }

  public clearReport() {
    this.state.lastReport = null
    this.notify()
  }

  public stop() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.state.isRunning = false
    this.notify()
  }

  public async startCrawl(category: MangaCategory): Promise<void> {
    if (this.state.isRunning) {
      return
    }

    this.abortController = new AbortController()
    const signal = this.abortController.signal

    const startTime = Date.now()
    const maxDurationMs = 15 * 60 * 1000 // 15 phút

    this.state = {
      isRunning: true,
      category,
      currentTitle: 'Đang tải danh sách truyện...',
      scannedCount: 0,
      totalCount: 0,
      newChaptersFound: 0,
      startedAt: startTime,
      elapsedSeconds: 0,
      lastReport: null,
    }
    this.notify()

    // Timer cập nhật số giây đã chạy
    this.timerInterval = setInterval(() => {
      if (!this.state.isRunning) {
        if (this.timerInterval) clearInterval(this.timerInterval)
        return
      }
      this.state.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      this.notify()
    }, 1000)

    const updatedItems: CrawlUpdateItem[] = []
    let totalScanned = 0
    let isTimedOut = false

    try {
      if (category === 'h') {
        // Lấy danh sách truyện H
        const [customList, fullList] = await Promise.all([
          Promise.resolve(getCustomHMangaList()),
          fetchHMangaList().catch(() => []),
        ])
        const map = new Map<string, HManga>()
        for (const m of customList) if (m?.slug) map.set(m.slug, m)
        for (const m of fullList) if (m?.slug && !map.has(m.slug)) map.set(m.slug, m)

        const stories = [...map.values()]
        this.state.totalCount = stories.length
        this.notify()

        for (const story of stories) {
          if (signal.aborted) break
          if (Date.now() - startTime >= maxDurationMs) {
            isTimedOut = true
            break
          }

          this.state.currentTitle = story.title || story.slug
          this.notify()

          try {
            const oldCount = Array.isArray(story.chapters) ? story.chapters.length : 0
            const res = await syncHMangaChapters(story)
            totalScanned++
            this.state.scannedCount = totalScanned

            if (res.updated && res.addedCount > 0) {
              const newCount = Array.isArray(res.manga.chapters) ? res.manga.chapters.length : oldCount + res.addedCount
              this.state.newChaptersFound += res.addedCount
              updatedItems.push({
                slug: story.slug,
                title: story.title,
                category: 'h',
                addedCount: res.addedCount,
                oldCount,
                newCount,
              })
            }
          } catch (e) {
            console.warn(`Lỗi khi cào truyện H ${story.slug}:`, e)
            totalScanned++
            this.state.scannedCount = totalScanned
          }

          this.notify()
          // Trì hoãn nhẹ 400ms giữa các request để tránh nghẽn
          await new Promise((r) => setTimeout(r, 400))
        }
      } else if (category === 'bl') {
        // Lấy danh sách truyện BL
        const [customList, fullList] = await Promise.all([
          Promise.resolve(getCustomBLMangaList()),
          fetchBLMangaList().catch(() => []),
        ])
        const map = new Map<string, BLManga>()
        for (const m of customList) if (m?.slug) map.set(m.slug, m)
        for (const m of fullList) if (m?.slug && !map.has(m.slug)) map.set(m.slug, m)

        const stories = [...map.values()]
        this.state.totalCount = stories.length
        this.notify()

        for (const story of stories) {
          if (signal.aborted) break
          if (Date.now() - startTime >= maxDurationMs) {
            isTimedOut = true
            break
          }

          this.state.currentTitle = story.title || story.slug
          this.notify()

          try {
            const oldCount = Array.isArray(story.chapters) ? story.chapters.length : 0
            let resAdded = 0
            let resNewCount = oldCount

            if (story.url || story.source === 'teamsany' || story.sourceName === 'Sany Team') {
              const res = await syncBLMangaChapters(story)
              if (res.updated && res.addedCount > 0) {
                resAdded = res.addedCount
                resNewCount = Array.isArray(res.manga.chapters) ? res.manga.chapters.length : oldCount + resAdded
              }
            } else if (story.source === 'otruyen' || !story.source) {
              // Thử kiểm tra OTruyen API
              const otRes = await fetch(`https://otruyenapi.com/v1/api/truyen-tranh/${story.slug}`).catch(() => null)
              if (otRes && otRes.ok) {
                const otData = await otRes.json().catch(() => null)
                const serverData = otData?.data?.item?.chapters?.[0]?.server_data || []
                if (serverData.length > oldCount) {
                  resAdded = serverData.length - oldCount
                  resNewCount = serverData.length
                }
              }
            }

            totalScanned++
            this.state.scannedCount = totalScanned

            if (resAdded > 0) {
              this.state.newChaptersFound += resAdded
              updatedItems.push({
                slug: story.slug,
                title: story.title,
                category: 'bl',
                addedCount: resAdded,
                oldCount,
                newCount: resNewCount,
              })
            }
          } catch (e) {
            console.warn(`Lỗi khi cào truyện BL ${story.slug}:`, e)
            totalScanned++
            this.state.scannedCount = totalScanned
          }

          this.notify()
          await new Promise((r) => setTimeout(r, 400))
        }
      } else if (category === 'ngontinh') {
        // Lấy danh sách truyện Ngôn Tình
        const fullList = await fetchNgontinhList().catch(() => [])
        const stories = fullList.filter((m) => Boolean(m?.slug))
        this.state.totalCount = stories.length
        this.notify()

        for (const story of stories) {
          if (signal.aborted) break
          if (Date.now() - startTime >= maxDurationMs) {
            isTimedOut = true
            break
          }

          this.state.currentTitle = story.title || story.slug
          this.notify()

          try {
            const existingChaps = await fetchNgontinhChapters(story.slug).catch(() => [])
            const oldCount = Array.isArray(existingChaps) && existingChaps.length > 0 
              ? existingChaps.length 
              : (Array.isArray(story.chapters) ? story.chapters.length : 0)

            let resAdded = 0
            let resNewCount = oldCount

            // Quét OTruyen
            const otRes = await fetch(`https://otruyenapi.com/v1/api/truyen-tranh/${story.slug}`).catch(() => null)
            if (otRes && otRes.ok) {
              const otData = await otRes.json().catch(() => null)
              const serverData = otData?.data?.item?.chapters?.[0]?.server_data || []
              if (serverData.length > oldCount) {
                resAdded = serverData.length - oldCount
                resNewCount = serverData.length
              }
            }

            totalScanned++
            this.state.scannedCount = totalScanned

            if (resAdded > 0) {
              this.state.newChaptersFound += resAdded
              updatedItems.push({
                slug: story.slug,
                title: story.title,
                category: 'ngontinh',
                addedCount: resAdded,
                oldCount,
                newCount: resNewCount,
              })
            }
          } catch (e) {
            console.warn(`Lỗi khi kiểm tra ngôn tình ${story.slug}:`, e)
            totalScanned++
            this.state.scannedCount = totalScanned
          }

          this.notify()
          await new Promise((r) => setTimeout(r, 350))
        }
      }
    } finally {
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
        this.timerInterval = null
      }

      const totalDuration = Math.round((Date.now() - startTime) / 1000)
      const report: CrawlReport = {
        category,
        totalScanned,
        updatedItems,
        totalNewChapters: updatedItems.reduce((sum, item) => sum + item.addedCount, 0),
        durationSeconds: totalDuration,
        startedAt: new Date(startTime).toLocaleTimeString('vi-VN'),
        finishedAt: new Date().toLocaleTimeString('vi-VN'),
        isTimedOut,
      }

      this.state = {
        isRunning: false,
        category,
        currentTitle: '',
        scannedCount: totalScanned,
        totalCount: this.state.totalCount,
        newChaptersFound: report.totalNewChapters,
        startedAt: 0,
        elapsedSeconds: totalDuration,
        lastReport: report,
      }
      this.notify()
    }
  }
}

export const mangaChapterCrawler = new MangaChapterCrawlerManager()
