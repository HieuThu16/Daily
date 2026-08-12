import { useEffect, useState } from 'react'
import { NotebookPen, Save } from 'lucide-react'
import { localDate } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import type { PersonDailyLog } from '../../types'
import { useToast } from '../ToastContext'
import { DailyLogPhotos } from './DailyLogPhotos'

const MAX = 500

export function PersonJournal({ personId, personName }: { personId: string; personName: string }) {
  const { showToast } = useToast()
  const [date, setDate] = useState(localDate())
  const [log, setLog] = useState('')
  const [saving, setSaving] = useState(false)
  const [past, setPast] = useState<PersonDailyLog[] | null>(null)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase
      .from('person_daily_logs')
      .select('*')
      .eq('person_id', personId)
      .eq('log_date', date)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setLog((data as PersonDailyLog | null)?.content ?? '')
      })
    return () => {
      alive = false
    }
  }, [personId, date])

  const save = async () => {
    if (!log.trim() || saving) return
    setSaving(true)
    if (!supabase) {
      setSaving(false)
      return showToast('Đã lưu Local')
    }
    const { error } = await supabase
      .from('person_daily_logs')
      .upsert({ person_id: personId, log_date: date, content: log.trim() }, { onConflict: 'user_id,person_id,log_date' })
    setSaving(false)
    setPast(null)
    showToast(error ? 'Đã lưu Local' : 'Đã lưu Supabase')
  }

  const loadPast = async () => {
    if (past) return setPast(null)
    if (!supabase) return setPast([])
    const { data } = await supabase
      .from('person_daily_logs')
      .select('*')
      .eq('person_id', personId)
      .order('log_date', { ascending: false })
      .limit(20)
    setPast((data ?? []) as PersonDailyLog[])
  }

  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <NotebookPen size={17} color="var(--primary)" /> Nhật ký
        </h3>
      </div>

      <label className="field">
        <span>Ngày ghi</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày nhật ký" />
      </label>

      <label className="field">
        <span>Nội dung</span>
        <div className="textarea-wrap">
          <textarea
            rows={6}
            maxLength={MAX}
            value={log}
            onChange={(e) => setLog(e.target.value)}
            placeholder={`Viết nhật ký với ${personName}…`}
          />
          <span className="textarea-count">
            {log.length}/{MAX}
          </span>
        </div>
      </label>

      <DailyLogPhotos personId={personId} date={date} />

      <button className="primary block" onClick={save} disabled={!log.trim() || saving}>
        <Save size={15} /> {saving ? 'Đang lưu…' : 'Lưu nhật ký'}
      </button>

      <button type="button" className="link-more" onClick={loadPast}>
        {past ? 'Ẩn nhật ký cũ' : 'Xem nhật ký cũ'}
      </button>

      {past && (
        <div className="past-logs">
          {past.length === 0 ? (
            <p className="home-card-empty">Chưa có nhật ký nào trước đó.</p>
          ) : (
            past.map((entry) => (
              <button key={entry.id} type="button" className="past-log" onClick={() => setDate(entry.log_date)}>
                <time>{entry.log_date.split('-').reverse().join('/')}</time>
                <p>{entry.content}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
