import { useEffect, useRef, useState } from 'react'
import { ListMusic, Play, SkipBack, SkipForward, X } from 'lucide-react'
import type { Media } from '../../types'

/**
 * Nghe liên tục nhiều bài mà KHÔNG lưu playlist: hàng đợi chỉ sống trong state
 * của phiên làm việc, đóng thanh phát là mất. Không có bảng nào trong Supabase
 * cho việc này và cũng không cần — đúng yêu cầu "như playlist nhưng không lưu".
 */

export const creatorOf = (item: Media) => (item.type === 'MUSIC' ? item.artist : item.channel) || ''

type QueuePickerProps = {
  items: Media[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onToggleAll: () => void
  onPlay: () => void
}

/** Danh sách các bài có MP3, mỗi bài một ô tích, kèm nút nghe cả loạt. */
export function AudioQueuePicker({ items, selectedIds, onToggle, onToggleAll, onPlay }: QueuePickerProps) {
  const selected = new Set(selectedIds)
  const allPicked = items.length > 0 && selected.size === items.length

  if (items.length === 0) {
    return (
      <p className="queue-empty">
        Chưa có bài nào gắn MP3. Bấm nút tải lên ở một bài trong danh sách để thêm file nhạc.
      </p>
    )
  }

  return (
    <div className="queue-picker">
      <div className="queue-toolbar">
        <button type="button" className="queue-select-all" onClick={onToggleAll}>
          {allPicked ? 'Bỏ chọn hết' : `Chọn hết (${items.length})`}
        </button>
        <button type="button" className="primary queue-play" disabled={selected.size === 0} onClick={onPlay}>
          <Play size={15} fill="currentColor" />
          Nghe {selected.size > 0 ? `${selected.size} bài` : ''}
        </button>
      </div>

      <div className="queue-list">
        {items.map((item, index) => {
          const isPicked = selected.has(item.id)
          const creator = creatorOf(item)
          return (
            <label key={item.id} className={'queue-row' + (isPicked ? ' is-picked' : '')}>
              <input type="checkbox" checked={isPicked} onChange={() => onToggle(item.id)} />
              <span className="queue-row-index">{index + 1}</span>
              <span className="queue-row-copy">
                <strong>{item.name}</strong>
                {creator && <small>{creator}</small>}
              </span>
              {item.music_genre && <span className="queue-row-genre">{item.music_genre}</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}

type PlayerProps = {
  queue: Media[]
  onClose: () => void
}

/**
 * Thanh phát dính đáy màn hình. Hết một bài thì tự nhảy bài kế; hết bài cuối
 * thì dừng lại ở đó chứ không tự đóng, để còn bấm lùi nghe lại.
 */
export function AudioQueuePlayer({ queue, onClose }: PlayerProps) {
  const [index, setIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const current = queue[index]

  // Đổi bài thì phát ngay, khỏi phải bấm play lần nữa. Trình duyệt có thể chặn
  // autoplay ở bài ĐẦU nếu chưa có tương tác — nhưng ở đây người dùng vừa bấm
  // "Nghe" nên quyền phát đã được cấp.
  useEffect(() => {
    audioRef.current?.play().catch(() => {})
  }, [index])

  // Hàng đợi đổi (chọn lại bài khác) thì quay về bài đầu.
  useEffect(() => {
    setIndex(0)
  }, [queue])

  if (!current) return null

  const goTo = (next: number) => {
    if (next >= 0 && next < queue.length) setIndex(next)
  }

  const creator = creatorOf(current)

  return (
    <div className="queue-player" role="region" aria-label="Đang nghe liên tục">
      <div className="queue-player-head">
        <span className="queue-player-badge">
          <ListMusic size={13} /> {index + 1}/{queue.length}
        </span>
        <span className="queue-player-title" title={current.name}>
          {current.name}
          {creator && <small> · {creator}</small>}
        </span>
        <button type="button" className="icon small" aria-label="Đóng thanh nghe" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="queue-player-controls">
        <button type="button" className="icon small" aria-label="Bài trước" disabled={index === 0} onClick={() => goTo(index - 1)}>
          <SkipBack size={16} />
        </button>
        <audio
          ref={audioRef}
          key={current.id}
          controls
          src={current.audio_url || undefined}
          preload="metadata"
          onEnded={() => goTo(index + 1)}
        />
        <button
          type="button"
          className="icon small"
          aria-label="Bài kế"
          disabled={index === queue.length - 1}
          onClick={() => goTo(index + 1)}
        >
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  )
}
