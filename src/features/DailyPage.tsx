import { useMemo, useState } from 'react'
import { BarChart3, Frown, Heart, NotebookPen, Pencil, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate, longDate } from '../lib/date'
import type { DailyType, Entry, Person } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'

const categories: Array<{ type: DailyType; title: string; icon: any; color: string; bg: string }> = [
  { type: 'FEELING',   title: 'Cảm xúc',  icon: Heart,    color: 'var(--purple)',  bg: 'var(--purple-bg)'  },
  { type: 'NEW_THING', title: 'Điều mới',  icon: Sparkles, color: 'var(--amber)',   bg: 'var(--amber-bg)'   },
  { type: 'SAD_THING', title: 'Điều buồn', icon: Frown,    color: 'var(--blue)',    bg: 'var(--blue-bg)'    },
  { type: 'SMALL_WIN', title: 'Việc nhỏ',  icon: Plus,     color: 'var(--emerald)', bg: 'var(--emerald-bg)' },
]

type PageTab = 'write' | 'stats'
type StatsPeriod = 'week' | 'month' | 'all'

// ── helpers ────────────────────────────────────────────────────────────────

function startOfWeek(d: Date) {
  const c = new Date(d)
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7)) // Monday
  return c
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function viDate(s: string) {
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function groupByDate(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  entries.forEach((e) => {
    const key = e.entry_date
    map.set(key, [...(map.get(key) ?? []), e])
  })
  return map
}

// ── component ──────────────────────────────────────────────────────────────

export function DailyPage() {
  const { showToast } = useToast()
  const { items, setItems, loading } = useQuery<Entry>('daily_entries')
  const peopleQuery = useQuery<Person>('people', 'name')

  const [pageTab, setPageTab] = useState<PageTab>('write')

  // Write tab state
  const [selectedType, setSelectedType] = useState<DailyType>('FEELING')
  const [content, setContent] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | DailyType>('ALL')
  const [date, setDate] = useState(localDate())
  const [busy, setBusy] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [editing, setEditing] = useState<Entry | null>(null)
  const [editText, setEditText] = useState('')
  const mentionQuery = content.match(/@([^\s@]*)$/)?.[1]?.toLowerCase() ?? ''
  const mentionPeople = peopleQuery.items.filter((p) => p.name.toLowerCase().includes(mentionQuery)).slice(0, 6)

  // Stats tab state
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('week')
  const [statsType, setStatsType] = useState<'ALL' | DailyType>('ALL')

  // ── actions ─────────────────────────────────────────────────────────────

  const saveEntries = async () => {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setBusy(true)
    setSaveSuccess('')
    const currentTimeString = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const payload = lines.map((lineText) => ({ content: lineText, entry_date: date, entry_type: selectedType }))
    const { data, error } = await supabase!.from('daily_entries').insert(payload).select()
    if (!error && data) {
      setItems((prev) => [...(data as Entry[]), ...prev])
      if (supabase) {
        const mentioned = peopleQuery.items.filter((person) => lines.some((line) => line.includes(`@${person.name}`)))
        await Promise.all(mentioned.map((person) => supabase!.from('person_daily_logs').upsert({ person_id: person.id, log_date: date, content: lines.join('\n') }, { onConflict: 'user_id,person_id,log_date' })))
      }
      setContent('')
      showToast(`✅ Đã lưu ${lines.length} bài nhật ký mới!`)
      setSaveSuccess(`Đã lưu ${lines.length} nội dung lúc ${currentTimeString} ✨`)
      setTimeout(() => setSaveSuccess(''), 3500)
    }
    setBusy(false)
  }

  const updateEntry = async () => {
    if (!editing || !editText.trim()) return
    await supabase!.from('daily_entries').update({ content: editText.trim(), entry_date: date }).eq('id', editing.id)
    setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, content: editText.trim(), entry_date: date } : i)))
    showToast('✏️ Đã cập nhật bài viết!')
    setEditing(null)
  }

  const removeEntry = async (id: string) => {
    await supabase!.from('daily_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    showToast('🗑️ Đã xóa bài nhật ký thành công', 'delete')
    setEditing(null)
  }

  // ── derived ──────────────────────────────────────────────────────────────

  const todayEntries = items.filter((i) => i.entry_date === date && (filterType === 'ALL' || i.entry_type === filterType))

  const statsEntries = useMemo(() => {
    const today = new Date()
    let cutoff: string
    if (statsPeriod === 'week') {
      cutoff = isoDate(startOfWeek(today))
    } else if (statsPeriod === 'month') {
      const m = new Date(today.getFullYear(), today.getMonth(), 1)
      cutoff = isoDate(m)
    } else {
      cutoff = '2000-01-01'
    }
    return items
      .filter((i) => i.entry_date >= cutoff)
      .filter((i) => statsType === 'ALL' || i.entry_type === statsType)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at))
  }, [items, statsPeriod, statsType])

  // Count by type for summary cards
  const countByType = useMemo(() => {
    const map: Record<string, number> = {}
    statsEntries.forEach((e) => { map[e.entry_type] = (map[e.entry_type] ?? 0) + 1 })
    return map
  }, [statsEntries])

  const groupedByDate = useMemo(() => groupByDate(statsEntries), [statsEntries])
  const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => b.localeCompare(a))

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <section className="page-shell">

      {/* ── Page tab switcher ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setPageTab('write')}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 12, fontSize: '0.8rem', fontWeight: 700,
            border: '1.5px solid', cursor: 'pointer', transition: 'all 0.18s',
            borderColor: pageTab === 'write' ? 'var(--primary)' : 'var(--card-border)',
            background: pageTab === 'write' ? 'var(--primary)' : 'var(--card-bg)',
            color: pageTab === 'write' ? 'white' : 'var(--text-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          <NotebookPen size={13} /> Viết nhật ký
        </button>
        <button
          onClick={() => setPageTab('stats')}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 12, fontSize: '0.8rem', fontWeight: 700,
            border: '1.5px solid', cursor: 'pointer', transition: 'all 0.18s',
            borderColor: pageTab === 'stats' ? 'var(--emerald)' : 'var(--card-border)',
            background: pageTab === 'stats' ? 'var(--emerald)' : 'var(--card-bg)',
            color: pageTab === 'stats' ? 'white' : 'var(--text-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          <BarChart3 size={13} /> Thống kê
        </button>
      </div>

      {/* ════════════════ WRITE TAB ════════════════════════════════════════ */}
      {pageTab === 'write' && (
        <>
          {/* 4 category icon buttons */}
          <div className="daily-4-icons" style={{ marginBottom: 8 }}>
            {categories.map((cat) => {
              const Icon = cat.icon
              const isSelected = selectedType === cat.type
              return (
                <button
                  key={cat.type}
                  className={'daily-icon-btn ' + (isSelected ? 'active' : '')}
                  onClick={() => setSelectedType(cat.type)}
                  title={cat.title}
                  style={{ padding: '6px 0', borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                  <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 28, height: 28 }}>
                    <Icon size={15} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Write card */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="eyebrow" style={{ margin: 0, padding: '2px 8px', fontSize: '0.68rem' }}>
                {longDate(new Date(date + 'T12:00:00'))}
              </span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: '2px 6px', fontSize: '0.78rem' }} />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Viết nhật ký ${categories.find((c) => c.type === selectedType)?.title.toLowerCase()} vào đây...`}
              rows={3}
              style={{ width: '100%', border: '1px solid var(--card-border)', borderRadius: 12, padding: 10, fontSize: '0.9rem', resize: 'vertical', outline: 'none', background: 'var(--card-bg)', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: 8 }}
            />
            {content.includes('@') && mentionPeople.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {mentionPeople.map((person) => <button key={person.id} type="button" className="eyebrow" onClick={() => setContent((value) => value.replace(/@[^\s@]*$/, `@${person.name} `))}>@{person.name}</button>)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button className="primary" onClick={saveEntries} disabled={busy} style={{ padding: '6px 16px', fontSize: '0.84rem' }}>
                <Save size={15} />
                {busy ? 'Lưu…' : 'Lưu nhật ký'}
              </button>
            </div>
            {saveSuccess && (
              <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--emerald-bg)', color: 'var(--emerald)', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, textAlign: 'center' }}>
                {saveSuccess}
              </div>
            )}
          </div>

          {/* Today's entries list */}
          <div className="card" style={{ padding: 12, margin: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)' }}>
                <NotebookPen size={15} /> Nhật ký hôm nay ({todayEntries.length})
              </h2>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-main)', padding: 3, borderRadius: 10, border: '1px solid var(--card-border)' }}>
                <button
                  onClick={() => setFilterType('ALL')}
                  style={{ border: 0, background: filterType === 'ALL' ? 'var(--card-bg)' : 'transparent', color: filterType === 'ALL' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: filterType === 'ALL' ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer' }}
                >
                  Tất cả
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.type}
                    onClick={() => setFilterType(cat.type)}
                    style={{ border: 0, background: filterType === cat.type ? cat.bg : 'transparent', color: filterType === cat.type ? cat.color : 'var(--text-muted)', fontWeight: filterType === cat.type ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    {cat.title}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải nhật ký…</p>
            ) : todayEntries.length ? (
              <div style={{ display: 'grid', gap: 6, maxHeight: 'calc(100vh - 350px)', minHeight: '230px', overflowY: 'auto' }}>
                {todayEntries.map((entry) => {
                  const cat = categories.find((c) => c.type === entry.entry_type) ?? categories[0]
                  const Icon = cat.icon
                  return (
                    <div key={entry.id} className="check-row" style={{ justifyContent: 'space-between', background: 'var(--bg-main)', borderRadius: 8, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 22, height: 22 }}>
                          <Icon size={12} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.content}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="icon small" aria-label="Edit entry" onClick={() => { setEditing(entry); setEditText(entry.content); setDate(entry.entry_date) }} style={{ padding: 3 }}>
                          <Pencil size={13} />
                        </button>
                        <button className="icon small danger" aria-label="Delete entry" onClick={() => removeEntry(entry.id)} style={{ padding: 3 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty icon={NotebookPen} colorClass="icon-box-emerald">
                {filterType === 'ALL' ? 'Chưa có nhật ký nào cho hôm nay.' : `Chưa có mục nào cho "${categories.find((c) => c.type === filterType)?.title}".`}
              </Empty>
            )}
          </div>
        </>
      )}

      {/* ════════════════ STATS TAB ════════════════════════════════════════ */}
      {pageTab === 'stats' && (
        <>
          {/* Period + type filter row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {/* Period pills */}
            <div style={{ display: 'flex', gap: 5 }}>
              {([['week', 'Tuần này'], ['month', 'Tháng này'], ['all', 'Tất cả']] as [StatsPeriod, string][]).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => setStatsPeriod(p)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    border: '1.5px solid', transition: 'all 0.15s',
                    borderColor: statsPeriod === p ? 'var(--primary)' : 'var(--card-border)',
                    background: statsPeriod === p ? 'var(--primary)' : 'var(--card-bg)',
                    color: statsPeriod === p ? 'white' : 'var(--text-main)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Type filter */}
            <select
              value={statsType}
              onChange={(e) => setStatsType(e.target.value as any)}
              style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
            >
              <option value="ALL">Tất cả loại</option>
              {categories.map((c) => <option key={c.type} value={c.type}>{c.title}</option>)}
            </select>
          </div>

          {/* Summary count cards */}
          <div className="form-row-4" style={{ gap: 6, marginBottom: 10 }}>
            {categories.map((cat) => {
              const Icon = cat.icon
              const count = countByType[cat.type] ?? 0
              return (
                <button
                  key={cat.type}
                  onClick={() => setStatsType(statsType === cat.type ? 'ALL' : cat.type)}
                  style={{
                    padding: '8px 6px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                    border: '1.5px solid', transition: 'all 0.15s',
                    borderColor: statsType === cat.type ? cat.color : 'var(--card-border)',
                    background: statsType === cat.type ? cat.bg : 'var(--card-bg)',
                  }}
                >
                  <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 24, height: 24, margin: '0 auto 4px' }}>
                    <Icon size={12} />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: cat.color }}>{count}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.2 }}>{cat.title}</div>
                </button>
              )
            })}
          </div>

          {/* Total entry count pill */}
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: 20 }}>
              {statsEntries.length} bài · {sortedDates.length} ngày
            </span>
          </div>

          {/* Timeline list */}
          {loading ? (
            <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Đang tải…</p>
          ) : statsEntries.length === 0 ? (
            <Empty icon={BarChart3} colorClass="icon-box-emerald">
              Không có bài viết nào trong khoảng thời gian này.
            </Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 'calc(100vh - 310px)', minHeight: 180 }}>
              {sortedDates.map((d) => {
                const dayEntries = groupedByDate.get(d)!
                const isToday = d === localDate()
                return (
                  <div key={d}>
                    {/* Date header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
                        background: isToday ? 'var(--primary)' : 'var(--card-border)',
                        color: isToday ? 'white' : 'var(--text-muted)',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {isToday ? '📅 Hôm nay' : viDate(d)}
                      </div>
                      <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                        {dayEntries.length} bài
                      </span>
                    </div>

                    {/* Entries for this day */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8, borderLeft: '2px solid var(--card-border)' }}>
                      {dayEntries.map((entry) => {
                        const cat = categories.find((c) => c.type === entry.entry_type) ?? categories[0]
                        const Icon = cat.icon
                        return (
                          <div key={entry.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '6px 10px', borderRadius: 10,
                            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                          }}>
                            <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 20, height: 20, flexShrink: 0, marginTop: 1 }}>
                              <Icon size={11} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: cat.color, marginBottom: 1 }}>
                                {cat.title}
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                {entry.content}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                              <button className="icon small" onClick={() => { setEditing(entry); setEditText(entry.content); setDate(entry.entry_date) }} style={{ padding: 3 }}>
                                <Pencil size={11} />
                              </button>
                              <button className="icon small danger" onClick={() => removeEntry(entry.id)} style={{ padding: 3 }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Sửa dòng nhật ký" onClose={() => setEditing(null)}>
          <label>
            Ngày viết
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Nội dung
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
          </label>
          <div className="modal-actions">
            <DeleteButton onDelete={() => removeEntry(editing.id)} />
            <button className="primary" onClick={updateEntry}>Lưu thay đổi</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
