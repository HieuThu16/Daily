import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronLeft, ChevronRight, Landmark, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { accountBalance, expenseByCategory, expenseByDate, formatMoney, parseAmount, summarizeMoney, totalBalance } from '../lib/money'
import { getPeriodRange, shiftPeriodAnchor, type PeriodMode } from './nutrition/periodData'
import type { Account, MoneyTransaction, Person } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { useHeaderAction } from './HeaderAction'

const CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: 'FOOD', label: 'Ăn uống', emoji: '🍜' },
  { id: 'TRANSPORT', label: 'Đi lại', emoji: '🛵' },
  { id: 'SHOPPING', label: 'Mua sắm', emoji: '🛍️' },
  { id: 'BILL', label: 'Hoá đơn', emoji: '🧾' },
  { id: 'FUN', label: 'Giải trí', emoji: '🎬' },
  { id: 'HEALTH', label: 'Sức khoẻ', emoji: '💊' },
  { id: 'SALARY', label: 'Lương', emoji: '💰' },
  { id: 'OTHER', label: 'Khác', emoji: '📦' },
]

const MODES: { id: PeriodMode; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
]

const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
const shortDay = (day: string) => `${Number(day.split('-')[2])}/${Number(day.split('-')[1])}`

export function MoneyPage() {
  const { showToast } = useToast()
  const accountsQuery = useQuery<Account>('accounts', 'created_at')
  const { items: transactions, setItems: setTransactions, loading } = useQuery<MoneyTransaction>('transactions')
  const peopleQuery = useQuery<Person>('people', 'name')
  const personName = (id?: string | null) => peopleQuery.items.find((p) => p.id === id)?.name ?? null

  const [mode, setMode] = useState<PeriodMode>('month')
  const [anchor, setAnchor] = useState(localDate())

  const [txModal, setTxModal] = useState<MoneyTransaction | 'new' | null>(null)
  const [direction, setDirection] = useState<'IN' | 'OUT'>('OUT')
  const [amountText, setAmountText] = useState('')
  const [category, setCategory] = useState('FOOD')
  const [note, setNote] = useState('')
  const [accountId, setAccountId] = useState('')
  const [logDate, setLogDate] = useState(localDate())
  const [personId, setPersonId] = useState('')

  const [accountModal, setAccountModal] = useState<Account | 'new' | null>(null)
  const [accName, setAccName] = useState('')
  const [accKind, setAccKind] = useState<'CASH' | 'BANK'>('CASH')
  const [accBank, setAccBank] = useState('')
  const [accNumber, setAccNumber] = useState('')
  const [accOpening, setAccOpening] = useState('')

  const accounts = accountsQuery.items
  const range = useMemo(() => getPeriodRange(anchor, mode), [anchor, mode])
  const inRange = useMemo(() => transactions.filter((tx) => range.days.includes(tx.log_date)), [transactions, range.days])
  const summary = useMemo(() => summarizeMoney(inRange), [inRange])
  const byDate = useMemo(() => expenseByDate(inRange, range.days), [inRange, range.days])
  const byCategory = useMemo(() => expenseByCategory(inRange), [inRange])
  const maxDay = Math.max(...Object.values(byDate), 1)

  const openNewTx = () => {
    if (!accounts.length) {
      showToast('⚠️ Tạo ví trước đã (Tiền mặt hoặc ngân hàng)', 'info')
      setAccountModal('new')
      return
    }
    setTxModal('new')
    setDirection('OUT')
    setAmountText('')
    setCategory('FOOD')
    setNote('')
    setAccountId(accounts[0].id)
    setLogDate(localDate())
    setPersonId('')
  }
  useHeaderAction('Ghi khoản tiền', openNewTx)

  const openEditTx = (tx: MoneyTransaction) => {
    setTxModal(tx)
    setDirection(tx.direction)
    setAmountText(String(tx.amount))
    setCategory(tx.category)
    setNote(tx.note ?? '')
    setAccountId(tx.account_id)
    setLogDate(tx.log_date)
    setPersonId(tx.person_id ?? '')
  }

  const saveTx = async () => {
    const amount = parseAmount(amountText)
    if (amount <= 0) return showToast('⚠️ Nhập số tiền đã (vd 30k)', 'info')
    if (!accountId) return showToast('⚠️ Chọn ví', 'info')
    const payload = {
      account_id: accountId,
      direction,
      amount,
      category,
      note: note.trim() || null,
      log_date: logDate,
      person_id: personId || null,
    }
    const editing = txModal !== 'new' ? txModal : null

    if (editing) {
      const { error } = await supabase!.from('transactions').update(payload).eq('id', editing.id)
      if (error) return showToast('❌ Chưa lưu được. Chạy migration money chưa?', 'delete')
      setTransactions((prev) => prev.map((tx) => (tx.id === editing.id ? { ...tx, ...payload } : tx)))
    } else {
      const { data, error } = await supabase!.from('transactions').insert(payload).select().single()
      if (error || !data) return showToast('❌ Chưa lưu được. Chạy migration money chưa?', 'delete')
      setTransactions((prev) => [data as MoneyTransaction, ...prev])
    }
    showToast(`${direction === 'OUT' ? '➖' : '➕'} ${formatMoney(amount)} · ${accounts.find((a) => a.id === accountId)?.name}`)
    setTxModal(null)
  }

  const deleteTx = async (id: string) => {
    await supabase!.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setTransactions((prev) => prev.filter((tx) => tx.id !== id))
    setTxModal(null)
    showToast('🗑️ Đã xoá khoản này', 'delete')
  }

  const openNewAccount = () => {
    setAccountModal('new')
    setAccName('')
    setAccKind('CASH')
    setAccBank('')
    setAccNumber('')
    setAccOpening('')
  }

  const openEditAccount = (account: Account) => {
    setAccountModal(account)
    setAccName(account.name)
    setAccKind(account.kind)
    setAccBank(account.bank_name ?? '')
    setAccNumber(account.account_number ?? '')
    setAccOpening(String(account.opening_balance ?? 0))
  }

  const saveAccount = async () => {
    if (!accName.trim()) return showToast('⚠️ Đặt tên cho ví', 'info')
    const payload = {
      name: accName.trim(),
      kind: accKind,
      bank_name: accKind === 'BANK' ? accBank.trim() || null : null,
      account_number: accKind === 'BANK' ? accNumber.trim() || null : null,
      opening_balance: parseAmount(accOpening),
    }
    const editing = accountModal !== 'new' ? accountModal : null

    if (editing) {
      const { error } = await supabase!.from('accounts').update(payload).eq('id', editing.id)
      if (error) return showToast('❌ Chưa lưu được. Chạy migration money chưa?', 'delete')
      accountsQuery.setItems((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...payload } : a)))
    } else {
      const { data, error } = await supabase!.from('accounts').insert(payload).select().single()
      if (error || !data) return showToast('❌ Chưa lưu được. Chạy migration money chưa?', 'delete')
      accountsQuery.setItems((prev) => [...prev, data as Account])
    }
    showToast('✅ Đã lưu ví')
    setAccountModal(null)
  }

  const deleteAccount = async (id: string) => {
    await supabase!.from('accounts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    accountsQuery.setItems((prev) => prev.filter((a) => a.id !== id))
    setAccountModal(null)
    showToast('🗑️ Đã xoá ví (các khoản đã ghi vẫn còn)', 'delete')
  }

  return (
    <section className="page-shell is-narrow" style={{ display: 'grid', gap: 10 }}>
      {/* Tổng số dư + từng ví */}
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <small style={{ color: 'var(--text-muted)' }}>Tổng số dư</small>
          <strong style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>{formatMoney(totalBalance(accounts, transactions))}</strong>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => openEditAccount(account)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}
            >
              <div className="icon-box icon-box-sm" style={{ width: 26, height: 26 }}>
                {account.kind === 'CASH' ? <Banknote size={14} /> : <Landmark size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '0.86rem' }}>{account.name}</strong>
                {account.kind === 'BANK' && (
                  <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                    {[account.bank_name, account.account_number].filter(Boolean).join(' · ') || 'Chưa có số tài khoản'}
                  </small>
                )}
              </div>
              <b style={{ color: accountBalance(account, transactions) < 0 ? '#ef4444' : 'var(--text-main)' }}>
                {formatMoney(accountBalance(account, transactions))}
              </b>
            </button>
          ))}
          <button type="button" onClick={openNewAccount} style={{ border: '1px dashed var(--card-border)', background: 'transparent', borderRadius: 10, padding: '7px 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <Wallet size={13} /> Thêm ví / tài khoản ngân hàng
          </button>
        </div>
      </div>

      {/* Khoảng thời gian */}
      <div className="task-view-tabs" role="tablist" aria-label="Khoảng thời gian" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {MODES.map((item) => (
          <button key={item.id} role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'on' : undefined} onClick={() => setMode(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="icon small" aria-label="Khoảng trước" onClick={() => setAnchor((c) => shiftPeriodAnchor(c, mode, -1))}><ChevronLeft size={16} /></button>
        <strong style={{ fontSize: '0.82rem' }}>{range.start === range.end ? shortDay(range.start) : `${shortDay(range.start)} – ${shortDay(range.end)}`}</strong>
        <button className="icon small" aria-label="Khoảng sau" onClick={() => setAnchor((c) => shiftPeriodAnchor(c, mode, 1))}><ChevronRight size={16} /></button>
      </div>

      <div className="nutrition-period-summary">
        <div><strong style={{ color: '#ef4444' }}>{formatMoney(summary.expense)}</strong><span>Đã chi</span></div>
        <div><strong style={{ color: '#10b981' }}>{formatMoney(summary.income)}</strong><span>Đã thu</span></div>
        <div><strong style={{ color: summary.net < 0 ? '#ef4444' : '#2563eb' }}>{formatMoney(summary.net)}</strong><span>Chênh lệch</span></div>
      </div>

      <div className="nutrition-period-card">
        <h3>📉 Chi tiêu theo ngày</h3>
        <div className="nutrition-chart-scroll">
          <div className="nutrition-period-chart" style={{ minWidth: range.days.length > 10 ? range.days.length * 28 : undefined }}>
            {range.days.map((day) => {
              const value = byDate[day]
              return (
                <div key={day} className="nutrition-chart-column" aria-label={`Ngày ${shortDay(day)}: ${formatMoney(value)}`}>
                  <span>{value ? `${Math.round(value / 1000)}k` : '—'}</span>
                  <div><i style={{ height: `${value ? Math.max(5, (value / maxDay) * 100) : 0}%`, background: value ? '#ef4444' : undefined }} /></div>
                  <small>{shortDay(day)}</small>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="nutrition-period-card">
          <h3>🗂️ Theo danh mục</h3>
          {byCategory.map(([id, total]) => (
            <div key={id} className="nutrition-history-row">
              <span className="nutrition-history-icon">{categoryOf(id).emoji}</span>
              <div><strong>{categoryOf(id).label}</strong></div>
              <b>{formatMoney(total)}</b>
            </div>
          ))}
        </div>
      )}

      {/* Lịch sử giao dịch */}
      {loading ? (
        <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải…</p>
      ) : inRange.length ? (
        <div className="nutrition-period-card">
          <h3>🧾 Các khoản đã ghi</h3>
          {[...inRange].sort((a, b) => b.log_date.localeCompare(a.log_date)).map((tx) => {
            const account = accounts.find((a) => a.id === tx.account_id)
            return (
              <button key={tx.id} type="button" onClick={() => openEditTx(tx)} className="nutrition-history-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}>
                <span className="nutrition-history-icon">{categoryOf(tx.category).emoji}</span>
                <div>
                  <strong>{tx.note || categoryOf(tx.category).label}</strong>
                  <small>
                    {shortDay(tx.log_date)} · {account?.name ?? 'Ví đã xoá'}
                    {personName(tx.person_id) ? ` · 👤 ${personName(tx.person_id)}` : ''}
                  </small>
                </div>
                <b style={{ color: tx.direction === 'OUT' ? '#ef4444' : '#10b981' }}>
                  {tx.direction === 'OUT' ? '−' : '+'}{formatMoney(tx.amount)}
                </b>
              </button>
            )
          })}
        </div>
      ) : (
        <Empty icon={Wallet} colorClass="icon-box-emerald">Chưa có khoản nào trong khoảng này.</Empty>
      )}

      {/* Modal ghi thu / chi */}
      {txModal && (
        <Modal title={txModal === 'new' ? 'Ghi khoản tiền' : 'Sửa khoản tiền'} onClose={() => setTxModal(null)}>
          <div className="task-view-tabs" role="tablist" aria-label="Loại giao dịch">
            <button role="tab" aria-selected={direction === 'OUT'} className={direction === 'OUT' ? 'on' : undefined} onClick={() => setDirection('OUT')}>
              <ArrowUpRight size={14} /> Chi ra
            </button>
            <button role="tab" aria-selected={direction === 'IN'} className={direction === 'IN' ? 'on' : undefined} onClick={() => setDirection('IN')}>
              <ArrowDownLeft size={14} /> Thu vào
            </button>
          </div>

          <label>
            Số tiền
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="30k, 1tr, 25.000…" autoFocus inputMode="decimal" />
          </label>
          {parseAmount(amountText) > 0 && (
            <div style={{ textAlign: 'center', fontWeight: 800, color: direction === 'OUT' ? '#ef4444' : '#10b981' }}>
              {direction === 'OUT' ? '−' : '+'}{formatMoney(parseAmount(amountText))}
            </div>
          )}

          <label>
            {direction === 'OUT' ? 'Trừ vào ví' : 'Cộng vào ví'}
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.kind === 'CASH' ? '💵' : '🏦'} {account.name} · {formatMoney(accountBalance(account, transactions))}
                </option>
              ))}
            </select>
          </label>

          <label>
            Danh mục
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
            </select>
          </label>

          {/* Gắn người: để biết đã chi bao nhiêu cho ai, xem lại ở trang Người. */}
          <label>
            {direction === 'OUT' ? 'Chi cho ai' : 'Nhận từ ai'}
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Không gắn ai</option>
              {peopleQuery.items.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>

          <label>
            Ghi chú
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ăn trưa…" />
          </label>

          <label>
            Ngày
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          </label>

          <div className="modal-actions">
            {txModal !== 'new' ? <DeleteButton onDelete={() => deleteTx(txModal.id)} /> : <div />}
            <button className="primary" onClick={saveTx}>Lưu</button>
          </div>
        </Modal>
      )}

      {/* Modal ví */}
      {accountModal && (
        <Modal title={accountModal === 'new' ? 'Thêm ví' : 'Sửa ví'} onClose={() => setAccountModal(null)}>
          <div className="task-view-tabs" role="tablist" aria-label="Loại ví">
            <button role="tab" aria-selected={accKind === 'CASH'} className={accKind === 'CASH' ? 'on' : undefined} onClick={() => setAccKind('CASH')}>
              <Banknote size={14} /> Tiền mặt
            </button>
            <button role="tab" aria-selected={accKind === 'BANK'} className={accKind === 'BANK' ? 'on' : undefined} onClick={() => setAccKind('BANK')}>
              <Landmark size={14} /> Ngân hàng
            </button>
          </div>

          <label>
            Tên ví
            <input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder={accKind === 'CASH' ? 'Tiền mặt' : 'VCB chính'} autoFocus />
          </label>

          {accKind === 'BANK' && (
            <>
              <label>
                Ngân hàng
                <input value={accBank} onChange={(e) => setAccBank(e.target.value)} placeholder="Vietcombank" />
              </label>
              <label>
                Số tài khoản (nhập tay, app không kết nối ngân hàng)
                <input value={accNumber} onChange={(e) => setAccNumber(e.target.value)} placeholder="0123456789" inputMode="numeric" />
              </label>
            </>
          )}

          <label>
            Số dư ban đầu
            <input value={accOpening} onChange={(e) => setAccOpening(e.target.value)} placeholder="500k" inputMode="decimal" />
          </label>

          <div className="modal-actions">
            {accountModal !== 'new' ? <DeleteButton onDelete={() => deleteAccount(accountModal.id)} /> : <div />}
            <button className="primary" onClick={saveAccount}>Lưu ví</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
