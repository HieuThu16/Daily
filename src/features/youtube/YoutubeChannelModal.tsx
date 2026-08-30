import { useState, useMemo } from 'react'
import {
  X, Search, Play, CheckCircle2,
  ListVideo, Layers, ArrowLeft,
} from 'lucide-react'
import { formatDuration, publishedLabel, type WatchVideo } from './YoutubeWatchPage'

export type PlaylistGroup = {
  id: string
  title: string
  thumbnail: string
  videos: Array<{
    video: WatchVideo
    episodeNum: number
  }>
}

/**
 * Thuật toán tách tiêu đề thông minh để nhóm các tập phim/video thành Danh Sách Phát (Playlist)
 */
export function extractSeriesAndEpisode(title: string): { seriesName: string; episodeNum: number } {
  let raw = title.trim()

  // 1. Tìm số tập (Tập 1, Ep 1, T1, Part 1, #1, Tập 01...)
  let epNum = 0
  const epPatterns = [
    /(?:tập|tap|ep|episode|part|phần|phan|số|so)\s*(\d+)/i,
    /\[\s*(?:tập|tap|ep|part)?\s*(\d+)\s*\]/i,
    /(?:\(|\[)\s*t(?:ập)?\s*(\d+)\s*(?:\)|\])/i,
    /(?:^|\s)#(\d+)(?:\s|$|:|-)/i,
    /-\s*t(\d+)\b/i,
  ]

  for (const pat of epPatterns) {
    const m = raw.match(pat)
    if (m && m[1]) {
      epNum = parseInt(m[1], 10)
      break
    }
  }

  // 2. Làm sạch tiêu đề để trích xuất tên Series gốc
  let clean = raw
    // Bỏ hậu tố độ phân giải, định dạng
    .replace(/\b(?:4k|full\s*hd|hd|1080p|720p|official\s*mv|mv|trailer|teaser|live|trực\s*tiếp)\b/gi, '')
    // Bỏ nhãn phụ trong ngoặc: (Tập Cuối), (Thuyết Minh), (Vietsub), (Phim Hài 2024)...
    .replace(/\((?:tập\s*cuối|thuyết\s*minh|vietsub|lồng\s*tiếng|bản\s*đẹp|phim\s*ngắn|web\s*drama|hài\s*tết|phim\s*hài[^)]*|faptv[^)]*)\)/gi, '')
    .replace(/\[(?:tập\s*cuối|thuyết\s*minh|vietsub|lồng\s*tiếng|bản\s*đẹp|phim\s*ngắn|web\s*drama|faptv[^\]]*)\]/gi, '')
    // Bỏ mẫu chỉ tập
    .replace(/(?:[-|:]\s*)?(?:tập|tap|ep|episode|part|phần|phan|số|so)\s*\d+[^|-]*/gi, '')
    .replace(/\[\s*(?:tập|tap|ep|part)?\s*\d+\s*\]/gi, '')
    .replace(/(?:\(|\[)\s*t(?:ập)?\s*\d+\s*(?:\)|\])/gi, '')
    .replace(/(?:^|\s)#\d+(?:\s|$|:|-)/gi, '')
    // Bỏ kênh / đuôi phân cách | FAPtv, | Phim Hay...
    .replace(/\|\s*[^|]+$/g, '')
    // Bỏ khoảng trắng & ký tự thừa đầu/cuối
    .replace(/^[-–—|:\s]+|[-–—|:\s]+$/g, '')
    .trim()

  if (!clean || clean.length < 3) {
    clean = raw.split(/[-–—|:]/)[0].trim() || 'Video Khác'
  }

  return { seriesName: clean, episodeNum: epNum }
}

