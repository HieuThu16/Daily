import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Search, Settings2, Tags, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHeaderAction } from '../HeaderAction'
import { Modal } from '../shared'
import type { KnowledgeItem } from '../../types'
import { categoryStats, DEFAULT_CATEGORY, filterKnowledge, normalizeCategory } from './knowledge'

const EMPTY_FORM = { question: '', answer: '', category: '' }

/** Bảng chưa được tạo trên Supabase — cần chạy migration 20260913000000_knowledge_items.sql. */
const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

/** Tab Kiến thức: danh sách câu hỏi — bấm để mở câu trả lời, lọc theo thể loại và tìm kiếm. */
export function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
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
      alert('Chưa đổi được tên thể loại — kiểm tra kết nối.')
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
      alert('Chưa xoá được thể loại — kiểm tra kết nối.')
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
      alert('Chưa lưu được thẻ — kiểm tra kết nối.')
      return
    }
    setItems((prev) => [data as KnowledgeItem, ...prev])
    setForm(EMPTY_FORM)
    setAdding(false)
  }

  const remove = async (id: string) => {
    if (!window.confirm('Xoá thẻ kiến thức này?')) return
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('knowledge_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  const toggle = (id: string) => setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }))

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

      <div className="kn-toolbar">
        <div className="kn-search">
          <Search size={16} />
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
            <Tags size={15} />
            <span className="kn-picker-label">{category ?? 'Tất cả thể loại'}</span>
            <ChevronDown size={15} className="kn-picker-chevron" />
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
              rows={5}
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
        <p className="muted">Đang tải…</p>
      ) : visible.length === 0 ? (
        <div className="card eng-empty">
          <p className="muted">
            {items.length === 0 ? 'Chưa có thẻ kiến thức nào. Ghi lại điều đầu tiên nhé.' : 'Không có thẻ nào khớp bộ lọc.'}
          </p>
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Thêm thẻ
          </button>
        </div>
      ) : (
        <div className="kn-list">
          {visible.map((item) => {
            const isOpen = !!openIds[item.id]
            return (
              <article key={item.id} className={`kn-card ${isOpen ? 'is-open' : ''}`}>
                <div className="kn-card-inner">
                  <button className="kn-head" onClick={() => toggle(item.id)} aria-expanded={isOpen}>
                    <span className="kn-cat">{item.category}</span>
                    <span className="kn-question">{item.question}</span>
                    <ChevronDown size={16} className="kn-chevron" />
                  </button>
                  {isOpen && (
                    <div className="kn-body">
                      <p className="kn-answer">{item.answer || '—'}</p>
                      <button
                        className="kn-del"
                        aria-label={`Xoá thẻ "${item.question}"`}
                        onClick={() => void remove(item.id)}
                      >
                        <Trash2 size={15} /> Xoá
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
