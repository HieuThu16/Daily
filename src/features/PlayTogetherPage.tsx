import { useMemo, useState, useEffect } from 'react'
import { Calendar, Gamepad2, History, Pencil, Plus, Star, Trash2, UserPlus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { PlayTogetherAccount, PlayTogetherLog } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'

const TIME_SLOTS = ['07:00', '11:00', '15:00', '19:00', '23:00', '03:00']

export function PlayTogetherPage() {
  const { showToast, showSaveToast } = useToast()
  const accountsQuery = useQuery<PlayTogetherAccount>('playtogether_accounts', 'name')
  const logsQuery = useQuery<PlayTogetherLog>('playtogether_logs')

  const [selectedDate, setSelectedDate] = useState<string>(localDate())
  const [saving, setSaving] = useState(false)
  const [mainAccId, setMainAccId] = useState<string>(() => localStorage.getItem('playtogether_main_acc_id') || '')

  // Modal states
  const [addAccModal, setAddAccModal] = useState(false)
  const [manageAccModal, setManageAccModal] = useState(false)
  const [newAccName, setNewAccName] = useState('')

  // Account Detail & History Modal State
  const [selectedAcc, setSelectedAcc] = useState<PlayTogetherAccount | null>(null)
  const [isEditingAccName, setIsEditingAccName] = useState(false)
  const [editAccName, setEditAccName] = useState('')

  const [activeCellLog, setActiveCellLog] = useState<{
    accountName: string
    timeSlot: string
    log?: PlayTogetherLog
  } | null>(null)

  const [coupons, setCoupons] = useState<number>(0)
  const [gems, setGems] = useState<number>(0)
  const [cards, setCards] = useState<number>(0)

  // Ensure default main account if none selected
  useEffect(() => {
    if (!mainAccId && accountsQuery.items.length > 0) {
      const firstAcc = accountsQuery.items[0]
      setMainAccId(firstAcc.id)
      localStorage.setItem('playtogether_main_acc_id', firstAcc.id)
    }
  }, [accountsQuery.items, mainAccId])

  const setMainAccount = (acc: PlayTogetherAccount) => {
    setMainAccId(acc.id)
    localStorage.setItem('playtogether_main_acc_id', acc.id)
    showToast(`⭐ Đã chọn Acc "${acc.name}" làm Acc Chính!`)
  }

  // Account CRUD
  const addAccount = async () => {
    if (!newAccName.trim()) return
    const name = newAccName.trim()
    const tempId = Date.now().toString()
    const tempAcc: PlayTogetherAccount = { id: tempId, name }

    setSaving(true)
    accountsQuery.setItems((prev) => [...prev.filter((a) => a.name !== name), tempAcc])
    setNewAccName('')
    setAddAccModal(false)

    // Auto set main account if first account
    if (!mainAccId) {
      setMainAccId(tempId)
      localStorage.setItem('playtogether_main_acc_id', tempId)
    }

    const { data, error } = await supabase!.from('playtogether_accounts').insert({ name }).select().single()
    setSaving(false)

    if (!error && data) {
      accountsQuery.setItems((prev) => prev.map((a) => (a.id === tempId ? (data as PlayTogetherAccount) : a)))
      showSaveToast(true, `Acc "${name}"`)
    } else {
      showSaveToast(false, `Acc "${name}"`)
    }
  }

  const renameAccount = async () => {
    if (!selectedAcc || !editAccName.trim()) return
    const oldName = selectedAcc.name
    const newName = editAccName.trim()
    if (oldName === newName) {
      setIsEditingAccName(false)
      return
    }

    setSaving(true)
    accountsQuery.setItems((prev) => prev.map((a) => (a.id === selectedAcc.id ? { ...a, name: newName } : a)))
    logsQuery.setItems((prev) => prev.map((l) => (l.account_name === oldName ? { ...l, account_name: newName } : l)))
    setSelectedAcc((prev) => (prev ? { ...prev, name: newName } : null))
    setIsEditingAccName(false)

    await supabase!.from('playtogether_accounts').update({ name: newName }).eq('id', selectedAcc.id)
    await supabase!.from('playtogether_logs').update({ account_name: newName }).eq('account_name', oldName)
    setSaving(false)

    showToast(`✏️ Đã đổi tên Acc thành: ${newName}!`)
  }

  const deleteAccount = async (acc: PlayTogetherAccount) => {
    accountsQuery.setItems((prev) => prev.filter((a) => a.id !== acc.id))
    logsQuery.setItems((prev) => prev.filter((l) => l.account_name !== acc.name))
    if (selectedAcc?.id === acc.id) setSelectedAcc(null)

    if (mainAccId === acc.id) {
      const remaining = accountsQuery.items.filter((a) => a.id !== acc.id)
      const nextMainId = remaining[0]?.id || ''
      setMainAccId(nextMainId)
      localStorage.setItem('playtogether_main_acc_id', nextMainId)
    }

    await supabase!.from('playtogether_accounts').update({ deleted_at: new Date().toISOString() }).eq('id', acc.id)
    await supabase!.from('playtogether_logs').update({ deleted_at: new Date().toISOString() }).eq('account_name', acc.name)
    showToast(`🗑️ Đã xóa Acc: ${acc.name}`, 'delete')
  }

  const openAccountDetail = (acc: PlayTogetherAccount) => {
    setSelectedAcc(acc)
    setEditAccName(acc.name)
    setIsEditingAccName(false)
  }

  // Open Cell Log Modal
  const openCellModal = (accountName: string, timeSlot: string) => {
    const existing = logsQuery.items.find(
      (l) => l.account_name === accountName && l.log_date === selectedDate && l.time_slot === timeSlot
    )
    setActiveCellLog({ accountName, timeSlot, log: existing })
    setCoupons(existing?.coupons ?? 0)
    setGems(existing?.gems ?? 0)
    setCards(existing?.cards ?? 0)
  }

  // Save Cell Log with Supabase / Local verification
  const saveCellLog = async () => {
    if (!activeCellLog) return
    const { accountName, timeSlot, log } = activeCellLog

    const payload = {
      account_name: accountName,
      log_date: selectedDate,
      time_slot: timeSlot,
      coupons: Math.max(0, coupons || 0),
      gems: Math.max(0, gems || 0),
      cards: Math.max(0, cards || 0),
    }

    setSaving(true)

    if (log) {
      logsQuery.setItems((prev) => prev.map((l) => (l.id === log.id ? { ...l, ...payload } : l)))
      const { error } = await supabase!.from('playtogether_logs').update(payload).eq('id', log.id)
      setSaving(false)
      if (!error) {
        showSaveToast(true, 'chỉ số Play Together')
      } else {
        showSaveToast(false, 'chỉ số Play Together')
      }
    } else {
      const tempId = Date.now().toString()
      logsQuery.setItems((prev) => [{ id: tempId, ...payload }, ...prev])
      const { data, error } = await supabase!.from('playtogether_logs').insert(payload).select().single()
      setSaving(false)
      if (!error && data) {
        logsQuery.setItems((prev) => prev.map((l) => (l.id === tempId ? (data as PlayTogetherLog) : l)))
        showSaveToast(true, 'chỉ số Play Together')
      } else {
        showSaveToast(false, 'chỉ số Play Together')
      }
    }

    setActiveCellLog(null)
  }

  // Delete Log
  const deleteCellLog = async (logId?: string) => {
    const idToDelete = logId ?? activeCellLog?.log?.id
    if (!idToDelete) return

    logsQuery.setItems((prev) => prev.filter((l) => l.id !== idToDelete))
    await supabase!.from('playtogether_logs').update({ deleted_at: new Date().toISOString() }).eq('id', idToDelete)
    if (activeCellLog?.log?.id === idToDelete) setActiveCellLog(null)
    showToast('🗑️ Đã xóa bản ghi', 'delete')
  }

  // Calculate Daily Totals across all accounts for selected date
  const dailyTotals = useMemo(() => {
    const logsForDay = logsQuery.items.filter((l) => l.log_date === selectedDate)
    const totalCoupons = logsForDay.reduce((sum, l) => sum + (l.coupons || 0), 0)
    const totalGems = logsForDay.reduce((sum, l) => sum + (l.gems || 0), 0)
    const totalCards = logsForDay.reduce((sum, l) => sum + (l.cards || 0), 0)
    return { totalCoupons, totalGems, totalCards }
  }, [logsQuery.items, selectedDate])

  // Calculate Account Row Totals for selected date
  const getAccRowTotals = (accName: string) => {
    const logsForAcc = logsQuery.items.filter((l) => l.account_name === accName && l.log_date === selectedDate)
    const coupons = logsForAcc.reduce((sum, l) => sum + (l.coupons || 0), 0)
    const gems = logsForAcc.reduce((sum, l) => sum + (l.gems || 0), 0)
    const cards = logsForAcc.reduce((sum, l) => sum + (l.cards || 0), 0)
    return { coupons, gems, cards }
  }

  // Calculate Account All-Time Totals across all dates
  const getAccAllTimeTotals = (accName: string) => {
    const logsForAcc = logsQuery.items.filter((l) => l.account_name === accName)
    const coupons = logsForAcc.reduce((sum, l) => sum + (l.coupons || 0), 0)
    const gems = logsForAcc.reduce((sum, l) => sum + (l.gems || 0), 0)
    const cards = logsForAcc.reduce((sum, l) => sum + (l.cards || 0), 0)
    return { coupons, gems, cards, count: logsForAcc.length }
  }

  // Calculate Time Slot Column Totals for selected date
  const getSlotColumnTotals = (slot: string) => {
    const logsForSlot = logsQuery.items.filter((l) => l.log_date === selectedDate && l.time_slot === slot)
    const coupons = logsForSlot.reduce((sum, l) => sum + (l.coupons || 0), 0)
    const gems = logsForSlot.reduce((sum, l) => sum + (l.gems || 0), 0)
    const cards = logsForSlot.reduce((sum, l) => sum + (l.cards || 0), 0)
    return { coupons, gems, cards }
  }

  // Get full sorted history logs for selected account
  const selectedAccHistory = useMemo(() => {
    if (!selectedAcc) return []
    return logsQuery.items
      .filter((l) => l.account_name === selectedAcc.name)
      .sort((a, b) => {
        if (a.log_date !== b.log_date) return b.log_date.localeCompare(a.log_date)
        return b.time_slot.localeCompare(a.time_slot)
      })
  }, [selectedAcc, logsQuery.items])

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header & Responsive Controls */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="icon-box icon-box-cyan" style={{ width: 26, height: 26 }}>
              <Gamepad2 size={15} />
            </div>
            <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Play Together</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-main)', padding: '2px 6px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
            <Calendar size={12} style={{ color: 'var(--primary)' }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 0, background: 'transparent', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', width: 105 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button className="primary" onClick={() => { setNewAccName(''); setAddAccModal(true) }} style={{ padding: '4px 10px', fontSize: '0.76rem', gap: 3 }}>
            <UserPlus size={12} /> + Thêm Acc
          </button>
          <button className="icon" aria-label="Quản lý Acc" onClick={() => setManageAccModal(true)} style={{ padding: 4, fontSize: '0.76rem', gap: 3, display: 'flex', alignItems: 'center' }} title="Quản lý Acc">
            <Users size={14} /> Acc ({accountsQuery.items.length})
          </button>
        </div>
      </div>

      {/* Main Grid Table Container */}
      <div className="card" style={{ padding: 8, margin: 0 }}>
        {!accountsQuery.items.length ? (
          <Empty icon={Gamepad2} colorClass="icon-box-cyan">
            Chưa có Acc Play Together nào. Bấm "+ Thêm Acc" ở trên để tạo mới nhé!
          </Empty>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', minHeight: '340px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '2px solid var(--card-border)', background: 'var(--card-bg)', position: 'sticky', top: 0, zIndex: 3, minWidth: 85 }}>
                    Acc (Click xem)
                  </th>
                  {TIME_SLOTS.map((slot) => (
                    <th key={slot} style={{ textAlign: 'center', padding: '5px 2px', borderBottom: '2px solid var(--card-border)', background: 'var(--card-bg)', position: 'sticky', top: 0, zIndex: 3, minWidth: 54 }}>
                      {slot}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '5px 4px', borderBottom: '2px solid var(--card-border)', background: 'var(--card-bg)', position: 'sticky', top: 0, zIndex: 3, minWidth: 75, color: 'var(--primary)' }}>
                    Tổng Acc
                  </th>
                </tr>
              </thead>
              <tbody>
                {accountsQuery.items.map((acc) => {
                  const accTotals = getAccRowTotals(acc.name)
                  const isMain = acc.id === mainAccId

                  return (
                    <tr key={acc.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      {/* Clicking Acc Name Opens Detail & History Modal */}
                      <td style={{ padding: '4px 6px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap', fontSize: '0.74rem', cursor: 'pointer' }} onClick={() => openAccountDetail(acc)}>
                        <span style={{ borderBottom: '1px dashed var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {isMain && <Star size={11} fill="var(--amber)" color="var(--amber)" />}
                          {acc.name}
                        </span>
                      </td>

                      {TIME_SLOTS.map((slot) => {
                        const log = logsQuery.items.find(
                          (l) => l.account_name === acc.name && l.log_date === selectedDate && l.time_slot === slot
                        )

                        return (
                          <td key={slot} style={{ textAlign: 'center', padding: '3px 1px' }}>
                            {log ? (
                              <button
                                onClick={() => openCellModal(acc.name, slot)}
                                style={{
                                  width: '100%',
                                  border: '1px solid var(--primary-light)',
                                  background: 'var(--primary-light)',
                                  color: 'var(--primary)',
                                  borderRadius: 5,
                                  padding: '2px 1px',
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 0,
                                  minWidth: 52,
                                }}
                              >
                                <span>🎟️{log.coupons} 💎{log.gems}</span>
                                <span style={{ color: 'var(--purple)', fontSize: '0.58rem' }}>🎴{log.cards}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => openCellModal(acc.name, slot)}
                                style={{
                                  width: 22,
                                  height: 20,
                                  border: '1px dashed var(--card-border)',
                                  background: 'var(--bg-main)',
                                  color: 'var(--text-muted)',
                                  borderRadius: 5,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                                title={`Thêm chỉ số ${acc.name} lúc ${slot}`}
                              >
                                <Plus size={11} />
                              </button>
                            )}
                          </td>
                        )
                      })}

                      {/* Total For This Acc Row */}
                      <td style={{ textAlign: 'center', padding: '4px 2px', background: 'var(--bg-main)', fontWeight: 700, fontSize: '0.6rem' }}>
                        <div>🎟️{accTotals.coupons} 💎{accTotals.gems}</div>
                        <div style={{ color: 'var(--purple)' }}>🎴{accTotals.cards} thẻ</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Bottom Sticky Table Footer */}
              <tfoot>
                <tr style={{ background: 'var(--primary-light)', fontWeight: 800, borderTop: '2px solid var(--primary)' }}>
                  <td style={{ padding: '6px 6px', color: 'var(--primary)', whiteSpace: 'nowrap', fontSize: '0.74rem' }}>
                    TỔNG GIỜ
                  </td>

                  {TIME_SLOTS.map((slot) => {
                    const slotTot = getSlotColumnTotals(slot)
                    return (
                      <td key={slot} style={{ textAlign: 'center', padding: '4px 1px', fontSize: '0.6rem', color: 'var(--primary)' }}>
                        <div>🎟️{slotTot.coupons}</div>
                        <div>💎{slotTot.gems}</div>
                      </td>
                    )
                  })}

                  <td style={{ textAlign: 'center', padding: '4px 2px', color: 'var(--primary)', fontSize: '0.6rem' }}>
                    <div>🎟️{dailyTotals.totalCoupons}</div>
                    <div>💎{dailyTotals.totalGems}</div>
                    <div style={{ color: 'var(--purple)' }}>🎴{dailyTotals.totalCards}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* DAILY TOTAL SUMMARY DASHBOARD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
        <div className="stat-card" style={{ padding: '6px 8px', background: 'var(--amber-bg)', borderColor: 'var(--amber)' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--amber)' }}>🎟️ {dailyTotals.totalCoupons}</div>
          <div className="stat-lbl" style={{ fontSize: '0.68rem', fontWeight: 700 }}>Vé Coupon ngày</div>
        </div>

        <div className="stat-card" style={{ padding: '6px 8px', background: 'var(--cyan-bg)', borderColor: 'var(--cyan)' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--cyan)' }}>💎 {dailyTotals.totalGems}</div>
          <div className="stat-lbl" style={{ fontSize: '0.68rem', fontWeight: 700 }}>KC (Gems) ngày</div>
        </div>

        <div className="stat-card" style={{ padding: '6px 8px', background: 'var(--purple-bg)', borderColor: 'var(--purple)' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--purple)' }}>🎴 {dailyTotals.totalCards}</div>
          <div className="stat-lbl" style={{ fontSize: '0.68rem', fontWeight: 700 }}>Tổng Thẻ ngày</div>
        </div>
      </div>

      {/* Modal 1: Add Acc Modal */}
      {addAccModal && (
        <Modal title="Thêm Acc Play Together" onClose={() => setAddAccModal(false)}>
          <label>
            Tên Acc (Tài khoản)
            <input value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="Nhập tên Acc..." autoFocus />
          </label>
          <div className="modal-actions">
            <button className="primary" onClick={addAccount} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Tạo Acc'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal 2: Manage Accs Modal */}
      {manageAccModal && (
        <Modal title="Danh sách Acc Play Together" onClose={() => setManageAccModal(false)}>
          <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
            {accountsQuery.items.map((acc) => {
              const isMain = acc.id === mainAccId

              return (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', color: 'var(--primary)' }} onClick={() => { setManageAccModal(false); openAccountDetail(acc); }}>
                      {acc.name}
                    </span>
                    {isMain ? (
                      <span style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 5px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <Star size={10} fill="currentColor" /> Acc Chính
                      </span>
                    ) : (
                      <button
                        onClick={() => setMainAccount(acc)}
                        style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Đặt làm Acc chính
                      </button>
                    )}
                  </div>
                  <DeleteButton onDelete={() => deleteAccount(acc)} />
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {/* Modal 3: Account Detail & Full History Modal */}
      {selectedAcc && (
        <Modal title={`Chi tiết & Lịch sử Acc: ${selectedAcc.name}`} onClose={() => setSelectedAcc(null)}>
          {/* Account Edit & Main Acc Button Header */}
          <div style={{ background: 'var(--bg-main)', padding: 10, borderRadius: 10, marginBottom: 10, border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              {isEditingAccName ? (
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  <input
                    value={editAccName}
                    onChange={(e) => setEditAccName(e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.86rem', fontWeight: 700 }}
                    autoFocus
                  />
                  <button className="primary" onClick={renameAccount} disabled={saving} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                    Lưu tên
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>{selectedAcc.name}</span>
                  <button className="icon small" aria-label="Đổi tên Acc" onClick={() => setIsEditingAccName(true)} title="Đổi tên Acc" style={{ padding: 3 }}>
                    <Pencil size={13} />
                  </button>

                  {/* Main Account Star Button */}
                  {selectedAcc.id === mainAccId ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Star size={11} fill="currentColor" /> Acc Chính
                    </span>
                  ) : (
                    <button
                      onClick={() => setMainAccount(selectedAcc)}
                      style={{ background: 'var(--card-bg)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 6, padding: '2px 6px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      <Star size={11} /> Đặt Acc Chính
                    </button>
                  )}
                </div>
              )}

              {!isEditingAccName && (
                <button
                  onClick={() => deleteAccount(selectedAcc)}
                  style={{ background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: 6, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <Trash2 size={12} /> Xóa Acc
                </button>
              )}
            </div>

            {/* All Time Cumulative Stats */}
            {(() => {
              const allTime = getAccAllTimeTotals(selectedAcc.name)
              return (
                <div style={{ display: 'flex', gap: 8, fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>
                  <span>🎟️ {allTime.coupons} coupon</span>
                  <span>• 💎 {allTime.gems} KC</span>
                  <span>• 🎴 {allTime.cards} thẻ</span>
                  <span style={{ color: 'var(--text-muted)' }}>({allTime.count} bản ghi)</span>
                </div>
              )
            })()}
          </div>

          {/* Full History Records List */}
          <div style={{ marginBottom: 6, fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <History size={14} style={{ color: 'var(--primary)' }} /> Lịch sử hoạt động ({selectedAccHistory.length})
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: 6 }}>
            {!selectedAccHistory.length ? (
              <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center', margin: '10px 0' }}>
                Acc này chưa có lịch sử ghi nhận nào.
              </p>
            ) : (
              selectedAccHistory.map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary)' }}>
                      📅 {l.log_date} | ⏰ {l.time_slot}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, marginTop: 1 }}>
                      🎟️ {l.coupons} vé • 💎 {l.gems} KC • 🎴 {l.cards} thẻ
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="icon small"
                      aria-label="Sửa bản ghi"
                      onClick={() => {
                        setSelectedDate(l.log_date)
                        openCellModal(l.account_name, l.time_slot)
                      }}
                      style={{ padding: 3 }}
                    >
                      <Pencil size={12} />
                    </button>
                    <DeleteButton onDelete={() => deleteCellLog(l.id)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Modal 4: Enter / Edit Cell Log */}
      {activeCellLog && (
        <Modal title={`Chỉ số: ${activeCellLog.accountName} (${activeCellLog.timeSlot})`} onClose={() => setActiveCellLog(null)}>
          <label>
            🎟️ Số vé coupon
            <input type="number" value={coupons} onChange={(e) => setCoupons(Number.parseInt(e.target.value, 10) || 0)} placeholder="0" autoFocus />
          </label>

          <label>
            💎 Số KC (Kim cương / Gems)
            <input type="number" value={gems} onChange={(e) => setGems(Number.parseInt(e.target.value, 10) || 0)} placeholder="0" />
          </label>

          <label>
            🎴 Số thẻ (Cards)
            <input type="number" value={cards} onChange={(e) => setCards(Number.parseInt(e.target.value, 10) || 0)} placeholder="0" />
          </label>

          <div className="modal-actions">
            {activeCellLog.log ? <DeleteButton onDelete={() => deleteCellLog()} /> : <div />}
            <button className="primary" onClick={saveCellLog} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu chỉ số'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
