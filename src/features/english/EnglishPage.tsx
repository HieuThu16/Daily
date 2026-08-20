import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Volume2,
  CheckCircle2,
  Circle,
  Edit3,
  Shuffle,
  Search,
  BookOpen,
  GraduationCap,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Image as ImageIcon,
  Palette,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { speakEnglish } from '../../lib/tts'
import { useHeaderAction } from '../HeaderAction'
import { useToast } from '../ToastContext'
import type { EnglishItem, EnglishKind } from '../../types'
import { ReviewSession } from '../study/ReviewSession'
import { useDeck } from '../study/useDeck'
import { StudyProgressBar } from '../study/StudyProgressBar'

export const KIND_LABEL: Record<EnglishKind, string> = { WORD: 'Từ', SENTENCE: 'Câu' }

export interface MinimalTheme {
  id: string
  name: string
  accent: string
}

export const MINIMAL_THEMES: MinimalTheme[] = [
  { id: 'blue', name: 'Xanh dương', accent: '#3b82f6' },
  { id: 'emerald', name: 'Xanh ngọc', accent: '#10b981' },
  { id: 'amber', name: 'Vàng hổ phách', accent: '#f59e0b' },
  { id: 'rose', name: 'Hồng cam', accent: '#f43f5e' },
  { id: 'purple', name: 'Tím nhạt', accent: '#8b5cf6' },
  { id: 'cyan', name: 'Xanh cyan', accent: '#06b6d4' },
  { id: 'slate', name: 'Xám thanh lịch', accent: '#64748b' },
]

export function getCardAccent(item: { id?: string; term?: string; color?: string | null }): string {
  if (item.color) {
    const found = MINIMAL_THEMES.find((p) => p.id === item.color)
    if (found) return found.accent
    if (item.color.startsWith('#')) return item.color
  }
  const key = item.id || item.term || 'eng'
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % MINIMAL_THEMES.length
  return MINIMAL_THEMES[index].accent
}

const EMPTY_FORM = {
  id: '',
  kind: 'WORD' as EnglishKind,
  term: '',
  meaning: '',
  example: '',
  tags: '',
  color: '',
  cover_url: '',
  is_learned: false,
}

export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))]
}

type LearnedFilter = 'ALL' | 'LEARNING' | 'LEARNED'

