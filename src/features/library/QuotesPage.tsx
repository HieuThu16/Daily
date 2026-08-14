import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Quote, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { BookQuote } from '../../types'

/** Trang xem trích dẫn của một cuốn sách; có nút back và nút thêm thủ công. */
export function QuotesPage() {
  const { mediaItemId = '' } = useParams()
  const allBooks = !mediaItemId
  const nav = useNavigate()
  const [quotes, setQuotes] = useState<BookQuote[]>([])
  const [book, setBook] = useState<{ name: string; author: string | null }>({ name: '', author: null })
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    void (async () => {
      let q = supabase.from('book_quotes').select('*').is('deleted_at', null).order('created_at', { ascending: false })
      if (!allBooks) q = q.eq('media_item_id', mediaItemId)
      const [mediaRes, { data: rows }] = await Promise.all([
        allBooks ? Promise.resolve({ data: null }) : supabase.from('media_items').select('name, author').eq('id', mediaItemId).single(),
        q,
      ])
      if (!allBooks) setBook({ name: (mediaRes.data as any)?.name ?? '', author: (mediaRes.data as any)?.author ?? null })
      setQuotes((rows ?? []) as BookQuote[])
      setLoading(false)
    })()
  }, [mediaItemId, allBooks])

  const addQuote = async () => {
    const quote = text.trim()
    if (!quote || !supabase) return
    const { data, error } = await supabase
      .from('book_quotes')
      .insert({ media_item_id: mediaItemId, book_name: book.name, author: book.author, quote })
      .select()
      .single()
    if (!error && data) {
      setQuotes((prev) => [data as BookQuote, ...prev])
      setText('')
      setAdding(false)
    }
  }

  const remove = async (id: string) => {
    await supabase!.from('book_quotes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setQuotes((prev) => prev.filter((q) => q.id !== id))
  }

  return (
    <div className="book-reader" data-reader-theme="light">
      <div className="book-reader-bar">
        <button aria-label="Quay lại đọc sách" onClick={() => nav(-1)}>
          <ArrowLeft size={20} />
        </button>
        <span className="book-reader-title">{allBooks ? 'Trích dẫn toàn bộ sách' : `Trích dẫn · ${book.name}`}</span>
        {allBooks ? <span style={{ width: 20 }} /> : (
          <button aria-label="Thêm trích dẫn" onClick={() => setAdding(true)}>
            <Plus size={20} />
          </button>
        )}
      </div>

      <div className="book-reader-content">
        <article className="book-reader-page" style={{ display: 'grid', gap: 12 }}>
          {adding && (
            <div className="card" style={{ padding: 12, margin: 0, display: 'grid', gap: 8 }}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Nhập trích dẫn…" autoFocus
                style={{ width: '100%', borderRadius: 10, border: '1px solid var(--card-border)', padding: 10, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setAdding(false); setText('') }}>Huỷ</button>
                <button className="primary" onClick={addQuote} disabled={!text.trim()}>Lưu trích dẫn</button>
              </div>
            </div>
          )}

          {loading ? (
            <p style={{ opacity: 0.6 }}>Đang tải…</p>
          ) : quotes.length === 0 ? (
            <div style={{ textAlign: 'center', opacity: 0.6, padding: '30px 0' }}>
              <Quote size={28} /><p>Chưa có trích dẫn nào. Bôi đen đoạn văn khi đọc rồi bấm “Lưu trích dẫn”.</p>
            </div>
          ) : (
            quotes.map((q) => (
              <div key={q.id} className="card" style={{ padding: 14, margin: 0, position: 'relative' }}>
                <Quote size={16} style={{ opacity: 0.4 }} />
                <p style={{ margin: '6px 0', fontStyle: 'italic', lineHeight: 1.6 }}>{q.quote}</p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  — {q.book_name}{q.author ? `, ${q.author}` : ''}
                </div>
                <button className="icon small danger" aria-label="Xoá trích dẫn" onClick={() => remove(q.id)}
                  style={{ position: 'absolute', top: 8, right: 8 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </article>
      </div>
    </div>
  )
}
