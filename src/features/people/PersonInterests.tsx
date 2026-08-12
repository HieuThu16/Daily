import { useEffect, useRef, useState } from 'react'
import { Activity, Heart, Plus, UtensilsCrossed, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { PersonInterest } from '../../types'
import { useToast } from '../ToastContext'

/** Gợi ý mở đầu để không phải nghĩ từ số không. */
const HINTS = [
  { label: 'Món ăn', icon: UtensilsCrossed },
  { label: 'Hoạt động', icon: Activity },
]

export function PersonInterests({ personId }: { personId: string }) {
  const { showToast } = useToast()
  const [interests, setInterests] = useState<PersonInterest[]>([])
  const [value, setValue] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!supabase) return setInterests([])
    let alive = true
    supabase
      .from('person_interests')
      .select('*')
      .eq('person_id', personId)
      .then(({ data }) => {
        if (alive) setInterests((data ?? []) as PersonInterest[])
      })
    return () => {
      alive = false
    }
  }, [personId])

  const add = async () => {
    const label = value.trim()
    if (!label) return
    setInterests((prev) => [...prev, { id: crypto.randomUUID(), person_id: personId, label }])
    setValue('')
    if (!supabase) return showToast('Sở thích đã lưu Local')
    const { error } = await supabase.from('person_interests').insert({ person_id: personId, label })
    showToast(error ? 'Sở thích đã lưu Local' : 'Sở thích đã lưu Supabase')
  }

  const remove = async (id: string) => {
    setInterests((prev) => prev.filter((i) => i.id !== id))
    await supabase?.from('person_interests').delete().eq('id', id)
  }

  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <Heart size={17} color="var(--rose)" /> Sở thích
        </h3>
        <span className="home-card-count">{interests.length}</span>
      </div>

      <div className="inline-add">
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Thêm sở thích…"
          aria-label="Thêm sở thích"
        />
        <button className="round-add" onClick={add} aria-label="Lưu sở thích" disabled={!value.trim()}>
          <Plus size={16} />
        </button>
      </div>

      {interests.length === 0 ? (
        <>
          <p className="home-card-empty">Chưa ghi sở thích nào.</p>
          <div className="hint-chips">
            {HINTS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setValue(`${label}: `)
                  input.current?.focus()
                }}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="interest-list">
          {interests.map((item) => (
            <span key={item.id} className="interest-chip">
              <Heart size={12} /> {item.label}
              <button onClick={() => remove(item.id)} aria-label={`Xoá ${item.label}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
