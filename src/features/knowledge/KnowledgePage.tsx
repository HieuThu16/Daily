import { useEffect, useMemo, useRef, useState } from 'react'
import { Brain, Check, ChevronDown, FilePlus2, Plus, Search, Settings2, Tags, Trash2, BookOpen, ChevronRight, X } from 'lucide-react'
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

const EMPTY_FORM = { question: '', answer: '', category: '' }

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

/** Tab Kiến thức: sơ đồ tư duy thể loại → câu hỏi → các câu trả lời, lọc theo thể loại và tìm kiếm. */
export function KnowledgePage() {
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
  const [lesson, setLesson] = useState<{ category: string; entries: LessonEntry[] } | null>(null) // != null: đang soạn bài học tay
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
    const rows = lessonRows(lesson.entries, lesson.category)
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

  /** Nhánh sơ đồ: mỗi thể loại là một nhánh, mỗi thẻ là một nút con. */
  const branches = useMemo(() => {
    const map = new Map<string, KnowledgeItem[]>()
    for (const i of visible) map.set(i.category, [...(map.get(i.category) ?? []), i])
    return [...map.entries()]
      .map(([name, list]) => ({ name, list }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [visible])

  const closeForm = () => {
    setAdding(false)
    setForm(EMPTY_FORM)
  }

  const pick = (value: string | null) => {
    setCategory(value)
    setPickerOpen(false)
  }

  return (
    <section className="eng-page">
      {needsMigration && (
        <div className="card kn-notice">
          Bảng <code>knowledge_items</code> chưa có trên Supabase. Chạy{' '}
          <code>supabase/migrations/20260913000000_knowledge_items.sql</code> rồi tải lại trang.
        </div>
      )}

      {/* Compact Minimal Header / Toolbar */}
      <div className="card eng-compact-header">
        <div className="kn-toolbar">
          <div className="kn-search">
            <Search size={14} />
            <input
              placeholder="Tìm câu hỏi, câu trả lời…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm trong thẻ kiến thức"
            />
          </div>

          <div className="kn-picker" ref={pickerRef}>
            <button
              className={`kn-picker-btn ${category ? 'is-on' : ''}`}
              onClick={() => setPickerOpen((p) => !p)}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
            >
              <Tags size={14} />
              <span className="kn-picker-label">{category ?? 'Tất cả thể loại'}</span>
              <ChevronDown size={14} className="kn-picker-chevron" />
            </button>

            {pickerOpen && (
              <div className="kn-picker-menu" role="listbox">
                <button
                  className={`kn-picker-item ${category === null ? 'is-on' : ''}`}
                  role="option"
                  aria-selected={category === null}
                  onClick={() => pick(null)}
                >
                  <span className="kn-picker-name">Tất cả thể loại</span>
                  <span className="kn-picker-count">{items.length}</span>
                  {category === null && <Check size={14} />}
                </button>
                {stats.map((s) => (
                  <button
                    key={s.name}
                    className={`kn-picker-item ${category === s.name ? 'is-on' : ''}`}
                    role="option"
                    aria-selected={category === s.name}
                    onClick={() => pick(s.name)}
                  >
                    <span className="kn-picker-name">{s.name}</span>
                    <span className="kn-picker-count">{s.count}</span>
                    {category === s.name && <Check size={14} />}
                  </button>
                ))}
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
          <div className="kn-lesson-list">
            {lesson.entries.map((entry, qi) => (
              <div key={qi} className="kn-lesson-q">
                <div className="kn-lesson-q-head">
                  <input
                    placeholder={`Câu hỏi ${qi + 1}`}
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
                      placeholder={`Câu trả lời ${ai + 1}`}
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
                  <Plus size={14} /> Thêm câu trả lời
                </button>
              </div>
            ))}
          </div>
          <button
            className="kn-manage-btn"
            onClick={() => setLesson({ ...lesson, entries: [...lesson.entries, { question: '', answers: [''] }] })}
          >
            <Plus size={14} /> Thêm câu hỏi
          </button>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>
            {lessonRows(lesson.entries, lesson.category).length} thẻ sẽ được tạo.
          </p>
          <div className="modal-actions">
            <button onClick={() => setLesson(null)}>Huỷ</button>
            <button className="primary" onClick={saveLesson} disabled={lessonBusy || !lessonRows(lesson.entries, lesson.category).length}>
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
