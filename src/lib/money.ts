import type { Account, MoneyTransaction } from '../types'

/** Số dư = số dư ban đầu + tổng thu − tổng chi của đúng ví đó. */
export function accountBalance(account: Account, transactions: MoneyTransaction[]) {
  return transactions
    .filter((tx) => tx.account_id === account.id)
    .reduce((balance, tx) => balance + (tx.direction === 'IN' ? tx.amount : -tx.amount), account.opening_balance ?? 0)
}

export function totalBalance(accounts: Account[], transactions: MoneyTransaction[]) {
  return accounts.reduce((sum, account) => sum + accountBalance(account, transactions), 0)
}

/** Tổng thu / chi trong một khoảng ngày (không truyền `days` thì tính hết). */
export function summarizeMoney(transactions: MoneyTransaction[], days?: string[]) {
  const inRange = days ? transactions.filter((tx) => days.includes(tx.log_date)) : transactions
  const income = inRange.filter((tx) => tx.direction === 'IN').reduce((sum, tx) => sum + tx.amount, 0)
  const expense = inRange.filter((tx) => tx.direction === 'OUT').reduce((sum, tx) => sum + tx.amount, 0)
  return { income, expense, net: income - expense, count: inRange.length }
}

/** Chi tiêu mỗi ngày, để vẽ biểu đồ cột. */
export function expenseByDate(transactions: MoneyTransaction[], days: string[]) {
  const byDate = Object.fromEntries(days.map((day) => [day, 0])) as Record<string, number>
  transactions.forEach((tx) => {
    if (tx.direction === 'OUT' && tx.log_date in byDate) byDate[tx.log_date] += tx.amount
  })
  return byDate
}

/** Chi tiêu theo danh mục, nhiều nhất trước. */
export function expenseByCategory(transactions: MoneyTransaction[]) {
  const totals = new Map<string, number>()
  transactions.forEach((tx) => {
    if (tx.direction === 'OUT') totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount)
  })
  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * '30k' → 30000, '1tr' → 1000000, '1.5tr' → 1500000, '25.000' → 25000.
 * Có đuôi k/tr thì dấu chấm là số thập phân; không có đuôi thì là dấu ngăn nghìn.
 */
export function parseAmount(value: string) {
  const text = value.toLowerCase().replace(/\s/g, '')
  const unit = /(tr|m)$/.test(text) ? 1_000_000 : /k$/.test(text) ? 1_000 : 1
  const digits = unit === 1 ? text.replace(/[.,]/g, '') : text.replace(',', '.')
  return Math.round((Number.parseFloat(digits) || 0) * unit)
}

export function formatMoney(amount: number) {
  return `${amount.toLocaleString('vi-VN')}₫`
}
