import { useEffect, useRef, useState } from 'react'
import { Download, HardDrive, Loader2, PictureInPicture2, Play, Trash2, Upload } from 'lucide-react'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import {
  bindMediaSession,
  deleteOfflineVideo,
  enterPictureInPicture,
  formatBytes,
  keepStoragePersistent,
  offlineVideoSupported,
  offlineVideoUrl,
  saveOfflineVideo,
  storageEstimate,
  useOfflineVideos,
  type OfflineVideo,
} from '../../lib/offlineVideo'

/** Trình phát video đã tải: file cùng nguồn nên bật được khung nổi thật. */
function OfflinePlayer({ video, onClose }: { video: OfflineVideo; onClose: () => void }) {
  const [src, setSrc] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let url = ''
    let alive = true
    void offlineVideoUrl(video).then((u) => {
      if (!alive) {
        URL.revokeObjectURL(u)
        return
      }
      url = u
      setSrc(u)
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [video])

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay
        playsInline
        onPlay={() => videoRef.current && bindMediaSession(videoRef.current, video)}
        style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: '52vh' }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="tv-btn" onClick={onClose}>Đóng</button>
        <button
          className="tv-btn primary"
          onClick={() => videoRef.current && void enterPictureInPicture(videoRef.current)}
          title="Thu nhỏ thành cửa sổ nổi, dùng app khác vẫn xem được"
        >
          <PictureInPicture2 size={14} /> Thu nhỏ ra ngoài app
        </button>
      </div>
    </div>
  )
}

/** Kho video MP4 nằm trong máy: thêm từ máy hoặc từ link trực tiếp, rồi xem. */
export function OfflineVideoModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast()
  const { videos } = useOfflineVideos()
  const [busy, setBusy] = useState('')
  const [percent, setPercent] = useState(0)
  const [linkUrl, setLinkUrl] = useState('')
  const [playing, setPlaying] = useState<OfflineVideo | null>(null)
  const [space, setSpace] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void storageEstimate().then(setSpace)
  }, [videos])

  const supported = offlineVideoSupported()

  const addFile = async (file: File) => {
    setBusy(file.name)
    setPercent(0)
    try {
      await keepStoragePersistent()
      await saveOfflineVideo(file, { title: file.name.replace(/\.[^.]+$/, ''), fileName: file.name }, setPercent)
      showToast('Đã lưu video vào máy', 'success')
    } catch (err: any) {
      showToast(`Không lưu được: ${err?.message ?? err}`, 'error')
    } finally {
      setBusy('')
      setPercent(0)
    }
  }

  /** Tải từ một link .mp4 trực tiếp — chỉ chạy nếu máy chủ đó cho phép tải chéo. */
  const addFromLink = async () => {
    const url = linkUrl.trim()
    if (!url) return
    setBusy(url)
    setPercent(0)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      await keepStoragePersistent()
      const name = url.split('/').pop()?.split('?')[0] || 'video.mp4'
      await saveOfflineVideo(blob, { title: name.replace(/\.[^.]+$/, ''), fileName: name }, setPercent)
      setLinkUrl('')
      showToast('Đã tải xong vào máy', 'success')
    } catch (err: any) {
      showToast(`Không tải được (máy chủ chặn tải chéo?): ${err?.message ?? err}`, 'error')
    } finally {
      setBusy('')
      setPercent(0)
    }
  }

  const totalSize = videos.reduce((sum, v) => sum + v.sizeBytes, 0)

  return (
    <Modal title="📥 Video trong máy" onClose={onClose}>
      {playing ? (
        <OfflinePlayer video={playing} onClose={() => setPlaying(null)} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {!supported && (
            <div className="tv-hint tv-bad">
              Trình duyệt này không cho lưu video vào máy. Dùng Chrome/Edge, hoặc cài app vào màn hình chính.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="tv-btn primary" onClick={() => fileRef.current?.click()} disabled={!supported || !!busy}>
              <Upload size={14} /> Thêm file MP4 từ máy
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void addFile(file)
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Hoặc dán link .mp4 trực tiếp…"
              style={{ flex: 1 }}
            />
            <button className="tv-btn" onClick={() => void addFromLink()} disabled={!supported || !linkUrl.trim() || !!busy}>
              <Download size={14} /> Tải
            </button>
          </div>

          {busy && (
            <div className="tv-hint">
              <Loader2 size={13} className="tv-spin" /> Đang lưu {busy} — {percent}%
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ width: `${percent}%`, height: '100%', background: 'var(--primary)' }} />
              </div>
            </div>
          )}

          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <HardDrive size={13} />
            {videos.length} video · {formatBytes(totalSize)} đã dùng
            {space.quota > 0 && ` · còn trống khoảng ${formatBytes(Math.max(0, space.quota - space.usage))}`}
          </div>

          {videos.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              Chưa có video nào. Thêm file vào rồi bấm phát — lúc đó mới thu nhỏ ra ngoài app được.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, maxHeight: '46vh', overflowY: 'auto' }}>
              {videos.map((video) => (
                <li
                  key={video.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: '1px solid var(--card-border)',
                    borderRadius: 10,
                    background: 'var(--card-bg)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {video.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {[video.channelName, formatBytes(video.sizeBytes)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button className="tv-btn" onClick={() => setPlaying(video)} title="Phát">
                    <Play size={13} />
                  </button>
                  <button
                    className="tv-btn"
                    style={{ color: 'var(--rose)' }}
                    onClick={() => void deleteOfflineVideo(video.id)}
                    title="Xoá khỏi máy"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
