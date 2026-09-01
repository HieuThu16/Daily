import { useEffect, useMemo, useState } from 'react'
import { CloudMoon, Moon, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { shiftDate, sleepDuration, sleepMinutesOn } from '../lib/sleep'
import { ClockTimeInput } from './nutrition/ClockTimeInput'
import { useToast } from './ToastContext'
import { Modal } from './shared'
import { PeriodSelector, SleepPeriodView } from './nutrition/NutritionPeriodViews'
import {
  getPeriodRange,
  shiftPeriodAnchor,
  type PeriodMode,
  type SleepLog,
} from './nutrition/periodData'
import { SkeletonList } from './Skeleton'
import { queueWrite } from '../lib/offlineQueue'

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? `${rest}m` : ''}` : `${rest}m`
}

function periodLabel(anchor: string, mode: PeriodMode) {
  const range = getPeriodRange(anchor, mode)
  if (mode === 'day') return anchor
  if (mode === 'month') {
    const [year, month] = anchor.split('-')
    return `Tháng ${Number(month)}/${year}`
  }
  const format = (date: string) => {
    const [, month, day] = date.split('-')
    return `${Number(day)}/${Number(month)}`
  }
  return `${format(range.start)} – ${format(range.end)}`
}

export function SleepPage() {
  const { showToast } = useToast()
  const [currentDate, setCurrentDate] = useState(localDate())
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day')
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [periodSleepLogs, setPeriodSleepLogs] = useState<SleepLog[]>([])
  const [loading, setLoading] = useState(true)

  const [sleepModal, setSleepModal] = useState(false)
  const [editingSleep, setEditingSleep] = useState<SleepLog | null>(null)
  const [sleepStart, setSleepStart] = useState('22:00')
  const [sleepEnd, setSleepEnd] = useState('06:00')
  const [dream, setDream] = useState('')

  const [dreamModalLog, setDreamModalLog] = useState<SleepLog | null>(null)
  const [dreamText, setDreamText] = useState('')

  const periodRange = useMemo(() => getPeriodRange(currentDate, periodMode), [currentDate, periodMode])

  useEffect(() => {
    let alive = true
    setLoading(true)

    async function load() {
      try {
        if (periodMode === 'day') {
          const prevDate = shiftDate(currentDate, -1)
          const { data } = await supabase!
            .from('sleep_logs')
            .select('*')
            .in('log_date', [prevDate, currentDate])
            .is('deleted_at', null)
            .order('created_at')
          const relevant = ((data ?? []) as SleepLog[]).filter((log) => sleepMinutesOn(log, currentDate) > 0)
          if (alive) setSleepLogs(relevant)
        } else {
          const paddedStart = shiftDate(periodRange.start, -1)
          const { data } = await supabase!
            .from('sleep_logs')
            .select('*')
            .gte('log_date', paddedStart)
            .lte('log_date', periodRange.end)
            .is('deleted_at', null)
            .order('log_date')
          if (alive) setPeriodSleepLogs((data ?? []) as SleepLog[])
        }
      } catch (error) {
        console.warn('Lỗi tải dữ liệu giấc ngủ:', error)
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [currentDate, periodMode, periodRange.start, periodRange.end])

  function openAddSleepModal() {
    setEditingSleep(null)
    setSleepStart('22:00')
    setSleepEnd('06:00')
    setDream('')
    setSleepModal(true)
  }

  function openEditSleepModal(log: SleepLog) {
    setEditingSleep(log)
    setSleepStart(log.sleep_start)
    setSleepEnd(log.sleep_end)
    setDream(log.dream ?? '')
    setSleepModal(true)
  }

  function openDreamModal(log: SleepLog) {
    setDreamModalLog(log)
    setDreamText(log.dream ?? '')
  }

  async function saveDreamOnly() {
    if (!dreamModalLog) return
    const updatedDream = dreamText.trim()
    let savedOnline = false
    try {
      if (supabase) {
        const { error } = await supabase
          .from('sleep_logs')
          .update({ dream: updatedDream })
          .eq('id', dreamModalLog.id)
        if (!error) savedOnline = true
      }
    } catch {
      // fallback
    }

    if (!savedOnline) {
      queueWrite({
        table: 'sleep_logs',
        op: 'update',
        payload: { dream: updatedDream },
        match: { id: dreamModalLog.id },
      })
    }

    setSleepLogs((prev) =>
      prev.map((item) => (item.id === dreamModalLog.id ? { ...item, dream: updatedDream } : item)),
    )
    setPeriodSleepLogs((prev) =>
      prev.map((item) => (item.id === dreamModalLog.id ? { ...item, dream: updatedDream } : item)),
    )
    setDreamModalLog(null)
    showToast('✨ Đã lưu giấc mơ')
  }

  async function saveSleep() {
    const dur = sleepDuration({ sleep_start: sleepStart, sleep_end: sleepEnd, log_date: currentDate })
    if (dur <= 0) {
      showToast('⚠️ Giờ ngủ không hợp lệ')
      return
    }

    const cleanDream = dream.trim() || null

    const basePayload: Record<string, unknown> = {
      log_date: currentDate,
      sleep_start: sleepStart,
      sleep_end: sleepEnd,
      duration_minutes: dur,
    }
    if (cleanDream) {
      basePayload.dream = cleanDream
    }

    let savedItem: SleepLog | null = null
    let savedToSupabase = false

    if (editingSleep) {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('sleep_logs')
            .update(basePayload)
            .eq('id', editingSleep.id)
            .select()
            .single()

          if (!error && data) {
            savedItem = data as SleepLog
            savedToSupabase = true
          } else if (error) {
            console.warn('Lỗi update sleep_logs Tier 1, thử lại không kèm dream:', error)
            const fallbackPayload = {
              log_date: currentDate,
              sleep_start: sleepStart,
              sleep_end: sleepEnd,
              duration_minutes: dur,
            }
            const { data: retryData, error: retryErr } = await supabase
              .from('sleep_logs')
              .update(fallbackPayload)
              .eq('id', editingSleep.id)
              .select()
              .single()

            if (!retryErr && retryData) {
              savedItem = { ...(retryData as SleepLog), dream: cleanDream }
              savedToSupabase = true
            }
          }
        }
      } catch (e) {
        console.warn('Lỗi kết nối Supabase khi update sleep_logs:', e)
      }

      if (!savedItem) {
        savedItem = {
          ...editingSleep,
          ...basePayload,
          dream: cleanDream,
        } as SleepLog
        queueWrite({
          table: 'sleep_logs',
          op: 'update',
          payload: basePayload,
          match: { id: editingSleep.id },
        })
      }

      setSleepLogs((prev) =>
        prev.map((item) => (item.id === editingSleep.id ? savedItem! : item)),
      )
      setPeriodSleepLogs((prev) =>
        prev.map((item) => (item.id === editingSleep.id ? savedItem! : item)),
      )
    } else {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('sleep_logs')
            .insert(basePayload)
            .select()
            .single()

          if (!error && data) {
            savedItem = data as SleepLog
            savedToSupabase = true
          } else if (error) {
            console.warn('Lỗi insert sleep_logs Tier 1, thử lại không kèm dream:', error)
            const fallbackPayload = {
              log_date: currentDate,
              sleep_start: sleepStart,
              sleep_end: sleepEnd,
              duration_minutes: dur,
            }
            const { data: retryData, error: retryErr } = await supabase
              .from('sleep_logs')
              .insert(fallbackPayload)
              .select()
              .single()

            if (!retryErr && retryData) {
              savedItem = { ...(retryData as SleepLog), dream: cleanDream }
              savedToSupabase = true
            }
          }
        }
      } catch (e) {
        console.warn('Lỗi kết nối Supabase khi insert sleep_logs:', e)
      }

      if (!savedItem) {
        const localId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`
        savedItem = {
          id: localId,
          created_at: new Date().toISOString(),
          ...basePayload,
          dream: cleanDream,
        } as SleepLog
        queueWrite({
          table: 'sleep_logs',
          op: 'insert',
          payload: { id: localId, ...basePayload },
        })
      }

      setSleepLogs((prev) => [...prev, savedItem!])
      setPeriodSleepLogs((prev) => [...prev, savedItem!])
    }

    setSleepModal(false)
    setEditingSleep(null)
    if (savedToSupabase) {
      showToast('☁️ Đã lưu giấc ngủ lên Supabase!', 'success')
    } else {
      showToast('💾 Đã lưu giấc ngủ vào Local (Đã xếp hàng đồng bộ)', 'local')
    }
  }

  async function deleteSleep(id: string) {
    let deletedOnline = false
    try {
      if (supabase) {
        const { error } = await supabase.from('sleep_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id)
        if (!error) deletedOnline = true
      }
    } catch {
      // fallback
    }
    if (!deletedOnline) {
      queueWrite({
        table: 'sleep_logs',
        op: 'update',
        payload: { deleted_at: new Date().toISOString() },
        match: { id },
      })
    }
    setSleepLogs((current) => current.filter((log) => log.id !== id))
    setPeriodSleepLogs((current) => current.filter((log) => log.id !== id))
    showToast('🗑️ Đã xoá giấc ngủ', 'delete')
  }

  const totalSleep = sleepLogs.reduce((sum, log) => sum + sleepMinutesOn(log, currentDate), 0)

  return (
    <section className="page-shell is-narrow" style={{ display: 'grid', gap: 10 }}>
      {/* HEADER & PERIOD SELECTOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
          <Moon size={20} color="#6366f1" />
          <span>Theo dõi giấc ngủ</span>
        </div>
        <PeriodSelector value={periodMode} onChange={setPeriodMode} />
      </div>

      {/* CHUYỂN NGÀY / KỲ */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="icon"
          aria-label="Khoảng trước"
          onClick={() => setCurrentDate(shiftPeriodAnchor(currentDate, periodMode, -1))}
        >
          ‹
        </button>
        <strong style={{ minWidth: 125, color: '#6366f1', fontSize: '.78rem', textAlign: 'center' }}>
          {periodLabel(currentDate, periodMode)}
        </strong>
        <button
          type="button"
          className="icon"
          aria-label="Khoảng sau"
          onClick={() => setCurrentDate(shiftPeriodAnchor(currentDate, periodMode, 1))}
        >
          ›
        </button>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {periodMode === 'day' && (
            <>
              {/* Card Tổng thời gian ngủ hôm nay */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
                }}
              >
                <div>
                  <small style={{ fontSize: '0.78rem', opacity: 0.9 }}>Tổng thời gian ngủ hôm nay</small>
                  <strong style={{ display: 'block', fontSize: '1.35rem', marginTop: 2 }}>
                    {totalSleep ? duration(totalSleep) : '—'}
                  </strong>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={openAddSleepModal}
                  style={{
                    background: 'rgba(255,255,255,.25)',
                    border: '1px solid rgba(255,255,255,.4)',
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.82rem',
                  }}
                >
                  <Plus size={14} style={{ display: 'inline', marginRight: 4 }} /> Ghi giấc ngủ
                </button>
              </div>

              {/* Danh sách các phiên ngủ */}
              {sleepLogs.length === 0 ? (
                <div className="card" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Moon size={32} color="#6366f1" style={{ opacity: 0.6, marginBottom: 8 }} />
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>Chưa có phiên ngủ nào cho ngày này</div>
                  <p style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    Bấm vào "Ghi giấc ngủ" để ghi lại giờ đi ngủ, thức dậy và nhật ký giấc mơ.
                  </p>
                </div>
              ) : (
                sleepLogs.map((log) => (
                  <div
                    key={log.id}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '12px 14px',
                      margin: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: 'rgba(99, 102, 241, 0.12)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Moon size={20} color="#6366f1" />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '0.88rem' }}>
                          {log.sleep_start} → {log.sleep_end}
                          {log.log_date !== currentDate && ' (từ hôm trước)'}
                        </strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>
                          {duration(log.duration_minutes)}
                          {sleepMinutesOn(log, currentDate) !== log.duration_minutes &&
                            ` · tính cho ${currentDate}: ${duration(sleepMinutesOn(log, currentDate))}`}
                        </small>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          aria-label={`Ghi giấc mơ ${log.sleep_start}`}
                          title={log.dream ? 'Sửa giấc mơ' : 'Thêm giấc mơ'}
                          onClick={() => openDreamModal(log)}
                          style={{ border: 0, background: 'none', color: '#8b5cf6', padding: 6, cursor: 'pointer' }}
                        >
                          <CloudMoon size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Sửa phiên ngủ ${log.sleep_start}`}
                          title="Sửa phiên ngủ"
                          onClick={() => openEditSleepModal(log)}
                          style={{ border: 0, background: 'none', color: 'var(--text-muted)', padding: 6, cursor: 'pointer' }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa giấc ngủ ${log.sleep_start}`}
                          title="Xoá phiên ngủ"
                          onClick={() => deleteSleep(log.id)}
                          style={{ border: 0, background: 'none', color: '#ef4444', padding: 6, cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {log.dream ? (
                      <button
                        type="button"
                        onClick={() => openDreamModal(log)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '8px 12px',
                          background: 'var(--bg-main)',
                          borderRadius: 8,
                          fontSize: '0.8rem',
                          borderLeft: '3px solid #8b5cf6',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          borderTop: 0,
                          borderRight: 0,
                          borderBottom: 0,
                        }}
                        title="Nhấn để xem / sửa chi tiết giấc mơ"
                      >
                        <CloudMoon size={15} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ flex: 1, lineHeight: 1.4 }}>{log.dream}</span>
                        <Pencil size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openDreamModal(log)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 10px',
                          background: 'rgba(139, 92, 246, 0.08)',
                          border: '1px dashed rgba(139, 92, 246, 0.35)',
                          borderRadius: 8,
                          fontSize: '0.76rem',
                          color: '#8b5cf6',
                          fontWeight: 600,
                          cursor: 'pointer',
                          alignSelf: 'flex-start',
                          marginTop: 2,
                        }}
                      >
                        <Plus size={13} /> Thêm giấc mơ cho phiên này
                      </button>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {periodMode !== 'day' && (
            <SleepPeriodView
              logs={periodSleepLogs}
              days={periodRange.days}
              onDelete={deleteSleep}
              onEdit={openEditSleepModal}
              onDream={openDreamModal}
            />
          )}
        </>
      )}

      {/* MODAL GHI / SỬA GIẤC NGỦ */}
      {sleepModal && (
        <Modal
          onClose={() => {
            setSleepModal(false)
            setEditingSleep(null)
          }}
          title={
            editingSleep
              ? `Sửa phiên ngủ (${editingSleep.sleep_start} → ${editingSleep.sleep_end})`
              : 'Ghi giấc ngủ & Giấc mơ'
          }
        >
          <div className="form-grid" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
              <ClockTimeInput label="Ngủ từ" value={sleepStart} onChange={setSleepStart} size={140} />
              <ClockTimeInput label="Đến" value={sleepEnd} onChange={setSleepEnd} size={140} />
            </div>

            <div style={{ textAlign: 'center', color: '#6366f1', fontWeight: 800, fontSize: '0.88rem' }}>
              {duration(sleepDuration({ sleep_start: sleepStart, sleep_end: sleepEnd, log_date: currentDate }))}
              {sleepEnd <= sleepStart && (
                <small style={{ display: 'block', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>
                  Qua đêm — giờ chia cho {currentDate} và ngày hôm sau
                </small>
              )}
            </div>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>💭 Nằm mơ thấy gì?</span>
              <textarea
                value={dream}
                onChange={(event) => setDream(event.target.value)}
                placeholder="Kể lại giấc mơ nếu bạn nhớ được…"
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  padding: '8px 10px',
                  fontSize: '0.84rem',
                  resize: 'vertical',
                }}
              />
            </label>

            <button
              type="button"
              className="primary"
              onClick={saveSleep}
              style={{ padding: '10px 14px', background: '#6366f1', borderRadius: 10, fontWeight: 700 }}
            >
              {editingSleep ? 'Cập nhật phiên ngủ' : 'Lưu giấc ngủ'}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL CHI TIẾT GIẤC MƠ */}
      {dreamModalLog && (
        <Modal
          onClose={() => setDreamModalLog(null)}
          title={`Ghi chép giấc mơ (${dreamModalLog.sleep_start} → ${dreamModalLog.sleep_end})`}
        >
          <div className="form-grid">
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>💭 Chi tiết giấc mơ</span>
              <textarea
                autoFocus
                value={dreamText}
                onChange={(event) => setDreamText(event.target.value)}
                placeholder="Nhập nội dung giấc mơ của phiên ngủ này…"
                rows={5}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  padding: '10px 12px',
                  fontSize: '0.88rem',
                  resize: 'vertical',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="tv-btn" onClick={() => setDreamModalLog(null)}>
                Huỷ
              </button>
              <button
                type="button"
                className="tv-btn primary"
                onClick={saveDreamOnly}
                style={{ background: '#8b5cf6', borderRadius: 8, fontWeight: 700 }}
              >
                Lưu giấc mơ
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
