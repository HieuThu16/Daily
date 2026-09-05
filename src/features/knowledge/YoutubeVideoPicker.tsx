import { useMemo, useState } from 'react'
import { Youtube } from 'lucide-react'
import { useVideoProgressMap } from '../../lib/videoProgress'
import { youtubeVideoId } from '../../lib/youtubeMeta'

/** Component chọn video YouTube từ lịch sử gần đây hoặc dán link */
export function YoutubeVideoPicker({
  selectedVideoId,
  onSelectVideo,
}: {
  selectedVideoId: string | null | undefined
  onSelectVideo: (videoId: string | null) => void
}) {
  const [mode, setMode] = useState<'recent' | 'url'>('recent')
  const [customInput, setCustomInput] = useState('')
  const progressMap = useVideoProgressMap()

  const recentVideos = useMemo(() => {
    return Object.values(progressMap)
      .filter((p) => p && p.videoId)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 10)
  }, [progressMap])

  const selectedMeta = useMemo(() => {
    if (!selectedVideoId) return null
    return (
      progressMap[selectedVideoId] || {
        videoId: selectedVideoId,
        title: `YouTube Video (${selectedVideoId})`,
        thumbnail: `https://i.ytimg.com/vi/${selectedVideoId}/hqdefault.jpg`,
        channelName: undefined,
      }
    )
  }, [selectedVideoId, progressMap])

  const handleApplyUrl = () => {
    const parsedId = youtubeVideoId(customInput.trim())
    if (parsedId) {
      onSelectVideo(parsedId)
      setCustomInput('')
    }
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        background: 'var(--bg-main)',
        border: '1px solid var(--card-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
          <Youtube size={16} color="#f43f5e" />
          <span>Gắn video YouTube nguồn (tùy chọn)</span>
        </div>
        {selectedVideoId && (
          <button
            type="button"
            onClick={() => onSelectVideo(null)}
            style={{ fontSize: '0.72rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            Bỏ gắn video
          </button>
        )}
      </div>

      {selectedVideoId ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 8,
            borderRadius: 10,
            background: 'var(--card-bg)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            boxShadow: '0 2px 8px rgba(244, 63, 94, 0.08)',
          }}
        >
          <img
            src={selectedMeta?.thumbnail || `https://i.ytimg.com/vi/${selectedVideoId}/hqdefault.jpg`}
            alt=""
            style={{ width: 68, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {selectedMeta?.title || selectedVideoId}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {selectedMeta?.channelName || 'YouTube'} · ID: {selectedVideoId}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectVideo(null)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--card-border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            Đổi
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setMode('recent')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: 6,
                border: `1px solid ${mode === 'recent' ? 'var(--primary)' : 'var(--card-border)'}`,
                background: mode === 'recent' ? 'var(--primary)' : 'transparent',
                color: mode === 'recent' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ⏱️ Video vừa xem ({recentVideos.length})
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: 6,
                border: `1px solid ${mode === 'url' ? 'var(--primary)' : 'var(--card-border)'}`,
                background: mode === 'url' ? 'var(--primary)' : 'transparent',
                color: mode === 'url' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              🔗 Dán link YouTube
            </button>
          </div>

          {mode === 'recent' ? (
            recentVideos.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {recentVideos.map((v) => (
                  <div
                    key={v.videoId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectVideo(v.videoId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <img
                      src={v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`}
                      alt=""
                      style={{ width: 48, height: 28, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {v.title || v.videoId}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                        {v.channelName || 'YouTube'} {v.percent > 0 ? `· Đã xem ${v.percent}%` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                Chưa có video xem gần đây. Bạn có thể bấm sang &ldquo;Dán link YouTube&rdquo;.
              </div>
            )
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Dán link YouTube (youtu.be/... hoặc youtube.com/watch?v=...)"
                value={customInput}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomInput(val)
                  const parsed = youtubeVideoId(val.trim())
                  if (parsed) {
                    onSelectVideo(parsed)
                  }
                }}
                style={{
                  flex: 1,
                  fontSize: '0.76rem',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                }}
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                disabled={!youtubeVideoId(customInput.trim())}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: youtubeVideoId(customInput.trim()) ? 1 : 0.5,
                }}
              >
                Gắn
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
