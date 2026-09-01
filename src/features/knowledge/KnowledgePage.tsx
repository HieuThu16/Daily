import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain,
  Check,
  ChevronDown,
  FilePlus2,
  Plus,
  Search,
  Settings2,
  Tags,
  Trash2,
  BookOpen,
  ChevronRight,
  X,
  Youtube,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHeaderAction } from '../HeaderAction'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import type { KnowledgeItem } from '../../types'
import { answerLines, categoryStats, DEFAULT_CATEGORY, filterKnowledge, lessonRows, normalizeCategory } from './knowledge'
import type { LessonEntry } from './knowledge'
import { ReviewSession } from '../study/ReviewSession'
import { useDeck } from '../study/useDeck'
import { StudyProgressBar } from '../study/StudyProgressBar'
import { useVideoProgressMap } from '../../lib/videoProgress'
import { youtubeVideoId } from '../../lib/youtubeMeta'

const EMPTY_FORM = { question: '', answer: '', category: '', source_video_id: null as string | null }

/** Bảng chưa được tạo trên Supabase — cần chạy migration 20260913000000_knowledge_items.sql. */
const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

export function getCategoryAccent(cat: string): string {
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#ec4899', '#6366f1']
  let hash = 0
  for (let i = 0; i < cat.length; i++) {
    hash = (hash << 5) - hash + cat.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

/** Component chọn video YouTube từ lịch sử gần đây hoặc dán link */
function YoutubeVideoPicker({
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

/** Tab Kiến thức: sơ đồ tư duy thể loại → câu hỏi → các câu trả lời, lọc theo thể loại và tìm kiếm. */
export function KnowledgePage() {
  const navigate = useNavigate()
  const { showToast, showUndoToast } = useToast()
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [lesson, setLesson] = useState<{ category: string; sourceVideoId?: string | null; entries: LessonEntry[] } | null>(null) // != null: đang soạn bài học tay
  const [lessonBusy, setLessonBusy] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Cùng cỗ máy ôn tập với tab Tiếng Anh, chỉ khác bảng dữ liệu.
  const { queue: reviewQueue, stats: srsStats, grade: gradeCard, reload: reloadDeck } = useDeck('knowledge')

  useHeaderAction('Thêm thẻ kiến thức', () => setAdding(true))

  useEffect(() => {
    void (async () => {
      const res = await supabase
        ?.from('knowledge_items')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (res?.error && MISSING_TABLE_CODES.includes(res.error.code ?? '')) setNeedsMigration(true)
      setItems((res?.data ?? []) as KnowledgeItem[])
      setLoading(false)
    })()
  }, [])

  /** Combobox đóng khi bấm ra ngoài hoặc nhấn Esc. */
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPickerOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  const stats = useMemo(() => categoryStats(items), [items])
  const categories = useMemo(() => stats.map((s) => s.name), [stats])

  /** Đổi tên thể loại cho mọi thẻ đang mang tên cũ. Trùng tên đã có thì thành gộp nhóm. */
  const renameCategory = async (from: string) => {
    const answer = window.prompt(`Đổi tên thể loại "${from}" thành:`, from)
    if (answer === null) return
    const to = normalizeCategory(answer)
    if (to === from) return
    const { error } = await supabase!
      .from('knowledge_items')
      .update({ category: to })
      .eq('category', from)
      .is('deleted_at', null)
    if (error) {
      showToast('❌ Chưa đổi được tên thể loại — kiểm tra kết nối.', 'delete')
      return
    }
    setItems((prev) => prev.map((i) => (i.category === from ? { ...i, category: to } : i)))
    setCategory((prev) => (prev === from ? to : prev))
  }

  /** Xoá thể loại: chuyển hết thẻ của nó về "Chung", không xoá thẻ nào. */
  const removeCategory = async (name: string, count: number) => {
    if (name === DEFAULT_CATEGORY) return
    const movedIds = items.filter((i) => i.category === name).map((i) => i.id)
    const { error } = await supabase!
      .from('knowledge_items')
      .update({ category: DEFAULT_CATEGORY })
      .eq('category', name)
      .is('deleted_at', null)
    if (error) {
      showToast('❌ Chưa xoá được thể loại — kiểm tra kết nối.', 'delete')
      return
    }
    setItems((prev) => prev.map((i) => (i.category === name ? { ...i, category: DEFAULT_CATEGORY } : i)))
    setCategory((prev) => (prev === name ? null : prev))
    showUndoToast(`Đã chuyển ${count} thẻ của "${name}" về "${DEFAULT_CATEGORY}"`, async () => {
      await supabase!.from('knowledge_items').update({ category: name }).in('id', movedIds)
      setItems((prev) => prev.map((i) => (movedIds.includes(i.id) ? { ...i, category: name } : i)))
    })
  }

  const visible = useMemo(() => filterKnowledge(items, category, search), [items, category, search])

  const save = async () => {
    const question = form.question.trim()
    if (!question || !supabase) return
    const { data, error } = await supabase
      .from('knowledge_items')
      .insert({
        question,
        answer: form.answer.trim(),
        category: normalizeCategory(form.category),
        source_video_id: form.source_video_id ? form.source_video_id.trim() : null,
      })
      .select()
      .single()
    if (error) {
      showToast('❌ Chưa lưu được thẻ — kiểm tra kết nối.', 'delete')
      return
    }
    setItems((prev) => [data as KnowledgeItem, ...prev])
    setForm(EMPTY_FORM)
    setAdding(false)
    showToast('Đã thêm thẻ kiến thức mới', 'success')
  }

  /** Lưu cả bài học tự soạn: mỗi dòng thành một thẻ. Không gọi AI. */
  const saveLesson = async () => {
    if (!lesson || !supabase) return
    const rows = lessonRows(lesson.entries, lesson.category, lesson.sourceVideoId)
    if (!rows.length) return
    setLessonBusy(true)
    const { data, error } = await supabase.from('knowledge_items').insert(rows).select()
    setLessonBusy(false)
    if (error) {
      showToast('❌ Chưa lưu được bài học — kiểm tra kết nối.', 'delete')
      return
    }
    setItems((prev) => [...(data as KnowledgeItem[]), ...prev])
    setLesson(null)
    showToast(`Đã thêm ${rows.length} thẻ vào bài học`, 'success')
  }

  const remove = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const removed = items.find((i) => i.id === id)
    if (!removed) return
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('knowledge_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    showUndoToast('Đã xoá thẻ kiến thức', async () => {
      await supabase?.from('knowledge_items').update({ deleted_at: null }).eq('id', id)
      setItems((prev) => [removed, ...prev])
    })
  }

  const toggleNode = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))

  const closeForm = () => {
    setAdding(false)
    setForm(EMPTY_FORM)
  }

  /** Nhánh sơ đồ: mỗi thể loại là một nhánh, mỗi thẻ là một nút con. */
  const branches = useMemo(() => {
    const map = new Map<string, KnowledgeItem[]>()
    for (const i of visible) map.set(i.category, [...(map.get(i.category) ?? []), i])
    return [...map.entries()]
      .map(([name, list]) => ({ name, list }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [visible])

  const selectedCount = category === null ? items.length : (stats.find((s) => s.name === category)?.count ?? 0)

  return (
    <section className="kn-page">
      {needsMigration && (
        <div className="card kn-notice">
          <strong>Chưa tạo bảng kiến thức trên đám mây</strong>
          <p className="muted">
            Bảng <code>knowledge_items</code> chưa có trên Supabase. Chạy{' '}
            <code>supabase/migrations/20260913000000_knowledge_items.sql</code> rồi tải lại trang.
          </p>
        </div>
      )}

      {/* Compact Minimal Header / Toolbar */}
      <div className="card kn-toolbar">
        <div className="kn-search">
          <Search size={16} className="muted" />
          <input
            placeholder="Tìm câu hỏi, câu trả lời, thể loại…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="eng-icon-action-btn" aria-label="Xoá tìm kiếm" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="kn-toolbar-actions">
          <div className="kn-picker" ref={pickerRef}>
            <button
              className={`kn-picker-btn ${category !== null ? 'is-on' : ''}`}
              onClick={() => setPickerOpen((p) => !p)}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
            >
              <Tags size={14} />
              <span className="kn-picker-label">
                {category ?? 'Tất cả thể loại'} ({selectedCount})
              </span>
              <ChevronDown size={14} className="kn-picker-chevron" />
            </button>

            {pickerOpen && (
              <div className="kn-picker-menu" role="listbox">
                <button
                  className={`kn-picker-item ${category === null ? 'is-on' : ''}`}
                  role="option"
                  aria-selected={category === null}
                  onClick={() => {
                    setCategory(null)
                    setPickerOpen(false)
                  }}
                >
                  <span className="kn-picker-name">Tất cả thể loại</span>
                  <span className="kn-picker-count">{items.length}</span>
                  {category === null && <Check size={14} />}
                </button>
                <div className="kn-picker-divider" />
                {stats.map((s) => (
                  <button
                    key={s.name}
                    className={`kn-picker-item ${category === s.name ? 'is-on' : ''}`}
                    role="option"
                    aria-selected={category === s.name}
                    onClick={() => {
                      setCategory(s.name)
                      setPickerOpen(false)
                    }}
                  >
                    <span className="kn-picker-name">{s.name}</span>
                    <span className="kn-picker-count">{s.count}</span>
                    {category === s.name && <Check size={14} />}
                  </button>
                ))}
                <div className="kn-picker-divider" />
                <button
                  className="kn-picker-manage"
                  onClick={() => {
                    setPickerOpen(false)
                    setManaging(true)
                  }}
                >
                  <Settings2 size={14} /> Quản lý thể loại
                </button>
              </div>
            )}
          </div>

          <button className="kn-picker-btn" onClick={() => setLesson({ category: category ?? '', entries: [{ question: '', answers: [''] }] })} title="Tự soạn bài học bằng tay">
            <FilePlus2 size={14} />
            <span className="kn-picker-label">Soạn bài học</span>
          </button>

          <button
            className="eng-mini-btn"
            onClick={() => {
              if (reviewQueue.length === 0) {
                showToast('Hôm nay không còn thẻ nào tới hạn ôn. Quay lại vào mai nhé!', 'info')
                return
              }
              setReviewing(true)
            }}
            title={srsStats.due > 0 ? `${srsStats.due} thẻ tới hạn ôn hôm nay` : 'Hôm nay không còn thẻ tới hạn'}
          >
            <Brain size={14} />{' '}
            <span>Ôn hôm nay{srsStats.due > 0 ? ` (${srsStats.due})` : ''}</span>
          </button>

          <button className="primary eng-mini-btn" onClick={() => setAdding(true)}>
            <Plus size={14} /> <span>Thêm</span>
          </button>
        </div>
      </div>

      <StudyProgressBar deck="knowledge" stats={srsStats} />

      {reviewing && (
        <ReviewSession
          queue={reviewQueue}
          deckLabel="Kiến thức"
          onGrade={gradeCard}
          onClose={() => {
            setReviewing(false)
            void reloadDeck()
          }}
        />
      )}

      {managing && (
        <Modal title="Quản lý thể loại" onClose={() => setManaging(false)}>
          <p className="muted kn-manage-hint">
            Đổi tên trùng với thể loại đã có thì hai nhóm gộp làm một. Xoá thì thẻ chuyển về “{DEFAULT_CATEGORY}”.
          </p>
          <div className="kn-manage">
            {stats.length === 0 && <p className="muted">Chưa có thể loại nào.</p>}
            {stats.map((s) => (
              <div key={s.name} className="kn-manage-row">
                <span className="kn-cat">{s.name}</span>
                <span className="muted kn-manage-count">{s.count} thẻ</span>
                <button className="kn-manage-btn" onClick={() => void renameCategory(s.name)}>
                  Đổi tên
                </button>
                <button
                  className="kn-manage-btn is-danger"
                  onClick={() => void removeCategory(s.name, s.count)}
                  disabled={s.name === DEFAULT_CATEGORY}
                  title={s.name === DEFAULT_CATEGORY ? 'Không xoá được thể loại mặc định' : undefined}
                >
                  Xoá
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {lesson && (
        <Modal title="Tự soạn bài học" onClose={() => setLesson(null)}>
          <label>
            Tên bài học (thể loại)
            <input
              autoFocus
              list="kn-categories"
              placeholder={`Mặc định "${DEFAULT_CATEGORY}"`}
              value={lesson.category}
              onChange={(e) => setLesson({ ...lesson, category: e.target.value })}
            />
          </label>

          {/* Chọn hoặc dán link YouTube nguồn cho bài học */}
          <YoutubeVideoPicker
            selectedVideoId={lesson.sourceVideoId}
            onSelectVideo={(id) => setLesson({ ...lesson, sourceVideoId: id })}
          />

          <div className="kn-lesson-list" style={{ marginTop: 12 }}>
            {lesson.entries.map((entry, qi) => (
              <div key={qi} className="kn-lesson-q">
                <div className="kn-lesson-q-head">
                  <input
                    placeholder={`Ý chính / Câu hỏi ${qi + 1}`}
                    value={entry.question}
                    onChange={(e) => setLesson({ ...lesson, entries: lesson.entries.map((x, i) => (i === qi ? { ...x, question: e.target.value } : x)) })}
                  />
                  {lesson.entries.length > 1 && (
                    <button
                      className="kn-manage-btn is-danger"
                      aria-label={`Xoá câu hỏi ${qi + 1}`}
                      onClick={() => setLesson({ ...lesson, entries: lesson.entries.filter((_, i) => i !== qi) })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {entry.answers.map((ans, ai) => (
                  <div key={ai} className="kn-lesson-a">
                    <input
                      placeholder={`Chi tiết / Câu trả lời ${ai + 1}`}
                      value={ans}
                      onChange={(e) =>
                        setLesson({
                          ...lesson,
                          entries: lesson.entries.map((x, i) =>
                            i === qi ? { ...x, answers: x.answers.map((y, j) => (j === ai ? e.target.value : y)) } : x,
                          ),
                        })
                      }
                    />
                    {entry.answers.length > 1 && (
                      <button
                        className="kn-manage-btn is-danger"
                        aria-label={`Xoá câu trả lời ${ai + 1}`}
                        onClick={() =>
                          setLesson({
                            ...lesson,
                            entries: lesson.entries.map((x, i) => (i === qi ? { ...x, answers: x.answers.filter((_, j) => j !== ai) } : x)),
                          })
                        }
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="kn-manage-btn"
                  onClick={() =>
                    setLesson({ ...lesson, entries: lesson.entries.map((x, i) => (i === qi ? { ...x, answers: [...x.answers, ''] } : x)) })
                  }
                >
                  <Plus size={14} /> Thêm chi tiết
                </button>
              </div>
            ))}
          </div>
          <button
            className="kn-manage-btn"
            style={{ marginTop: 8 }}
            onClick={() => setLesson({ ...lesson, entries: [...lesson.entries, { question: '', answers: [''] }] })}
          >
            <Plus size={14} /> Thêm ý chính
          </button>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '6px 0 0' }}>
            {lessonRows(lesson.entries, lesson.category, lesson.sourceVideoId).length} thẻ sẽ được tạo.
          </p>
          <div className="modal-actions">
            <button onClick={() => setLesson(null)}>Huỷ</button>
            <button className="primary" onClick={saveLesson} disabled={lessonBusy || !lessonRows(lesson.entries, lesson.category, lesson.sourceVideoId).length}>
              {lessonBusy ? 'Đang lưu…' : 'Lưu bài học'}
            </button>
          </div>
        </Modal>
      )}

      {adding && (
        <Modal title="Thêm thẻ kiến thức" onClose={closeForm}>
          <label>
            Câu hỏi
            <input
              autoFocus
              placeholder="Bạn muốn nhớ điều gì?"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
          </label>
          <label>
            Câu trả lời — mỗi dòng một ý
            <textarea
              placeholder="Mỗi dòng là một câu trả lời"
              rows={4}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
          </label>
          <label>
            Thể loại
            <input
              placeholder={`Mặc định "${DEFAULT_CATEGORY}"`}
              list="kn-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <datalist id="kn-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {/* Chọn hoặc dán link YouTube nguồn cho thẻ */}
          <YoutubeVideoPicker
            selectedVideoId={form.source_video_id}
            onSelectVideo={(id) => setForm({ ...form, source_video_id: id })}
          />

          <div className="modal-actions">
            <button onClick={closeForm}>Huỷ</button>
            <button className="primary" onClick={save} disabled={!form.question.trim()}>
              Lưu thẻ
            </button>
          </div>
        </Modal>
      )}

      {loading ? (
        <div className="eng-loading-state">
          <div className="eng-spinner" />
          <p className="muted">Đang tải…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card eng-empty-minimal">
          <BookOpen size={30} className="eng-empty-icon" />
          <p className="eng-empty-text">
            {items.length === 0 ? 'Chưa có thẻ kiến thức nào. Ghi lại điều đầu tiên nhé.' : 'Không có thẻ nào khớp bộ lọc.'}
          </p>
          <button className="primary eng-mini-btn" onClick={() => setAdding(true)}>
            <Plus size={14} /> Thêm thẻ
          </button>
        </div>
      ) : (
        /* Sơ đồ tư duy: thể loại → câu hỏi → các câu trả lời */
        <div className="kn-mindmap">
          {branches.map((b) => {
            const accent = getCategoryAccent(b.name)
            const branchOpen = open[`c:${b.name}`] !== false
            return (
              <div key={b.name} className="kn-branch" style={{ ['--kn-accent' as string]: accent }}>
                <button className="kn-node kn-node-root" onClick={() => toggleNode(`c:${b.name}`)} aria-expanded={branchOpen}>
                  <ChevronRight size={14} className={`kn-caret ${branchOpen ? 'is-open' : ''}`} />
                  <span className="kn-node-text">{b.name}</span>
                  <span className="kn-picker-count">{b.list.length}</span>
                </button>
                {branchOpen && (
                  <div className="kn-children">
                    {b.list.map((item) => {
                      const answers = answerLines(item.answer)
                      const itemOpen = !!open[item.id]
                      return (
                        <div key={item.id} className="kn-leaf">
                          <div className="kn-node-row">
                            <button className="kn-node kn-node-q" onClick={() => toggleNode(item.id)} aria-expanded={itemOpen}>
                              <ChevronRight size={14} className={`kn-caret ${itemOpen ? 'is-open' : ''}`} />
                              <span className="kn-node-text">{item.question}</span>
                              {answers.length > 1 && <span className="kn-picker-count">{answers.length}</span>}
                            </button>

                            {/* Badge mở video nguồn YouTube nếu có */}
                            {item.source_video_id && (
                              <button
                                type="button"
                                className="kn-video-source-badge"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/youtube/watch/${item.source_video_id}`)
                                }}
                                title="Xem video bài học nguồn trên YouTube"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(244, 63, 94, 0.1)',
                                  color: 'var(--rose, #f43f5e)',
                                  border: '1px solid rgba(244, 63, 94, 0.3)',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Youtube size={12} color="#f43f5e" />
                                <span>Video nguồn</span>
                              </button>
                            )}

                            <button
                              className="eng-icon-action-btn is-delete"
                              aria-label={`Xoá thẻ "${item.question}"`}
                              title="Xoá thẻ"
                              onClick={(e) => void remove(item.id, e)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {itemOpen && (
                            <div className="kn-children">
                              {answers.length === 0 && <p className="kn-node kn-node-a muted">—</p>}
                              {answers.map((a, i) => (
                                <p key={i} className="kn-node kn-node-a">
                                  {a}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
