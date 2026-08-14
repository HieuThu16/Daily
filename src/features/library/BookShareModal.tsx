import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Send } from 'lucide-react'
import { Modal } from '../shared'
import { filterPeople, loadPeople, shareBookTo, type Person } from '../../lib/bookShare'
import type { Media } from '../../types'

/** Chọn một hay nhiều người đã đăng ký app rồi gửi thẳng nội dung sách cho họ. */
export function BookShareModal({ item, onClose }: { item: Media; onClose: () => void }) {
  const [people, setPeople] = useState<Person[]>([])
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPeople()
      .then((list) => !cancelled && setPeople(list))
      .catch(() => !cancelled && setError('Không tải được danh sách người dùng.'))
    return () => {
      cancelled = true
    }
  }, [])

  const shown = useMemo(() => filterPeople(people, query), [people, query])

  const toggle = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const send = async () => {
    if (picked.length === 0) return
    setBusy(true)
    setError('')
    try {
      setSent(await shareBookTo(item.id, picked))
    } catch {
      setError('Không gửi được, thử lại sau.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Chia sẻ "${item.name}"`} onClose={onClose}>
      {sent !== null ? (
        <div className="book-share">
          <p>Đã gửi cho {sent} người. Sách nằm sẵn trong thư viện của họ.</p>
          <button type="button" className="primary" onClick={onClose}>Xong</button>
        </div>
      ) : (
        <div className="book-share">
          <input
            type="search"
            placeholder="Tìm theo tên hoặc email…"
            aria-label="Tìm người nhận"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <ul className="book-share-list">
            {shown.map((person) => {
              const on = picked.includes(person.id)
              return (
                <li key={person.id}>
                  <button type="button" className={on ? 'on' : undefined} aria-pressed={on} onClick={() => toggle(person.id)}>
                    <span>
                      {on && <Check size={13} />} {person.name || person.email || 'Người dùng'}
                    </span>
                    {person.name && person.email && <small>{person.email}</small>}
                  </button>
                </li>
              )
            })}
            {shown.length === 0 && <li className="library-book-muted">Không có ai phù hợp.</li>}
          </ul>

          {error && <p className="library-book-error" role="alert">{error}</p>}

          <button type="button" className="primary" disabled={picked.length === 0 || busy} onClick={() => void send()}>
            {busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            {busy ? 'Đang gửi…' : `Gửi sách${picked.length ? ` (${picked.length})` : ''}`}
          </button>
        </div>
      )}
    </Modal>
  )
}
