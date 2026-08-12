import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Music2, Pencil, Play, Youtube } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Media } from '../../types'

export type LibraryCategory = {
  id: string
  label: string
  icon: LucideIcon
  color: string
  bg: string
}

type LibraryCategoryBarProps = {
  selectedType: string
  categories: readonly LibraryCategory[]
  onSelect: (id: string) => void
}

export function LibraryCategoryBar({ selectedType, categories, onSelect }: LibraryCategoryBarProps) {
  return (
    <div className="library-category-bar" role="group" aria-label="Thể loại thư viện">
      {categories.map((category) => {
        const Icon = category.icon
        const selected = selectedType === category.id
        return (
          <button
            key={category.id}
            type="button"
            className={`daily-icon-btn library-category-button${selected ? ' active' : ''}`}
            aria-label={category.label}
            aria-pressed={selected}
            title={category.label}
            onClick={() => onSelect(category.id)}
          >
            <span className="icon-box icon-box-sm" style={{ background: category.bg, color: category.color }}>
              <Icon size={14} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

type LibraryAudioActionProps = {
  item: Media
  onListen: (item: Media) => void
  onAddMp3: (item: Media) => void
}

export function LibraryAudioAction({ item, onListen, onAddMp3 }: LibraryAudioActionProps) {
  if (item.type !== 'MUSIC' && item.type !== 'YOUTUBE') return null

  if (!item.audio_url) {
    return (
      <button
        type="button"
        className="library-audio-action library-audio-action-add"
        aria-label={`Thêm MP3 cho ${item.name}`}
        onClick={() => onAddMp3(item)}
      >
        <Music2 size={12} />
        Thêm MP3
      </button>
    )
  }

  return (
    <button
      type="button"
      className="library-audio-action library-audio-action-listen"
      aria-label={`Nghe ${item.name}`}
      onClick={() => onListen(item)}
    >
      <Play size={12} fill="currentColor" />
      Nghe
    </button>
  )
}

type LibraryAudioDetailProps = {
  item: Media
  onBack: () => void
  onEdit: (item: Media) => void
}

const statusLabels: Record<Media['status'], string> = {
  PLANNED: 'Sẽ nghe',
  IN_PROGRESS: 'Đang nghe',
  COMPLETED: 'Đã nghe',
}

export function LibraryAudioDetail({ item, onBack, onEdit }: LibraryAudioDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [audioError, setAudioError] = useState(false)
  const creator = item.type === 'MUSIC' ? item.artist : item.channel

  useEffect(() => {
    headingRef.current?.focus()
  }, [item.id])

  return (
    <section className="library-audio-detail" aria-labelledby="library-audio-title">
      <button type="button" className="library-audio-back" aria-label="Quay lại thư viện" onClick={onBack}>
        <ArrowLeft size={17} />
        Quay lại
      </button>

      <div className="library-audio-detail-card">
        <div className="library-audio-cover" aria-hidden="true">
          <Music2 size={34} />
        </div>
        <div className="library-audio-heading">
          <span>{item.type === 'MUSIC' ? 'Bài nhạc' : 'YouTube Audio'}</span>
          <h2 id="library-audio-title" ref={headingRef} tabIndex={-1}>{item.name}</h2>
          <p>{creator || 'Chưa cập nhật nghệ sĩ / kênh'}</p>
        </div>

        <div className="library-audio-meta">
          {item.music_genre && <span>{item.music_genre}</span>}
          <span>{statusLabels[item.status]}</span>
          {item.log_date && <span>{item.log_date}{item.log_time ? ` • ${item.log_time}` : ''}</span>}
          {item.is_favorite && <span>Yêu thích</span>}
        </div>

        <div className="library-audio-player-panel">
          <audio
            key={item.audio_url}
            controls
            src={item.audio_url || undefined}
            preload="metadata"
            onError={() => setAudioError(true)}
          />
          {audioError && (
            <p role="alert">File audio hiện không phát được. Hãy mở YouTube hoặc cập nhật lại MP3.</p>
          )}
        </div>

        <div className="library-audio-detail-actions">
          {item.youtube_url && (
            <a href={item.youtube_url} target="_blank" rel="noreferrer" aria-label="Mở trên YouTube">
              <Youtube size={15} />
              Mở YouTube
            </a>
          )}
          <button type="button" onClick={() => onEdit(item)}>
            <Pencil size={14} />
            Chỉnh sửa
          </button>
        </div>
      </div>
    </section>
  )
}