export function groupVideosIntoPlaylists(videos: WatchVideo[]): PlaylistGroup[] {
  const groupsMap = new Map<string, Array<{ video: WatchVideo; episodeNum: number }>>()

  for (const v of videos) {
    const { seriesName, episodeNum } = extractSeriesAndEpisode(v.title)
    const key = seriesName.toLowerCase()

    if (!groupsMap.has(key)) {
      groupsMap.set(key, [])
    }
    groupsMap.get(key)!.push({ video: v, episodeNum })
  }

  const playlists: PlaylistGroup[] = []
  const miscellaneous: Array<{ video: WatchVideo; episodeNum: number }> = []

  for (const [, items] of groupsMap.entries()) {
    // Nếu có từ 2 video trở lên cùng series hoặc có số tập rõ ràng -> Tạo Playlist riêng
    const hasEpisodes = items.some((i) => i.episodeNum > 0)
    if (items.length >= 2 || hasEpisodes) {
      // Sắp xếp các tập theo thứ tự tập tăng dần (Tập 1, 2, 3...)
      const sorted = [...items].sort((a, b) => {
        if (a.episodeNum > 0 && b.episodeNum > 0) return a.episodeNum - b.episodeNum
        // Nếu không có số tập thì theo ngày đăng cũ -> mới
        const timeA = a.video.published_at ? new Date(a.video.published_at).getTime() : 0
        const timeB = b.video.published_at ? new Date(b.video.published_at).getTime() : 0
        return timeA - timeB
      })

      const bestTitle = items[0]?.video ? extractSeriesAndEpisode(items[0].video.title).seriesName : 'Danh sách phát'
      const thumb = sorted[0]?.video.thumbnail || sorted[sorted.length - 1]?.video.thumbnail || ''

      playlists.push({
        id: `pl-${encodeURIComponent(bestTitle)}`,
        title: bestTitle,
        thumbnail: thumb,
        videos: sorted,
      })
    } else {
      miscellaneous.push(...items)
    }
  }

  // Nếu có video lẻ -> gom vào nhóm "Video Khác / Tổng Hợp"
  if (miscellaneous.length > 0) {
    playlists.push({
      id: 'pl-misc',
      title: '🎬 Video Khác / Tổng Hợp',
      thumbnail: miscellaneous[0]?.video.thumbnail || '',
      videos: miscellaneous.sort((a, b) => {
        const timeA = a.video.published_at ? new Date(a.video.published_at).getTime() : 0
        const timeB = b.video.published_at ? new Date(b.video.published_at).getTime() : 0
        return timeB - timeA
      }),
    })
  }

  // Sắp xếp playlist có nhiều tập hơn lên trước
  return playlists.sort((a, b) => b.videos.length - a.videos.length)
}

