import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Search, Settings2, Tags, Trash2, HelpCircle, BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHeaderAction } from '../HeaderAction'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import type { KnowledgeItem } from '../../types'
import { categoryStats, DEFAULT_CATEGORY, filterKnowledge, normalizeCategory } from './knowledge'

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

/** Tab Kiến thức: Thẻ hình chữ nhật dài dọc (2 cột), lật thẻ xem câu trả lời, lọc theo thể loại và tìm kiếm. */
export function KnowledgePage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

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
    if (!window.confirm(`Xoá thể loại "${name}"? ${count} thẻ sẽ chuyển về "${DEFAULT_CATEGORY}".`)) return
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

  const remove = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!window.confirm('Xoá thẻ kiến thức này?')) return
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('knowledge_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    showToast('Đã xoá thẻ kiến thức', 'delete')
  }

  const toggleFlip = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }))

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

          <button className="primary eng-mini-btn" onClick={() => setAdding(true)}>
            <Plus size={14} /> <span>Thêm</span>
          </button>
        </div>
      </div>

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
            Câu trả lời
            <textarea
              placeholder="Ghi lại lời giải thích"
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
        /* Tall Vertical Rectangular 2-Column Grid */
        <div className="eng-rect-2col-grid">
          {visible.map((item) => {
            const isFlipped = !!flipped[item.id]
            const accent = getCategoryAccent(item.category)

            return (
              <div
                key={item.id}
                className="eng-rect-card"
                role="button"
                tabIndex={0}
                onClick={() => toggleFlip(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleFlip(item.id)
                  }
                }}
              >
                <div className={`eng-rect-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
                  {/* FRONT SIDE - Question */}
                  <div
                    className="eng-compact-card-side eng-front-side"
                    style={{ borderLeft: `4px solid ${accent}` }}
                  >
                    <div className="eng-card-header-line">
                      <span className="kn-cat" style={{ background: `${accent}20`, color: accent }}>
                        {item.category}
                      </span>
                      <HelpCircle size={15} color={accent} style={{ opacity: 0.8 }} />
                    </div>

                    <div className="eng-rect-term-wrap">
                      <p className="eng-rect-term-title kn-card-q-text">{item.question}</p>
                    </div>

                    <div className="eng-rect-bottom-line">
                      <span className="eng-hint-flip">Lật xem câu trả lời</span>
                    </div>
                  </div>

                  {/* BACK SIDE - Answer */}
                  <div
                    className="eng-compact-card-side eng-back-side"
                    style={{ borderLeft: `4px solid ${accent}` }}
                  >
                    <div className="eng-card-header-line">
                      <span className="kn-cat" style={{ background: `${accent}20`, color: accent }}>
                        {item.category}
                      </span>
                      <button
                        className="eng-icon-action-btn is-delete"
                        aria-label={`Xoá thẻ "${item.question}"`}
                        title="Xoá thẻ"
                        onClick={(e) => void remove(item.id, e)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="eng-rect-meaning-wrap kn-card-a-wrap">
                      <p className="kn-card-a-text">{item.answer || '—'}</p>
                    </div>

                    <div className="eng-rect-bottom-line">
                      <span className="eng-hint-flip">Lật lại câu hỏi</span>
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
