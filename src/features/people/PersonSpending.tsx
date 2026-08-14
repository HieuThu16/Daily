import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatMoney } from '../../lib/money'
import type { MoneyTransaction } from '../../types'

const shortDay = (day: string) => `${Number(day.split('-')[2])}/${Number(day.split('-')[1])}`

/** Đã chi bao nhiêu cho người này — số liệu từ các khoản tiền được gắn tên họ. */
export function PersonSpending({ personId }: { personId: string }) {
  const [rows, setRows] = useState<MoneyTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase
      .from('transactions')
      .select('*')
      .eq('person_id', personId)
      .is('deleted_at', null)
      .order('log_date', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setRows((data ?? []) as MoneyTransaction[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [personId])

  if (loading) return null

  const out = rows.filter((r) => r.direction === 'OUT').reduce((sum, r) => sum + r.amount, 0)
  const inn = rows.filter((r) => r.direction === 'IN').reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="nutrition-period-card">
      <h3>💸 Tiền bạc với người này</h3>

      {rows.length === 0 ? (
        <div className="nutrition-period-empty">
          Chưa có khoản nào gắn tên người này. Ghi khoản tiền ở trang Tiền rồi chọn họ ở ô "Chi cho ai".
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, padding: '4px 2px 10px' }}>
            <div>
              <small style={{ color: 'var(--text-muted)' }}>Đã chi</small>
              <div style={{ fontWeight: 800, color: '#ef4444' }}>{formatMoney(out)}</div>
            </div>
            {inn > 0 && (
              <div>
                <small style={{ color: 'var(--text-muted)' }}>Đã nhận</small>
                <div style={{ fontWeight: 800, color: '#10b981' }}>{formatMoney(inn)}</div>
              </div>
            )}
          </div>

          {rows.slice(0, 8).map((row) => (
            <div key={row.id} className="nutrition-history-row">
              <span className="nutrition-history-icon"><Wallet size={15} /></span>
              <div>
                <strong>{row.note || row.category}</strong>
                <small>{shortDay(row.log_date)}</small>
              </div>
              <b style={{ color: row.direction === 'OUT' ? '#ef4444' : '#10b981' }}>
                {row.direction === 'OUT' ? '−' : '+'}{formatMoney(row.amount)}
              </b>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
