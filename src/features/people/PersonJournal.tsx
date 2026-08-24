import { useEffect, useState } from 'react'
import { NotebookPen, Plus, Save, Trash2, Calendar, FileText } from 'lucide-react'
import { localDate } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import type { PersonDailyLog } from '../../types'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { DailyLogPhotos } from './DailyLogPhotos'

const MAX = 500

export function PersonJournal({ personId, personName }: { personId: string; personName: string }) {
  const { showToast } = useToast()
  const [openAdd, setOpenAdd] = useState(false)
  const [date, setDate] = useState(localDate())
  const [log, setLog] = useState('')
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState<PersonDailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingLog, setViewingLog] = useState<PersonDailyLog | null>(null)

  const loadLogs = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('person_daily_logs')
      .select('*')
      .eq('person_id', personId)
      .order('log_date', { ascending: false })
      .limit(50)
    setLogs((data ?? []) as PersonDailyLog[])
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [personId])

  const openNew = () => {
    setDate(localDate())
    setLog('')
    setOpenAdd(true)
  }

  const openExisting = (entry: PersonDailyLog) => {
    setDate(entry.log_date)
    setLog(entry.content)
    setViewingLog(entry)
  }

  const save = async () => {
    if (!log.trim() || saving) return
    setSaving(true)
    if (!supabase) {
      setSaving(false)
      showToast('Đã lưu Local')
      setOpenAdd(false)
      setViewingLog(null)
      return
    }
    const { data, error } = await supabase
      .from('person_daily_logs')
      .upsert(
        { person_id: personId, log_date: date, content: log.trim() },
        { onConflict: 'user_id,person_id,log_date' },
      )
      .select()
      .single()
    setSaving(false)

    if (!error && data) {
      setLogs((prev) => {
        const without = prev.filter((item) => item.log_date !== date)
        return [data as PersonDailyLog, ...without].sort((a, b) => b.log_date.localeCompare(a.log_date))
      })
    }
    showToast(error ? '❌ Chưa lưu được' : '📝 Đã lưu nhật ký')
    setOpenAdd(false)
    setViewingLog(null)
  }

  const deleteLog = async (logId: string, _logDate: string) => {
    if (!confirm('Bạn có chắc muốn xoá nhật ký này?')) return
    if (supabase) {
      await supabase.from('person_daily_logs').delete().eq('id', logId)
    }
    setLogs((prev) => prev.filter((item) => item.id !== logId))
    showToast('🗑️ Đã xoá nhật ký', 'delete')
    setViewingLog(null)
  }

  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <NotebookPen size={17} color="var(--primary)" /> Nhật ký với {personName}
        </h3>
        <button type="button" className="link-add" onClick={openNew}>
          <Plus size={16} /> Thêm nhật ký
        </button>
      </div>

      {loading ? (
        <p className="home-card-empty">Đang tải nhật ký…</p>
      ) : logs.length === 0 ? (
        <div className="occasions-empty">
          <div className="icon-box" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <FileText size={22} />
          </div>
          <p>Chưa có nhật ký nào với {personName}. Bấm "Thêm nhật ký" để viết bài đầu tiên!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {logs.map((entry) => (
            <div
              key={entry.id}
              onClick={() => openExisting(entry)}
              className="card"
              style={{
                margin: 0,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}
            >
              <div
                className="icon-box icon-box-sm"
                style={{ width: 28, height: 28, background: 'var(--primary-light)', color: 'var(--primary)', flexShrink: 0 }}
              >
                <Calendar size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <time style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {entry.log_date.split('-').reverse().join('/')}
                  </time>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {entry.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm Nhật Ký Mới */}
      {openAdd && (
        <Modal title={`Viết nhật ký với ${personName}`} onClose={() => setOpenAdd(false)}>
          <div className="person-form">
            <label className="field">
              <span>Ngày ghi</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày nhật ký" />
            </label>

            <label className="field">
              <span>Nội dung nhật ký</span>
              <div className="textarea-wrap">
                <textarea
                  rows={5}
                  maxLength={MAX}
                  value={log}
                  onChange={(e) => setLog(e.target.value)}
                  placeholder={`Hôm nay có điều gì đáng nhớ với ${personName}…`}
                  autoFocus
                />
                <span className="textarea-count">
                  {log.length}/{MAX}
                </span>
              </div>
            </label>

            <DailyLogPhotos personId={personId} date={date} />

            <div className="modal-actions">
              <button type="button" onClick={() => setOpenAdd(false)}>
                Huỷ
              </button>
              <button className="primary" onClick={save} disabled={!log.trim() || saving}>
                <Save size={15} /> {saving ? 'Đang lưu…' : 'Lưu nhật ký'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Xem & Sửa Nhật Ký */}
      {viewingLog && (
        <Modal
          title={`Nhật ký ngày ${viewingLog.log_date.split('-').reverse().join('/')}`}
          onClose={() => setViewingLog(null)}
        >
          <div className="person-form">
            <label className="field">
              <span>Ngày ghi</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label className="field">
              <span>Nội dung</span>
              <div className="textarea-wrap">
                <textarea
                  rows={5}
                  maxLength={MAX}
                  value={log}
                  onChange={(e) => setLog(e.target.value)}
                />
                <span className="textarea-count">
                  {log.length}/{MAX}
                </span>
              </div>
            </label>

            <DailyLogPhotos personId={personId} date={date} />

            <div className="modal-actions">
              <button
                type="button"
                className="danger"
                onClick={() => deleteLog(viewingLog.id, viewingLog.log_date)}
                style={{ marginRight: 'auto' }}
              >
                <Trash2 size={15} /> Xoá
              </button>
              <button type="button" onClick={() => setViewingLog(null)}>
                Đóng
              </button>
              <button className="primary" onClick={save} disabled={!log.trim() || saving}>
                <Save size={15} /> Lưu thay đổi
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
