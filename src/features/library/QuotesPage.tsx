import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Highlighter, Plus, Quote, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { loadLocal, saveLocal } from '../../lib/persistence'
import type { BookHighlight, BookQuote } from '../../types'

type ViewTab = 'quotes' | 'highlights'

/** Trang xem trích dẫn và highlight của sách; có chuyển tab và nút thêm thủ công. */
export function QuotesPage() {
  const { mediaItemId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as ViewTab) === 'highlights' ? 'highlights' : 'quotes'
  const [tab, setTab] = useState<ViewTab>(initialTab)

  const allBooks = !mediaItemId
  const nav = useNavigate()
  const [quotes, setQuotes] = useState<BookQuote[]>([])
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [book, setBook] = useState<{ name: string; author: string | null }>({ name: '', author: null })
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    void (async () => {
      let qQuery = supabase?.from('book_quotes').select('*').is('deleted_at', null).order('created_at', { ascending: false })
      let hQuery = supabase?.from('book_highlights').select('*').is('deleted_at', null).order('created_at', { ascending: false })

      if (!allBooks) {
        if (qQuery) qQuery = qQuery.eq('media_item_id', mediaItemId)
        if (hQuery) hQuery = hQuery.eq('media_item_id', mediaItemId)
      }

      const [mediaRes, qRes, hRes] = await Promise.all([
        allBooks || !supabase ? Promise.resolve({ data: null }) : supabase.from('media_items').select('name, author').eq('id', mediaItemId).single(),
        qQuery ? qQuery : Promise.resolve({ data: null }),
        hQuery ? hQuery : Promise.resolve({ data: null }),
      ])

      if (!allBooks && mediaRes.data) {
        setBook({ name: (mediaRes.data as any)?.name ?? '', author: (mediaRes.data as any)?.author ?? null })
      }

      // Quotes
      if (qRes.data) {
        setQuotes(qRes.data as BookQuote[])
      }

      // Highlights: Supabase with localStorage fallback
      let hlItems = (hRes.data ?? []) as BookHighlight[]
      const localHl = loadLocal<BookHighlight[]>('book_highlights_local', [])
      if (localHl.length > 0) {
        const filteredLocal = allBooks ? localHl : localHl.filter((h) => h.media_item_id === mediaItemId)
        const existingIds = new Set(hlItems.map((h) => h.id))
        const uniqueLocal = filteredLocal.filter((h) => !existingIds.has(h.id))
        hlItems = [...hlItems, ...uniqueLocal].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      }
      setHighlights(hlItems)

      setLoading(false)
    })()
  }, [mediaItemId, allBooks])

  const switchTab = (nextTab: ViewTab) => {
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }

  const addQuoteOrHighlight = async () => {
    const contentText = text.trim()
    if (!contentText) return

    if (tab === 'quotes') {
      if (supabase) {
        const { data, error } = await supabase
          .from('book_quotes')
          .insert({ media_item_id: mediaItemId || null, book_name: book.name || 'Sách', author: book.author, quote: contentText })
          .select()
          .single()
        if (!error && data) {
          setQuotes((prev) => [data as BookQuote, ...prev])
        }
      }
    } else {
      const payload: BookHighlight = {
        id: crypto.randomUUID(),
        media_item_id: mediaItemId || null,
        book_name: book.name || 'Sách',
        author: book.author,
        highlight: contentText,
        created_at: new Date().toISOString(),
      }

      if (supabase) {
        const { data, error } = await supabase.from('book_highlights').insert(payload).select().single()
        if (!error && data) {
          setHighlights((prev) => [data as BookHighlight, ...prev])
        } else {
          setHighlights((prev) => [payload, ...prev])
          const local = loadLocal<BookHighlight[]>('book_highlights_local', [])
          saveLocal('book_highlights_local', [payload, ...local])
        }
      } else {
        setHighlights((prev) => [payload, ...prev])
        const local = loadLocal<BookHighlight[]>('book_highlights_local', [])
        saveLocal('book_highlights_local', [payload, ...local])
      }
    }

    setText('')
    setAdding(false)
  }

  const removeQuote = async (id: string) => {
    if (supabase) await supabase.from('book_quotes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setQuotes((prev) => prev.filter((q) => q.id !== id))
  }

  const removeHighlight = async (id: string) => {
    if (supabase) await supabase.from('book_highlights').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    const local = loadLocal<BookHighlight[]>('book_highlights_local', [])
    saveLocal('book_highlights_local', local.filter((h) => h.id !== id))
    setHighlights((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="book-reader" data-reader-theme="light">
      <div className="book-reader-bar">
        <button aria-label="Quay lại đọc sách" onClick={() => nav(-1)}>
          <ArrowLeft size={20} />
        </button>
        <span className="book-reader-title">
          {allBooks ? (tab === 'quotes' ? 'Trích dẫn toàn bộ sách' : 'Highlight toàn bộ sách') : `${tab === 'quotes' ? 'Trích dẫn' : 'Highlight'} · ${book.name}`}
        </span>
        {allBooks ? (
          <span style={{ width: 20 }} />
        ) : (
          <button aria-label={tab === 'quotes' ? 'Thêm trích dẫn' : 'Thêm highlight'} onClick={() => setAdding(true)}>
            <Plus size={20} />
          </button>
        )}
      </div>

      <div className="book-reader-content">
        <article className="book-reader-page" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <button
              type="button"
              className={tab === 'quotes' ? 'primary' : ''}
              onClick={() => switchTab('quotes')}
              style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Quote size={15} /> Trích dẫn ({quotes.length})
            </button>
            <button
              type="button"
              className={tab === 'highlights' ? 'primary' : ''}
              onClick={() => switchTab('highlights')}
              style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Highlighter size={15} /> Highlight ({highlights.length})
            </button>
          </div>

          {adding && (
            <div className="card" style={{ padding: 12, margin: 0, display: 'grid', gap: 8 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder={tab === 'quotes' ? 'Nhập trích dẫn…' : 'Nhập đoạn highlight…'}
                autoFocus
                style={{ width: '100%', borderRadius: 10, border: '1px solid var(--card-border)', padding: 10, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setAdding(false); setText('') }}>Huỷ</button>
                <button className="primary" onClick={addQuoteOrHighlight} disabled={!text.trim()}>
                  {tab === 'quotes' ? 'Lưu trích dẫn' : 'Lưu highlight'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p style={{ opacity: 0.6 }}>Đang tải…</p>
          ) : tab === 'quotes' ? (
            quotes.length === 0 ? (
              <div style={{ textAlign: 'center', opacity: 0.6, padding: '30px 0' }}>
                <Quote size={28} />
                <p>Chưa có trích dẫn nào. Bôi đen đoạn văn khi đọc rồi bấm “Lưu trích dẫn”.</p>
              </div>
            ) : (
              quotes.map((q) => {
                const canNavigate = Boolean(q.media_item_id)
                return (
                  <div
                    key={q.id}
                    className="card"
                    onClick={() => {
                      if (!q.media_item_id) return
                      const params = new URLSearchParams()
                      if (q.chapter_idx !== undefined && q.chapter_idx !== null) {
                        params.set('chapter', String(q.chapter_idx))
                      }
                      params.set('text', q.quote.slice(0, 80))
                      nav(`/read/${q.media_item_id}?${params.toString()}`)
                    }}
                    style={{
                      padding: 14,
                      margin: 0,
                      position: 'relative',
                      cursor: canNavigate ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    title={canNavigate ? 'Nhấn để mở và đi đến vị trí trong sách' : undefined}
                  >
                    <Quote size={16} style={{ opacity: 0.4 }} />
                    <p style={{ margin: '6px 0', fontStyle: 'italic', lineHeight: 1.6 }}>{q.quote}</p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>— {q.book_name}{q.author ? `, ${q.author}` : ''}</span>
                      {canNavigate && <span style={{ color: 'var(--primary)', fontSize: '0.7rem' }}>Đọc đoạn này ›</span>}
                    </div>
                    <button
                      className="icon small danger"
                      aria-label="Xoá trích dẫn"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeQuote(q.id)
                      }}
                      style={{ position: 'absolute', top: 8, right: 8 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })
            )
          ) : highlights.length === 0 ? (
            <div style={{ textAlign: 'center', opacity: 0.6, padding: '30px 0' }}>
              <Highlighter size={28} />
              <p>Chưa có highlight nào. Bôi đen chữ khi đọc rồi chọn “Tô sáng”.</p>
            </div>
          ) : (
            highlights.map((h) => {
              const canNavigate = Boolean(h.media_item_id)
              return (
                <div
                  key={h.id}
                  className="card"
                  onClick={() => {
                    if (!h.media_item_id) return
                    const params = new URLSearchParams()
                    if (h.chapter_idx !== undefined && h.chapter_idx !== null) {
                      params.set('chapter', String(h.chapter_idx))
                    }
                    params.set('hl', h.highlight.slice(0, 80))
                    nav(`/read/${h.media_item_id}?${params.toString()}`)
                  }}
                  style={{
                    padding: 14,
                    margin: 0,
                    position: 'relative',
                    borderLeft: '4px solid var(--amber)',
                    cursor: canNavigate ? 'pointer' : 'default',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  title={canNavigate ? 'Nhấn để mở và đi đến vị trí trong sách' : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Highlighter size={15} style={{ color: 'var(--amber)' }} />
                    {h.chapter_title && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{h.chapter_title}</span>}
                  </div>
                  <mark
                    style={{
                      background: 'var(--amber-bg)',
                      color: 'var(--text-main)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      display: 'inline-block',
                      fontSize: '0.9rem',
                      lineHeight: 1.6,
                      fontWeight: 500,
                    }}
                  >
                    {h.highlight}
                  </mark>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>— {h.book_name}{h.author ? `, ${h.author}` : ''}</span>
                    {canNavigate && <span style={{ color: 'var(--primary)', fontSize: '0.7rem' }}>Đọc đoạn này ›</span>}
                  </div>
                  <button
                    className="icon small danger"
                    aria-label="Xoá highlight"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeHighlight(h.id)
                    }}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })
          )}
        </article>
      </div>
    </div>
  )
}
