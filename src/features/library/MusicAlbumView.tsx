import { useMemo, useState } from 'react'
import { ArrowLeft, Disc3, Heart, Mic2, Music2, Pause, Play, Radio, Search, Shuffle, Volume2, X } from 'lucide-react'
import type { Media } from '../../types'
import {
  groupSongsByArtist,
  groupSongsByGenre,
  type MusicAlbum,
} from '../../lib/musicNormalization'
import { useOptionalAudioPlayer } from './AudioPlayerContext'
import './MusicAlbumView.css'

export interface MusicAlbumViewProps {
  items: Media[]
  onSelectAudioItem?: (id: string) => void
  onToggleFavorite?: (id: string, isFavorite: boolean) => void
}

type AlbumMode = 'ARTIST' | 'GENRE'

const VINYL_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
]

function getGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 1000
  return VINYL_GRADIENTS[Math.abs(hash) % VINYL_GRADIENTS.length]
}

export function MusicAlbumView({ items, onSelectAudioItem, onToggleFavorite }: MusicAlbumViewProps) {
  const audioPlayer = useOptionalAudioPlayer()

  const [mode, setMode] = useState<AlbumMode>('ARTIST')
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Gom album: Chỉ những bài có MP3 mới được vào!
  const artistAlbums = useMemo(() => groupSongsByArtist(items), [items])
  const genreAlbums = useMemo(() => groupSongsByGenre(items), [items])

  const currentAlbums = mode === 'ARTIST' ? artistAlbums : genreAlbums

  // Lọc theo từ khoá tìm kiếm
  const filteredAlbums = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return currentAlbums
    return currentAlbums.filter(
      (album) =>
        album.name.toLowerCase().includes(q) ||
        album.tracks.some((t) => t.name.toLowerCase().includes(q) || (t.artist && t.artist.toLowerCase().includes(q)))
    )
  }, [currentAlbums, search])

  // Album đang được mở xem chi tiết
  const activeAlbum = useMemo(
    () => currentAlbums.find((a) => a.id === selectedAlbumId) ?? null,
    [currentAlbums, selectedAlbumId]
  )

  const handlePlayAlbum = (album: MusicAlbum, shuffle = false) => {
    if (!album.tracks.length) return
    let queue = [...album.tracks]
    if (shuffle) {
      queue = queue.sort(() => Math.random() - 0.5)
    }
    audioPlayer?.playTrack(queue[0], queue)
  }

  const handlePlayTrack = (track: Media, album: MusicAlbum) => {
    if (audioPlayer?.currentTrack?.id === track.id) {
      audioPlayer.togglePlay()
    } else {
      audioPlayer?.playTrack(track, album.tracks)
    }
  }

  // --- DETAIL VIEW: Khi chọn xem 1 Album cụ thể ---
  if (activeAlbum) {
    return (
      <div className="music-album-detail">
        {/* Thanh quay lại */}
        <div className="music-album-back-bar">
          <button
            type="button"
            className="music-album-back-btn"
            onClick={() => setSelectedAlbumId(null)}
          >
            <ArrowLeft size={15} /> <span>Tất cả Album</span>
          </button>
        </div>

        {/* Hero Banner Album */}
        <div className="music-album-banner">
          <div className="music-album-banner-art">
            {activeAlbum.coverUrl ? (
              <img src={activeAlbum.coverUrl} alt={activeAlbum.name} />
            ) : (
              <div
                className="music-album-vinyl-placeholder"
                style={{ background: getGradient(activeAlbum.name) }}
              >
                <div className="music-album-vinyl-center">
                  <Disc3 size={28} />
                </div>
              </div>
            )}
          </div>

          <div className="music-album-banner-info">
            <span className="music-album-banner-tag">
              {activeAlbum.type === 'ARTIST' ? (
                <>
                  <Mic2 size={12} /> Album Ca sĩ
                </>
              ) : (
                <>
                  <Radio size={12} /> Album Thể loại
                </>
              )}
            </span>

            <h2 className="music-album-banner-title">{activeAlbum.name}</h2>

            <div className="music-album-banner-meta">
              <span>{activeAlbum.tracks.length} bài hát MP3</span>
              <span>•</span>
              <span style={{ color: 'var(--emerald)' }}>Sẵn sàng phát</span>
            </div>

            <div className="music-album-banner-actions">
              <button
                type="button"
                className="music-album-btn-playall"
                onClick={() => handlePlayAlbum(activeAlbum, false)}
              >
                <Play size={16} fill="currentColor" /> <span>Phát toàn bộ</span>
              </button>
              <button
                type="button"
                className="music-album-btn-shuffle"
                onClick={() => handlePlayAlbum(activeAlbum, true)}
                title="Trộn bài ngẫu nhiên"
              >
                <Shuffle size={14} /> <span>Trộn bài</span>
              </button>
            </div>
          </div>
        </div>

        {/* Danh sách bài hát trong Album */}
        <div className="music-album-tracklist-card">
          <div className="music-album-tracklist-header">
            <span>DANH SÁCH BÀI HÁT ({activeAlbum.tracks.length})</span>
            <span style={{ fontSize: '0.74rem' }}>Chỉ gồm nhạc có file MP3</span>
          </div>

          {activeAlbum.tracks.map((track, idx) => {
            const isPlayingThis =
              audioPlayer?.currentTrack?.id === track.id && audioPlayer?.isPlaying
            const isCurrentThis = audioPlayer?.currentTrack?.id === track.id

            return (
              <div
                key={track.id}
                className={`music-album-track-row ${isCurrentThis ? 'is-active' : ''}`}
                onClick={() => handlePlayTrack(track, activeAlbum)}
              >
                <span className="music-album-track-num">
                  {isPlayingThis ? (
                    <Volume2 size={14} style={{ color: 'var(--primary)' }} />
                  ) : (
                    String(idx + 1).padStart(2, '0')
                  )}
                </span>

                <button
                  type="button"
                  className="music-album-track-playbtn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePlayTrack(track, activeAlbum)
                  }}
                  title={isPlayingThis ? 'Tạm dừng' : 'Phát bài này'}
                >
                  {isPlayingThis ? (
                    <Pause size={14} fill="currentColor" />
                  ) : (
                    <Play size={14} fill="currentColor" />
                  )}
                </button>

                <div className="music-album-track-info">
                  <span className="music-album-track-title">{track.name}</span>
                  <span className="music-album-track-artist">
                    {activeAlbum.type === 'GENRE'
                      ? track.artist || 'Chưa rõ ca sĩ'
                      : track.music_genre || track.genre || 'V-Pop'}
                  </span>
                </div>

                {track.music_genre && (
                  <span className="music-album-track-genre">{track.music_genre}</span>
                )}

                {onToggleFavorite && (
                  <button
                    type="button"
                    className={`music-album-track-favbtn ${track.is_favorite ? 'is-fav' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(track.id, !track.is_favorite)
                    }}
                    title={track.is_favorite ? 'Bỏ thích' : 'Yêu thích'}
                  >
                    <Heart size={15} fill={track.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                )}

                {onSelectAudioItem && (
                  <button
                    type="button"
                    className="music-album-track-playbtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectAudioItem(track.id)
                    }}
                    title="Xem chi tiết lời bài hát & thao tác"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Music2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // --- GRID VIEW: Danh sách các Album (Ca sĩ / Dòng nhạc) ---
  return (
    <div className="music-album-container">
      {/* Header điều khiển: Chuyển đổi giữa Ca sĩ vs Dòng nhạc & Tìm kiếm */}
      <div className="music-album-header">
        <div className="music-album-type-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ARTIST'}
            className={`music-album-toggle-btn ${mode === 'ARTIST' ? 'active' : ''}`}
            onClick={() => {
              setMode('ARTIST')
              setSelectedAlbumId(null)
            }}
          >
            <Mic2 size={14} /> <span>Theo Ca sĩ ({artistAlbums.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'GENRE'}
            className={`music-album-toggle-btn ${mode === 'GENRE' ? 'active' : ''}`}
            onClick={() => {
              setMode('GENRE')
              setSelectedAlbumId(null)
            }}
          >
            <Radio size={14} /> <span>Theo Dòng nhạc ({genreAlbums.length})</span>
          </button>
        </div>

        <div className="music-album-search-wrapper">
          <Search size={14} className="music-album-search-icon" />
          <input
            type="text"
            className="music-album-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              mode === 'ARTIST' ? 'Tìm ca sĩ hoặc bài hát…' : 'Tìm thể loại hoặc bài hát…'
            }
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="music-album-stats-badge">
          <Disc3 size={13} />
          <span>Chỉ bài có file MP3</span>
        </div>
      </div>

      {/* Grid danh sách Album */}
      {filteredAlbums.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--card-border)',
            color: 'var(--text-muted)',
          }}
        >
          <Disc3 size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Không tìm thấy album nào phù hợp</p>
          {search && (
            <button
              type="button"
              className="music-album-back-btn"
              onClick={() => setSearch('')}
            >
              Xoá tìm kiếm
            </button>
          )}
        </div>
      ) : (
        <div className="music-album-grid">
          {filteredAlbums.map((album) => (
            <div
              key={album.id}
              className="music-album-card"
              onClick={() => setSelectedAlbumId(album.id)}
            >
              <div className="music-album-art-wrap">
                {album.coverUrl ? (
                  <img
                    src={album.coverUrl}
                    alt={album.name}
                    className="music-album-art-img"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="music-album-vinyl-placeholder"
                    style={{ background: getGradient(album.name) }}
                  >
                    <div className="music-album-vinyl-center">
                      <Disc3 size={24} />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="music-album-play-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePlayAlbum(album, false)
                  }}
                  title={`Phát toàn bộ album ${album.name}`}
                >
                  <Play size={16} fill="currentColor" />
                </button>
              </div>

              <div className="music-album-meta">
                <h4 className="music-album-title" title={album.name}>
                  {album.name}
                </h4>
                <div className="music-album-sub">
                  <span className="music-album-count-badge">{album.tracks.length} bài MP3</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                    {mode === 'ARTIST' ? 'Ca sĩ' : 'Thể loại'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