export function YoutubeChannelModal({
  isOpen,
  onClose,
  channelName,
  videos,
  currentVideoId,
  watchedSet,
  progressMap,
  onSelectVideo,
}: {
  isOpen: boolean
  onClose: () => void
  channelName: string
  videos: WatchVideo[]
  currentVideoId?: string
  watchedSet: Set<string>
  progressMap: Record<string, any>
  onSelectVideo: (videoId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'latest' | 'playlists'>('latest')
  const [search, setSearch] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistGroup | null>(null)
  const [visibleVideoCount, setVisibleVideoCount] = useState(16)

  // Danh sách video sắp xếp mới nhất
  const sortedLatestVideos = useMemo(() => {
    return [...videos].sort((a, b) => {
      const timeA = a.published_at ? new Date(a.published_at).getTime() : 0
      const timeB = b.published_at ? new Date(b.published_at).getTime() : 0
      return timeB - timeA
    })
  }, [videos])

  // Lọc tìm kiếm trong danh sách video
  const filteredVideos = useMemo(() => {
    const q = search.trim().toLowerCase()
    setVisibleVideoCount(16)
    if (!q) return sortedLatestVideos
    return sortedLatestVideos.filter((v) => v.title.toLowerCase().includes(q))
  }, [sortedLatestVideos, search])

  // Tự động phân chia danh sách phát theo tên
  const playlists = useMemo(() => {
    return groupVideosIntoPlaylists(videos)
  }, [videos])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          background: 'var(--card-bg, #18181b)',
          border: '1px solid var(--card-border, #27272a)',
          borderRadius: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Kênh */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--card-border, #27272a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--bg-subtle, rgba(255, 255, 255, 0.02))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f43f5e, #be123c)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.2rem',
                fontWeight: 800,
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)',
              }}
            >
              {(channelName || 'Y').trim().charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main, #fff)', margin: 0, lineHeight: 1.3 }}>
                {channelName || 'Kênh YouTube'}
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #a1a1aa)', marginTop: 2 }}>
                {videos.length} video trong kho ứng dụng
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-main, #fff)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Thanh chuyển 2 Tab */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderBottom: '1px solid var(--card-border, #27272a)',
            background: 'var(--card-bg, #18181b)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('latest')
              setSelectedPlaylist(null)
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'latest' ? 'var(--primary, #2563eb)' : 'transparent',
              color: activeTab === 'latest' ? '#fff' : 'var(--text-muted, #a1a1aa)',
              border: activeTab === 'latest' ? 'none' : '1px solid var(--card-border, #27272a)',
              transition: 'all 0.2s',
            }}
          >
            <Play size={14} /> Danh sách video ({videos.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('playlists')}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'playlists' ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'transparent',
              color: activeTab === 'playlists' ? '#fff' : 'var(--text-muted, #a1a1aa)',
              border: activeTab === 'playlists' ? 'none' : '1px solid var(--card-border, #27272a)',
              transition: 'all 0.2s',
            }}
          >
            <Layers size={14} /> Danh sách phát ({playlists.length})
          </button>
        </div>

        {/* Nội dung Tab */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeTab === 'latest' ? (
            /* TAB 1: DANH SÁCH VIDEO MỚI NHẤT & TÌM KIẾM */
            <div>
              {/* Ô tìm kiếm trong video của kênh */}
              <div
                style={{
                  position: 'relative',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-muted, #a1a1aa)' }} />
                <input
                  type="text"
                  placeholder={`Tìm kiếm trong ${videos.length} video của ${channelName}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 40px',
                    borderRadius: 12,
                    background: 'var(--bg-subtle, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--card-border, #27272a)',
                    color: 'var(--text-main, #fff)',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute',
                      right: 12,
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted, #a1a1aa)',
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Danh sách video */}
              {filteredVideos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted, #a1a1aa)', fontSize: '0.86rem' }}>
                  Không tìm thấy video nào phù hợp với từ khóa &ldquo;{search}&rdquo;.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 14,
                  }}
                >
                  {filteredVideos.slice(0, visibleVideoCount).map((v) => {
                    const isCurrent = v.video_id === currentVideoId
                    const isWatched = watchedSet.has(v.video_id)
                    const p = progressMap[v.video_id]

                    return (
                      <div
                        key={v.id || v.video_id}
                        onClick={() => {
                          onSelectVideo(v.video_id)
                          onClose()
                        }}
                        style={{
                          background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg, #1f1f23)',
                          border: `1px solid ${isCurrent ? 'var(--primary, #3b82f6)' : 'var(--card-border, #27272a)'}`,
                          borderRadius: 14,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform 0.18s, border-color 0.18s',
                        }}
                      >
                        {/* Thumbnail */}
                        <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000', overflow: 'hidden' }}>
                          {v.thumbnail && (
                            <img
                              src={v.thumbnail}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          )}
                          {v.duration ? (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 6,
                                right: 6,
                                background: 'rgba(0, 0, 0, 0.8)',
                                color: '#fff',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 6,
                              }}
                            >
                              {formatDuration(v.duration)}
                            </span>
                          ) : null}
                          {isCurrent && (
                            <span
                              style={{
                                position: 'absolute',
                                top: 6,
                                left: 6,
                                background: 'var(--primary, #2563eb)',
                                color: '#fff',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 99,
                              }}
                            >
                              Đang phát
                            </span>
                          )}
                          {/* Thanh tiến độ */}
                          {p && p.percent > 0 && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.2)' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, p.percent)}%`,
                                  height: '100%',
                                  background: isWatched ? '#10b981' : '#ef4444',
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Title & info */}
                        <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <h4
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: 'var(--text-main, #fff)',
                              margin: '0 0 6px',
                              lineHeight: 1.35,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {v.title}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)' }}>
                            <span>{publishedLabel(v.published_at)}</span>
                            {isWatched && (
                              <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <CheckCircle2 size={12} /> Đã xem
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Nút tải thêm video khi còn video */}
              {visibleVideoCount < filteredVideos.length && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '20px 0 10px' }}>
                  <button
                    type="button"
                    onClick={() => setVisibleVideoCount((c) => c + 16)}
                    style={{
                      padding: '9px 24px',
                      borderRadius: 12,
                      background: 'var(--primary, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    }}
                  >
                    Tải thêm video (+{Math.min(16, filteredVideos.length - visibleVideoCount)} video)
                  </button>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 600 }}>
                    Đang hiển thị {Math.min(visibleVideoCount, filteredVideos.length)} trên tổng số {filteredVideos.length} video
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: DANH SÁCH PHÁT (TỰ ĐỘNG CHIA THEO PHIM / BỘ TẬP 1 2 3...) */
            <div>
              {selectedPlaylist ? (
                /* ĐANG XEM CHI TIẾT 1 PLAYLIST */
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlaylist(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #3b82f6)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 14,
                      padding: 0,
                    }}
                  >
                    <ArrowLeft size={16} /> Quay lại danh sách phát
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(168, 85, 247, 0.1))',
                      borderRadius: 14,
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #f43f5e, #be123c)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ListVideo size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main, #fff)', margin: 0 }}>
                        {selectedPlaylist.title}
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #a1a1aa)', marginTop: 2 }}>
                        {selectedPlaylist.videos.length} tập / video theo thứ tự
                      </div>
                    </div>
                  </div>

                  {/* Danh sách các tập trong Playlist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedPlaylist.videos.map(({ video: v, episodeNum }, idx) => {
                      const isCurrent = v.video_id === currentVideoId
                      const isWatched = watchedSet.has(v.video_id)
                      const p = progressMap[v.video_id]

                      return (
                        <div
                          key={v.id || v.video_id}
                          onClick={() => {
                            onSelectVideo(v.video_id)
                            onClose()
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg, #1f1f23)',
                            border: `1px solid ${isCurrent ? 'var(--primary, #3b82f6)' : 'var(--card-border, #27272a)'}`,
                            borderRadius: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {/* Số thứ tự tập */}
                          <div
                            style={{
                              width: 30,
                              fontSize: '0.86rem',
                              fontWeight: 800,
                              color: isCurrent ? 'var(--primary, #3b82f6)' : 'var(--text-muted, #a1a1aa)',
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {episodeNum > 0 ? `#${episodeNum}` : `${idx + 1}`}
                          </div>

                          {/* Thumbnail */}
                          <div
                            style={{
                              position: 'relative',
                              width: 100,
                              aspectRatio: '16 / 9',
                              borderRadius: 8,
                              overflow: 'hidden',
                              background: '#000',
                              flexShrink: 0,
                            }}
                          >
                            {v.thumbnail && (
                              <img
                                src={v.thumbnail}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                            {v.duration ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: 3,
                                  right: 3,
                                  background: 'rgba(0, 0, 0, 0.8)',
                                  color: '#fff',
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  padding: '1px 4px',
                                  borderRadius: 4,
                                }}
                              >
                                {formatDuration(v.duration)}
                              </span>
                            ) : null}
                          </div>

                          {/* Tiêu đề & trạng thái */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: isCurrent ? 'var(--primary, #3b82f6)' : 'var(--text-main, #fff)',
                                lineHeight: 1.3,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {v.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)' }}>
                              <span>{publishedLabel(v.published_at)}</span>
                              {isWatched && (
                                <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <CheckCircle2 size={12} /> Đã xem
                                </span>
                              )}
                              {p && p.percent > 0 && !isWatched && (
                                <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                                  Đang xem {Math.round(p.percent)}%
                                </span>
                              )}
                            </div>
                          </div>

                          <Play size={16} style={{ color: isCurrent ? 'var(--primary, #3b82f6)' : 'var(--text-muted, #a1a1aa)', flexShrink: 0 }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* HIỂN THỊ CÁC THẺ PLAYLIST CỦA KÊNH */
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: 14 }}>
                    Hệ thống tự động gom các video theo bộ phim, series và tập (Tập 1, 2, 3...):
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: 14,
                    }}
                  >
                    {playlists.map((pl) => {
                      const watchedCount = pl.videos.filter(({ video }) => watchedSet.has(video.video_id)).length
                      const watchedPct = pl.videos.length > 0 ? Math.round((watchedCount / pl.videos.length) * 100) : 0

                      return (
                        <div
                          key={pl.id}
                          onClick={() => setSelectedPlaylist(pl)}
                          style={{
                            background: 'var(--card-bg, #1f1f23)',
                            border: '1px solid var(--card-border, #27272a)',
                            borderRadius: 14,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            transition: 'transform 0.18s, border-color 0.18s',
                          }}
                        >
                          {/* Bìa Playlist với hiệu ứng layer xếp chồng */}
                          <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000', overflow: 'hidden' }}>
                            {pl.thumbnail ? (
                              <img
                                src={pl.thumbnail}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f43f5e, #be123c)' }}>
                                <ListVideo size={36} color="#fff" />
                              </div>
                            )}

                            {/* Badge số tập bên phải */}
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '38%',
                                background: 'rgba(0, 0, 0, 0.75)',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                gap: 4,
                              }}
                            >
                              <Layers size={20} />
                              <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{pl.videos.length}</span>
                              <span style={{ fontSize: '0.66rem', opacity: 0.8 }}>video / tập</span>
                            </div>
                          </div>

                          {/* Thông tin Playlist */}
                          <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main, #fff)', margin: '0 0 6px', lineHeight: 1.3 }}>
                                {pl.title}
                              </h4>
                            </div>

                            {/* Tiến độ đã xem các tập */}
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4, color: 'var(--text-muted, #a1a1aa)' }}>
                                <span>Đã xem {watchedCount}/{pl.videos.length} tập</span>
                                <span style={{ fontWeight: 800, color: watchedPct >= 100 ? '#10b981' : '#f43f5e' }}>{watchedPct}%</span>
                              </div>
                              <div style={{ width: '100%', height: 4, background: 'var(--border, #27272a)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${watchedPct}%`, height: '100%', background: watchedPct >= 100 ? '#10b981' : 'linear-gradient(90deg, #f43f5e, #be123c)', borderRadius: 2 }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
