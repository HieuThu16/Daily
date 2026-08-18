import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Flame, Sparkles, Volume2, X } from 'lucide-react'
import { speakEnglish } from '../../lib/tts'
import { intervalLabel, type Grade } from '../../lib/srs'
import type { StudyCard } from './deck'

const GRADES: { id: Grade; label: string; hint: string; className: string; key: string }[] = [
  { id: 'AGAIN', label: 'Quên', hint: 'Gặp lại ngay', className: 'again', key: '1' },
  { id: 'HARD', label: 'Khó', hint: 'Nhớ chật vật', className: 'hard', key: '2' },
  { id: 'GOOD', label: 'Được', hint: 'Nhớ ra được', className: 'good', key: '3' },
  { id: 'EASY', label: 'Dễ', hint: 'Nhớ ngay', className: 'easy', key: '4' },
]

type Props = {
  queue: StudyCard[]
  deckLabel: string
  onGrade: (card: StudyCard, grade: Grade) => void | Promise<void>
  onClose: () => void
}

/**
 * Phiên ôn tập: lật thẻ rồi tự chấm một trong bốn mức. Mỗi nút ghi rõ bao giờ gặp lại,
 * nên người học biết mình đang xếp lịch cho chính mình chứ không bấm mò.
 * Thẻ bấm "Quên" được đẩy về cuối hàng đợi để gặp lại ngay trong phiên.
 */
export function ReviewSession({ queue, deckLabel, onGrade, onClose }: Props) {
  const [remaining, setRemaining] = useState<StudyCard[]>(queue)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const [again, setAgain] = useState(0)

  const total = queue.length
  const card = remaining[0] ?? null

  const handleGrade = useCallback(
    (grade: Grade) => {
      if (!card) return
      void onGrade(card, grade)
      setFlipped(false)
      if (grade === 'AGAIN') {
        setAgain((n) => n + 1)
        // Còn nợ trong phiên: đẩy xuống cuối để gặp lại trước khi đóng.
        setRemaining((prev) => [...prev.slice(1), { ...prev[0] }])
      } else {
        setDone((n) => n + 1)
        setRemaining((prev) => prev.slice(1))
      }
    },
    [card, onGrade],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
        return
      }
      if (!flipped) return
      const match = GRADES.find((g) => g.key === e.key)
      if (match) {
        e.preventDefault()
        handleGrade(match.id)
      }
    }
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', onKey)
    }
  }, [flipped, handleGrade, onClose])

  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return createPortal(
    <div className="rs-backdrop" role="dialog" aria-modal="true" aria-label={`Ôn tập ${deckLabel}`}>
      <div className="rs-topbar">
        <div className="rs-progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
          <span className="rs-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="rs-counts">
          <span className="rs-count-done"><Check size={13} />{done}/{total}</span>
          {again > 0 && <span className="rs-count-again"><Flame size={13} />{again} cần ôn lại</span>}
        </div>
        <button type="button" className="rs-close" onClick={onClose} aria-label="Đóng phiên ôn">
          <X size={20} />
        </button>
      </div>

      {!card ? (
        <div className="rs-finish">
          <div className="rs-finish-icon"><Sparkles size={34} /></div>
          <h2>Xong phiên hôm nay</h2>
          <p>Đã ôn {done} thẻ {deckLabel.toLowerCase()}{again > 0 ? `, trong đó ${again} lượt phải nhắc lại` : ''}.</p>
          <button type="button" className="rs-finish-btn" onClick={onClose}>Quay lại danh sách</button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={`rs-card ${flipped ? 'is-flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? 'Ẩn đáp án' : 'Hiện đáp án'}
          >
            {card.group && <span className="rs-card-group">{card.group}</span>}
            <span className="rs-card-front">{card.front}</span>

            {flipped ? (
              <>
                <span className="rs-card-divider" aria-hidden="true" />
                <span className="rs-card-back">{card.back}</span>
                {card.extra && <span className="rs-card-extra">{card.extra}</span>}
              </>
            ) : (
              <span className="rs-card-hint">Bấm hoặc nhấn Space để xem đáp án</span>
            )}
          </button>

          {card.speakable && (
            <button
              type="button"
              className="rs-speak"
              onClick={() => speakEnglish(card.front)}
              aria-label={`Đọc "${card.front}"`}
            >
              <Volume2 size={16} /> Nghe phát âm
            </button>
          )}

          {flipped && (
            <div className="rs-grades">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`rs-grade rs-grade-${g.className}`}
                  onClick={() => handleGrade(g.id)}
                  title={`${g.hint} — phím ${g.key}`}
                >
                  <span className="rs-grade-label">{g.label}</span>
                  <span className="rs-grade-when">{intervalLabel(card, g.id)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
