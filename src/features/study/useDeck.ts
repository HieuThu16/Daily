import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { loadLocal, saveLocal } from '../../lib/persistence'
import { buildQueue, deckStats, review, withSrsDefaults, type Grade, type SrsFields } from '../../lib/srs'
import { DECKS, englishToCard, knowledgeToCard, type DeckId, type StudyCard } from './deck'
import type { EnglishItem, KnowledgeItem } from '../../types'

type RawCard = Record<string, unknown> & Partial<SrsFields> & { id: string }

/** Cột SRS chưa có trên Supabase — migration 20260919000000_srs_flashcards.sql chưa chạy. */
const MISSING_COLUMN_CODES = ['42703', 'PGRST204']

function toCard(deck: DeckId, row: RawCard, today: string): StudyCard {
  const srs = withSrsDefaults(row, today)
  return deck === 'english'
    ? englishToCard(row as unknown as EnglishItem, srs)
    : knowledgeToCard(row as unknown as KnowledgeItem, srs)
}

/**
 * Nạp một bộ thẻ kèm trạng thái ôn tập, dựng hàng đợi hôm nay và ghi lại kết quả chấm.
 * Thẻ giữ trong localStorage nên mở app lúc mất mạng vẫn ôn được; kết quả đồng bộ khi có mạng.
 */
export function useDeck(deck: DeckId, goal?: number) {
  const today = localDate()
  const cacheKey = `daily_deck_${deck}`
  const [cards, setCards] = useState<StudyCard[]>(() => loadLocal<StudyCard[]>(cacheKey, []))
  const [loading, setLoading] = useState(() => loadLocal<StudyCard[]>(cacheKey, []).length === 0)
  const [needsMigration, setNeedsMigration] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from(DECKS[deck].table)
      .select('*')
      .is('deleted_at', null)
    if (error) {
      if (MISSING_COLUMN_CODES.includes(error.code ?? '')) setNeedsMigration(true)
      setLoading(false)
      return
    }
    const next = ((data ?? []) as RawCard[]).map((row) => toCard(deck, row, today))
    setCards(next)
    saveLocal(cacheKey, next)
    setLoading(false)
  }, [deck, today, cacheKey])

  useEffect(() => {
    void load()
  }, [load])

  const queue = useMemo(() => buildQueue(cards, today, goal), [cards, today, goal])
  const stats = useMemo(() => deckStats(cards, today), [cards, today])

  /**
   * Chấm một thẻ: cập nhật ngay trên máy rồi mới đẩy lên Supabase, để bấm liên tục
   * không phải chờ mạng. Ghi hỏng thì thẻ vẫn đúng ở máy và lần tải sau sẽ đồng bộ lại.
   */
  const grade = useCallback(
    async (card: StudyCard, value: Grade) => {
      const next = review(card, value, today)
      setCards((prev) => {
        const updated = prev.map((c) => (c.id === card.id ? { ...c, ...next } : c))
        saveLocal(cacheKey, updated)
        return updated
      })

      if (!supabase) return
      const payload = { ...next, last_reviewed_at: new Date().toISOString() }
      let { error } = await supabase.from(DECKS[deck].table).update(payload).eq('id', card.id)

      if (error && MISSING_COLUMN_CODES.includes(error.code ?? '')) {
        // Chưa chạy migration FSRS: bỏ hai cột mới, lịch ôn vẫn ghi được như cũ.
        const { stability: _s, difficulty: _d, ...legacy } = payload
        const retry = await supabase.from(DECKS[deck].table).update(legacy).eq('id', card.id)
        error = retry.error
        if (error && MISSING_COLUMN_CODES.includes(error.code ?? '')) {
          setNeedsMigration(true)
          return
        }
      }
      // Nhật ký ôn dùng để vẽ chuỗi ngày học; hỏng thì bỏ qua, không chặn việc học.
      await supabase.from('study_reviews').insert({ deck, card_id: card.id, grade: value, log_date: today })
    },
    [deck, today, cacheKey],
  )

  return { cards, queue, stats, loading, needsMigration, grade, reload: load, today }
}
