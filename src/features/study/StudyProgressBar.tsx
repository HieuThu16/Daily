import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { reviewStreak } from '../../lib/srs'
import type { DeckId } from './deck'

type DeckStats = { total: number; due: number; fresh: number; mature: number }

/**
 * Thanh tiến độ ôn tập: hôm nay đã ôn bao nhiêu thẻ, còn bao nhiêu tới hạn,
 * chuỗi ngày học liên tiếp và số thẻ đã thuộc lâu.
 * Nhật ký lấy từ bảng `study_reviews`; bảng chưa có thì phần chuỗi tự ẩn.
 */
export function StudyProgressBar({ deck, stats }: { deck: DeckId; stats: DeckStats }) {
  const today = localDate()
  const [logDates, setLogDates] = useState<string[] | null>(null)
  const [reviewedToday, setReviewedToday] = useState(0)

  useEffect(() => {
    void (async () => {
      if (!supabase) return
      // 400 ngày là đủ cho chuỗi dài nhất mà vẫn không kéo cả lịch sử về máy.
      const from = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('study_reviews')
        .select('log_date,card_id')
        .eq('deck', deck)
        .gte('log_date', from)
      if (error || !data) return
      setLogDates(data.map((row) => row.log_date as string))
      setReviewedToday(new Set(data.filter((r) => r.log_date === today).map((r) => r.card_id as string)).size)
    })()
  }, [deck, today])

  const streak = logDates ? reviewStreak(logDates, today) : null

  const cells: Array<{ label: string; value: string; color: string }> = [
    { label: 'Ôn hôm nay', value: `${reviewedToday} thẻ`, color: 'var(--emerald)' },
    { label: 'Còn tới hạn', value: `${stats.due}`, color: stats.due ? 'var(--amber)' : 'var(--text-muted)' },
    ...(streak === null ? [] : [{ label: 'Chuỗi ngày', value: `🔥 ${streak}`, color: 'var(--rose)' }]),
    { label: 'Đã thuộc', value: `${stats.mature}/${stats.total}`, color: 'var(--primary)' },
  ]

  return (
    <div
      className="card"
      style={{ padding: 8, margin: '0 0 10px', display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: 6 }}
    >
      {cells.map((cell) => (
        <div key={cell.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: cell.color }}>{cell.value}</div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{cell.label}</div>
        </div>
      ))}
    </div>
  )
}
