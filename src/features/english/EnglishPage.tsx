import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Volume2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { speakEnglish } from '../../lib/tts'
import { useHeaderAction } from '../HeaderAction'
import { useToast } from '../ToastContext'
import type { EnglishItem, EnglishKind } from '../../types'

const KIND_LABEL: Record<EnglishKind, string> = { WORD: 'Từ', SENTENCE: 'Câu' }

const EMPTY_FORM = { kind: 'WORD' as EnglishKind, term: '', meaning: '', example: '', tags: '' }

/** Tách "daily, verb" → ['daily', 'verb']; bỏ trùng và khoảng trắng thừa. */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))]
}

/** Tab tiếng Anh: thẻ lật (flip card) học từ và câu, có nút đọc thành tiếng và lọc theo tag. */
export function EnglishPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<EnglishItem[]>([])
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState<EnglishKind | 'ALL'>('ALL')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  useHeaderAction('Thêm thẻ tiếng Anh', () => setAdding(true))

  useEffect(() => {
    void (async () => {
      const res = await supabase
        ?.from('english_items')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      setItems((res?.data ?? []) as EnglishItem[])
      setLoading(false)
    })()
  }, [])

  const allTags = useMemo(
    () => [...new Set(items.flatMap((i) => i.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const visible = items.filter(
    (i) => (kindFilter === 'ALL' || i.kind === kindFilter) && (!tagFilter || (i.tags ?? []).includes(tagFilter)),
  )

  const save = async () => {
    const term = form.term.trim()
    if (!term || !supabase) return
    const { data, error } = await supabase
      .from('english_items')
      .insert({
        kind: form.kind,
        term,
        meaning: form.meaning.trim(),
        example: form.example.trim() || null,
        tags: parseTags(form.tags),
      })
      .select()
      .single()
    if (error) {
      showToast('❌ Chưa lưu được thẻ — kiểm tra kết nối.', 'delete')
      return
    }
    setItems((prev) => [data as EnglishItem, ...prev])
    setForm(EMPTY_FORM)
    setAdding(false)
  }

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('english_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  return (
    <section className="eng-page">
      <div className="eng-filters">
        {(['ALL', 'WORD', 'SENTENCE'] as const).map((k) => (
          <button key={k} className={`eng-chip ${kindFilter === k ? 'is-on' : ''}`} onClick={() => setKindFilter(k)}>
            {k === 'ALL' ? 'Tất cả' : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="eng-filters">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`eng-chip ${tagFilter === tag ? 'is-on' : ''}`}
              onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <div className="card eng-form">
          <div className="eng-filters">
            {(['WORD', 'SENTENCE'] as const).map((k) => (
              <button key={k} className={`eng-chip ${form.kind === k ? 'is-on' : ''}`} onClick={() => setForm({ ...form, kind: k })}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <input placeholder="Từ / câu tiếng Anh" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
          <input placeholder="Nghĩa tiếng Việt" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
          <input placeholder="Ví dụ" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
          <input placeholder="Tag, cách nhau bởi dấu phẩy" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
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
          <p className="muted">Chưa có thẻ nào. Thêm từ hoặc câu đầu tiên nhé.</p>
          <button className="primary" onClick={() => setAdding(true)}><Plus size={16} /> Thêm thẻ</button>
        </div>
      ) : (
        <div className="eng-grid">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flip-card"
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
              <div className={`flip-card-inner ${flipped[item.id] ? 'is-flipped' : ''}`}>
                <div className="flip-card-front">
                  <span className="flip-card-kind">{KIND_LABEL[item.kind]}</span>
                  <p className="flip-card-title">{item.term}</p>
                  <button
                    className="flip-card-btn"
                    aria-label={`Đọc "${item.term}"`}
                    onClick={(e) => { e.stopPropagation(); speakEnglish(item.term) }}
                  >
                    <Volume2 size={18} />
                  </button>
                  <div className="flip-card-tags">{(item.tags ?? []).map((t) => <span key={t}>#{t}</span>)}</div>
                </div>
                <div className="flip-card-back">
                  <p className="flip-card-title">{item.meaning || '—'}</p>
                  {item.example && (
                    <button
                      className="flip-card-example"
                      aria-label={`Đọc ví dụ "${item.example}"`}
                      onClick={(e) => { e.stopPropagation(); speakEnglish(item.example!) }}
                    >
                      <Volume2 size={13} /> {item.example}
                    </button>
                  )}
                  <button
                    className="flip-card-btn"
                    aria-label={`Xoá thẻ "${item.term}"`}
                    onClick={(e) => { e.stopPropagation(); void remove(item.id) }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
