import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, X, Inbox } from 'lucide-react'

export function useQuery<T>(table: string, order = 'created_at') {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase.from(table).select('*').is('deleted_at', null).order(order, { ascending: false })
    if (error) setError('Could not load data. Please try again.')
    else setItems((data ?? []) as T[])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [table])

  return { items, setItems, loading, error, reload }
}

export function Empty({ children, icon: Icon = Inbox, colorClass = 'icon-box-blue' }: { children: React.ReactNode; icon?: any; colorClass?: string }) {
  return (
    <div className="empty">
      <div className={`empty-icon ${colorClass}`}>
        <Icon size={22} />
      </div>
      <span>{children}</span>
    </div>
  )
}

export function InlineForm({ placeholder, onSave }: { placeholder: string; onSave: (text: string) => Promise<void> }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!value.trim()) return
        setBusy(true)
        await onSave(value.trim())
        setValue('')
        setBusy(false)
      }}
    >
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      <button className="primary" disabled={busy}>
        <Plus size={16} />
        {busy ? 'Saving…' : 'Add'}
      </button>
    </form>
  )
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" aria-label="Close form" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  )
}

export function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      className="text-danger"
      disabled={busy}
      onClick={async () => {
        if (confirm('Remove this item? You can’t undo this from the app.')) {
          setBusy(true)
          await onDelete()
        }
      }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Trash2 size={16} />
      {busy ? 'Removing…' : 'Delete'}
    </button>
  )
}
