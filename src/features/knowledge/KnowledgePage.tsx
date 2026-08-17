import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHeaderAction } from '../HeaderAction'
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
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('knowledge_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  const toggle = (id: string) => setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <section className="eng-page">
      {needsMigration && (
        <div className="card kn-notice">
          Bảng <code>knowledge_items</code> chưa có trên Supabase. Chạy{' '}
          <code>supabase/migrations/20260913000000_knowledge_items.sql</code> rồi tải lại trang.
        </div>
      )}

      <div className="kn-search">
        <Search size={16} />
        <input
          placeholder="Tìm câu hỏi, câu trả lời…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Tìm trong thẻ kiến thức"
        />
      </div>

      {categories.length > 0 && (
        <div className="eng-filters">
          <button className={`eng-chip ${category === null ? 'is-on' : ''}`} onClick={() => setCategory(null)}>
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`eng-chip ${category === c ? 'is-on' : ''}`}
              onClick={() => setCategory((prev) => (prev === c ? null : c))}
            >
              {c}
            </button>
          ))}
          <button
            className={`eng-chip ${managing ? 'is-on' : ''}`}
            onClick={() => setManaging((prev) => !prev)}
            aria-expanded={managing}
          >
            <Settings2 size={13} /> Quản lý thể loại
          </button>
        </div>
      )}

      {managing && (
        <div className="card kn-manage">
          <p className="muted kn-manage-hint">
            Đổi tên trùng với thể loại đã có thì hai nhóm gộp làm một. Xoá thì thẻ chuyển về “{DEFAULT_CATEGORY}”.
          </p>
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
                title={s.name === DEFAULT_CATEGORY ? `Không xoá được thể loại mặc định` : undefined}
              >
                Xoá
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="card eng-form">
          <input
            placeholder="Câu hỏi"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />
          <textarea
            placeholder="Câu trả lời"
            rows={4}
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
          />
          <input
            placeholder={`Thể loại (mặc định "${DEFAULT_CATEGORY}")`}
            list="kn-categories"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <datalist id="kn-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="eng-filters">
            <button className="primary" onClick={save}>Lưu</button>
            <button onClick={() => { setAdding(false); setForm(EMPTY_FORM) }}>Huỷ</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : visible.length === 0 ? (
        <div className="card eng-empty">
          <p className="muted">
            {items.length === 0 ? 'Chưa có thẻ kiến thức nào. Ghi lại điều đầu tiên nhé.' : 'Không có thẻ nào khớp bộ lọc.'}
          </p>
          <button className="primary" onClick={() => setAdding(true)}><Plus size={16} /> Thêm thẻ</button>
        </div>
      ) : (
        <div className="kn-list">
          {visible.map((item) => {
            const isOpen = !!openIds[item.id]
            return (
              <article key={item.id} className={`card kn-card ${isOpen ? 'is-open' : ''}`}>
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
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