export function EnglishPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<EnglishItem[]>([])
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState<EnglishKind | 'ALL'>('ALL')
  const [learnedFilter, setLearnedFilter] = useState<LearnedFilter>('ALL')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})

  // Form states (Thêm & Sửa)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Phiên ôn tập: hàng đợi do thuật toán lặp lại ngắt quãng quyết định, không còn xáo ngẫu nhiên.
  const [practiceOpen, setPracticeOpen] = useState(false)
  const { queue: reviewQueue, stats: srsStats, grade: gradeCard, reload: reloadDeck } = useDeck('english')

  useHeaderAction('Thêm thẻ tiếng Anh', () => {
    setForm(EMPTY_FORM)
    setIsEditing(false)
    setIsFormOpen(true)
  })

  useEffect(() => {
    void (async () => {
      try {
        const res = await supabase
          ?.from('english_items')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        setItems((res?.data ?? []) as EnglishItem[])
      } catch (e) {
        console.error('Error fetching english items:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const allTags = useMemo(
    () => [...new Set(items.flatMap((i) => i.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (kindFilter !== 'ALL' && i.kind !== kindFilter) return false
      if (learnedFilter === 'LEARNED' && !i.is_learned) return false
      if (learnedFilter === 'LEARNING' && i.is_learned) return false
      if (tagFilter && !(i.tags ?? []).includes(tagFilter)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTerm = i.term.toLowerCase().includes(q)
        const matchMeaning = i.meaning?.toLowerCase().includes(q)
        const matchExample = i.example?.toLowerCase().includes(q)
        const matchTag = (i.tags ?? []).some((t) => t.toLowerCase().includes(q))
        if (!matchTerm && !matchMeaning && !matchExample && !matchTag) return false
      }
      return true
    })
  }, [items, kindFilter, learnedFilter, tagFilter, searchQuery])

  // Statistics
  const totalCount = items.length
  const learnedCount = useMemo(() => items.filter((i) => i.is_learned).length, [items])
  const learningCount = totalCount - learnedCount
  const progressPercent = totalCount > 0 ? Math.round((learnedCount / totalCount) * 100) : 0

  // Quick toggle learned status
  const toggleLearned = async (item: EnglishItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextStatus = !item.is_learned

    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, is_learned: nextStatus } : it)),
    )

    showToast(
      nextStatus ? `Đã thuộc: "${item.term}"` : `Chuyển về đang học: "${item.term}"`,
      nextStatus ? 'success' : 'info',
    )

    if (supabase) {
      try {
        await supabase
          .from('english_items')
          .update({ is_learned: nextStatus })
          .eq('id', item.id)
      } catch (err) {
        console.warn('Could not sync is_learned:', err)
      }
    }
  }

  // Shuffle visible cards
  const shuffleCards = () => {
    setItems((prev) => [...prev].sort(() => Math.random() - 0.5))
    showToast('Đã đảo ngẫu nhiên thứ tự thẻ', 'info')
  }

  // Save new or edited card
  const handleSaveForm = async () => {
    const term = form.term.trim()
    if (!term) {
      showToast('Vui lòng nhập từ hoặc câu', 'info')
      return
    }
    if (!supabase) return

    const itemPayload = {
      kind: form.kind,
      term,
      meaning: form.meaning.trim(),
      example: form.example.trim() || null,
      tags: parseTags(form.tags),
      color: form.color || null,
      cover_url: form.cover_url.trim() || null,
      is_learned: form.is_learned,
    }

    if (isEditing && form.id) {
      const { data, error } = await supabase
        .from('english_items')
        .update(itemPayload)
        .eq('id', form.id)
        .select()
        .single()

      if (error) {
        const basicPayload = {
          kind: form.kind,
          term,
          meaning: form.meaning.trim(),
          example: form.example.trim() || null,
          tags: parseTags(form.tags),
        }
        await supabase.from('english_items').update(basicPayload).eq('id', form.id)
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === form.id ? ({ ...it, ...itemPayload, ...(data as EnglishItem) } as EnglishItem) : it,
        ),
      )
      showToast('Đã cập nhật thẻ', 'success')
    } else {
      let newItem: EnglishItem | null = null
      const { data, error } = await supabase
        .from('english_items')
        .insert(itemPayload)
        .select()
        .single()

      if (error) {
        const basicPayload = {
          kind: form.kind,
          term,
          meaning: form.meaning.trim(),
          example: form.example.trim() || null,
          tags: parseTags(form.tags),
        }
        const retryRes = await supabase.from('english_items').insert(basicPayload).select().single()
        if (retryRes.data) {
          newItem = { ...(retryRes.data as EnglishItem), ...itemPayload }
        }
      } else {
        newItem = data as EnglishItem
      }

      if (newItem) {
        setItems((prev) => [newItem!, ...prev])
        showToast('Đã thêm thẻ mới', 'success')
      }
    }

    setForm(EMPTY_FORM)
    setIsFormOpen(false)
    setIsEditing(false)
  }

  // Open edit modal
  const handleOpenEdit = (item: EnglishItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setForm({
      id: item.id,
      kind: item.kind,
      term: item.term,
      meaning: item.meaning,
      example: item.example || '',
      tags: (item.tags || []).join(', '),
      color: item.color || '',
      cover_url: item.cover_url || '',
      is_learned: !!item.is_learned,
    })
    setIsEditing(true)
    setIsFormOpen(true)
  }

  // Remove card
  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    showToast(`Đã xoá "${target?.term || ''}"`, 'delete')
    await supabase?.from('english_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  const startPractice = useCallback(() => {
    if (reviewQueue.length === 0) {
      showToast('Hôm nay không còn thẻ nào tới hạn ôn. Quay lại vào mai nhé!', 'info')
      return
    }
    setPracticeOpen(true)
  }, [reviewQueue.length, showToast])

  return (
    <section className="eng-page">
      <StudyProgressBar deck="english" stats={srsStats} />
      {/* Compact Minimal Header & Stats */}
      <div className="card eng-compact-header">
        <div className="eng-compact-stats-row">
          <div className="eng-compact-title">
            <GraduationCap size={18} className="eng-compact-cap-icon" />
            <span className="eng-compact-heading">Tiếng Anh</span>
            <span className="eng-compact-ratio">
              {learnedCount}/{totalCount} ({progressPercent}%)
            </span>
          </div>

          <div className="eng-compact-track">
            <div className="eng-compact-bar" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="eng-compact-actions">
            <button
              className="eng-mini-btn"
              onClick={startPractice}
              title={srsStats.due > 0 ? `${srsStats.due} thẻ tới hạn ôn hôm nay` : 'Hôm nay không còn thẻ tới hạn'}
            >
              <BookOpen size={14} />{' '}
              <span>Ôn hôm nay{srsStats.due > 0 ? ` (${srsStats.due})` : ''}</span>
            </button>
            <button
              className="eng-mini-btn"
              onClick={shuffleCards}
              title="Đảo thẻ ngẫu nhiên"
              disabled={visible.length < 2}
            >
              <Shuffle size={14} />
            </button>
            <button
              className="eng-mini-btn primary"
              onClick={() => {
                setForm(EMPTY_FORM)
                setIsEditing(false)
                setIsFormOpen(true)
              }}
              title="Thêm thẻ mới"
            >
              <Plus size={15} /> <span>Thêm</span>
            </button>
          </div>
        </div>

        {/* Compact Search & Filter Toolbar */}
        <div className="eng-compact-toolbar">
          <div className="eng-compact-search">
            <Search size={14} className="eng-compact-search-icon" />
            <input
              type="text"
              placeholder="Tìm từ, nghĩa, ví dụ, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Xoá">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="eng-compact-filters">
            {/* Status Filter */}
            {(['ALL', 'LEARNING', 'LEARNED'] as const).map((s) => (
              <button
                key={s}
                className={`eng-tag-filter ${learnedFilter === s ? 'is-active' : ''}`}
                onClick={() => setLearnedFilter(s)}
              >
                {s === 'ALL' && `Tất cả (${totalCount})`}
                {s === 'LEARNING' && `Đang học (${learningCount})`}
                {s === 'LEARNED' && `Đã thuộc (${learnedCount})`}
              </button>
            ))}

            {/* Kind Filter */}
            {(['ALL', 'WORD', 'SENTENCE'] as const).map((k) => (
              <button
                key={k}
                className={`eng-tag-filter ${kindFilter === k ? 'is-active' : ''}`}
                onClick={() => setKindFilter(k)}
              >
                {k === 'ALL' ? 'Tất cả loại' : KIND_LABEL[k]}
              </button>
            ))}

            {/* Tags */}
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`eng-tag-filter ${tagFilter === tag ? 'is-active' : ''}`}
                onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form Modal (Thêm / Sửa gọn gàng) */}
      {isFormOpen && (
        <div className="eng-modal-backdrop" onClick={() => setIsFormOpen(false)}>
          <div className="card eng-compact-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eng-form-header">
              <h3 className="eng-form-title">
                {isEditing ? 'Chỉnh sửa thẻ' : 'Thêm thẻ mới'}
              </h3>
              <button className="eng-icon-btn-close" onClick={() => setIsFormOpen(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>

            <div className="eng-form-body">
              {/* Kind selector */}
              <div className="eng-form-row-2">
                <div className="eng-form-field">
                  <label className="eng-form-label">Loại thẻ:</label>
                  <div className="eng-kind-toggle-row">
                    {(['WORD', 'SENTENCE'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`eng-kind-btn ${form.kind === k ? 'is-active' : ''}`}
                        onClick={() => setForm({ ...form, kind: k })}
                      >
                        {KIND_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="eng-form-field">
                  <label className="eng-form-label">
                    <Palette size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Màu điểm nhấn:
                  </label>
                  <div className="eng-color-dots-row">
                    <button
                      type="button"
                      className={`eng-color-dot is-auto ${!form.color ? 'is-selected' : ''}`}
                      onClick={() => setForm({ ...form, color: '' })}
                      title="Tự động"
                    >
                      <Sparkles size={11} />
                    </button>
                    {MINIMAL_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        className={`eng-color-dot ${form.color === theme.id ? 'is-selected' : ''}`}
                        style={{ backgroundColor: theme.accent }}
                        onClick={() => setForm({ ...form, color: theme.id })}
                        title={theme.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Term & Meaning */}
              <div className="eng-form-field">
                <label className="eng-form-label">Từ / Câu tiếng Anh (*):</label>
                <input
                  placeholder="Ví dụ: Resilient, Make a difference..."
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="eng-form-field">
                <label className="eng-form-label">Nghĩa tiếng Việt:</label>
                <input
                  placeholder="Ví dụ: Kiên cường, Tạo nên sự khác biệt..."
                  value={form.meaning}
                  onChange={(e) => setForm({ ...form, meaning: e.target.value })}
                />
              </div>

              {/* Example */}
              <div className="eng-form-field">
                <label className="eng-form-label">Ví dụ (Tuỳ chọn):</label>
                <input
                  placeholder="Ví dụ: She remains resilient in difficult times."
                  value={form.example}
                  onChange={(e) => setForm({ ...form, example: e.target.value })}
                />
              </div>

              {/* Tags & Cover URL */}
              <div className="eng-form-row-2">
                <div className="eng-form-field">
                  <label className="eng-form-label">Tags:</label>
                  <input
                    placeholder="ielts, daily, work..."
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
                <div className="eng-form-field">
                  <label className="eng-form-label">
                    <ImageIcon size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Ảnh cover (URL):
                  </label>
                  <input
                    placeholder="https://images.unsplash.com/..."
                    value={form.cover_url}
                    onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                  />
                </div>
              </div>

              {/* Learned Checkbox */}
              <label className="eng-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.is_learned}
                  onChange={(e) => setForm({ ...form, is_learned: e.target.checked })}
                />
                <span>Đánh dấu là <strong>Đã thuộc</strong></span>
              </label>
            </div>

            <div className="eng-form-footer">
              <button
                type="button"
                className="eng-form-btn-cancel"
                onClick={() => {
                  setIsFormOpen(false)
                  setForm(EMPTY_FORM)
                }}
              >
                Huỷ
              </button>
              <button type="button" className="primary eng-form-btn-save" onClick={handleSaveForm}>
                {isEditing ? 'Lưu thay đổi' : 'Tạo thẻ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phiên ôn tập theo lịch lặp lại ngắt quãng, dùng chung với tab Kiến thức. */}
      {practiceOpen && (
        <ReviewSession
          queue={reviewQueue}
          deckLabel="Tiếng Anh"
          onGrade={gradeCard}
          onClose={() => {
            setPracticeOpen(false)
            void reloadDeck()
          }}
        />
      )}


      {/* Main Rectangular 2-Column Grid */}
      {loading ? (
        <div className="eng-loading-state">
          <div className="eng-spinner" />
          <p className="muted">Đang tải...</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card eng-empty-minimal">
          <BookOpen size={30} className="eng-empty-icon" />
          <p className="eng-empty-text">
            {searchQuery || tagFilter || kindFilter !== 'ALL' || learnedFilter !== 'ALL'
              ? 'Không tìm thấy thẻ nào khớp với bộ lọc.'
              : 'Chưa có thẻ nào trong danh sách.'}
          </p>
          <button
            className="primary eng-mini-btn"
            onClick={() => {
              setForm(EMPTY_FORM)
              setIsEditing(false)
              setIsFormOpen(true)
            }}
          >
            <Plus size={14} /> Thêm thẻ
          </button>
        </div>
      ) : (
        <div className="eng-rect-2col-grid">
          {visible.map((item) => {
            const accent = getCardAccent(item)
            const isFlipped = !!flipped[item.id]

            return (
              <div
                key={item.id}
                className={`eng-rect-card ${item.is_learned ? 'is-card-learned' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setFlipped((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setFlipped((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                  }
                }}
              >
                <div className={`eng-rect-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
                  {/* FRONT SIDE */}
                  <div
                    className="eng-compact-card-side eng-front-side"
                    style={{ borderLeft: `4px solid ${accent}` }}
                  >
                    <div className="eng-card-header-line">
                      <div className="eng-card-header-left">
                        <span className="eng-badge-kind">{KIND_LABEL[item.kind]}</span>
                        {(item.tags ?? []).slice(0, 2).map((t) => (
                          <span key={t} className="eng-mini-tag">
                            #{t}
                          </span>
                        ))}
                      </div>

                      <div className="eng-card-actions-top">
                        <button
                          className="eng-icon-action-btn"
                          aria-label={`Đọc "${item.term}"`}
                          title="Phát âm"
                          onClick={(e) => {
                            e.stopPropagation()
                            speakEnglish(item.term)
                          }}
                        >
                          <Volume2 size={15} />
                        </button>
                        <button
                          className={`eng-icon-action-btn ${item.is_learned ? 'is-learned' : ''}`}
                          aria-label={item.is_learned ? 'Đã thuộc' : 'Đang học'}
                          title={item.is_learned ? 'Đã thuộc (Click để đổi)' : 'Chưa thuộc (Click để đánh dấu)'}
                          onClick={(e) => void toggleLearned(item, e)}
                        >
                          {item.is_learned ? (
                            <CheckCircle2 size={16} className="eng-check-icon" />
                          ) : (
                            <Circle size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="eng-rect-term-wrap">
                      {item.cover_url && (
                        <img src={item.cover_url} alt="" className="eng-mini-cover-thumb" loading="lazy" />
                      )}
                      <p className="eng-rect-term-title">{item.term}</p>
                    </div>

                    <div className="eng-rect-bottom-line">
                      <span className="eng-hint-flip">Lật xem nghĩa</span>
                    </div>
                  </div>

                  {/* BACK SIDE */}
                  <div
                    className="eng-compact-card-side eng-back-side"
                    style={{ borderLeft: `4px solid ${accent}` }}
                  >
                    <div className="eng-card-header-line">
                      <span className="eng-badge-kind">Nghĩa</span>

                      <div className="eng-card-actions-top">
                        <button
                          className="eng-icon-action-btn"
                          aria-label="Sửa thẻ"
                          title="Sửa thẻ"
                          onClick={(e) => handleOpenEdit(item, e)}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="eng-icon-action-btn is-delete"
                          aria-label="Xoá thẻ"
                          title="Xoá thẻ"
                          onClick={(e) => void remove(item.id, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          className={`eng-icon-action-btn ${item.is_learned ? 'is-learned' : ''}`}
                          title={item.is_learned ? 'Đã thuộc' : 'Đang học'}
                          onClick={(e) => void toggleLearned(item, e)}
                        >
                          {item.is_learned ? (
                            <CheckCircle2 size={16} className="eng-check-icon" />
                          ) : (
                            <Circle size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="eng-rect-meaning-wrap">
                      <p className="eng-rect-meaning-title">{item.meaning || '—'}</p>
                      {item.example && (
                        <div
                          className="eng-rect-example-btn"
                          title="Nghe ví dụ"
                          onClick={(e) => {
                            e.stopPropagation()
                            speakEnglish(item.example!)
                          }}
                        >
                          <Volume2 size={12} />
                          <span>{item.example}</span>
                        </div>
                      )}
                    </div>

                    <div className="eng-rect-bottom-line">
                      <span className="eng-hint-flip">Lật lại từ</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
