import { describe, expect, it } from 'vitest'
import type { Account, MoneyTransaction } from '../types'
import { accountBalance, expenseByCategory, expenseByDate, parseAmount, summarizeMoney, totalBalance } from './money'

const cash: Account = { id: 'a1', name: 'Tiền mặt', kind: 'CASH', opening_balance: 500_000 }
const bank: Account = { id: 'a2', name: 'VCB', kind: 'BANK', bank_name: 'Vietcombank', account_number: '0123456789', opening_balance: 2_000_000 }

const txs: MoneyTransaction[] = [
  { id: 't1', account_id: 'a1', direction: 'OUT', amount: 30_000, category: 'FOOD', note: 'Ăn trưa', log_date: '2026-08-13' },
  { id: 't2', account_id: 'a1', direction: 'OUT', amount: 20_000, category: 'TRANSPORT', log_date: '2026-08-13' },
  { id: 't3', account_id: 'a2', direction: 'IN', amount: 10_000_000, category: 'SALARY', log_date: '2026-08-12' },
  { id: 't4', account_id: 'a2', direction: 'OUT', amount: 500_000, category: 'FOOD', log_date: '2026-08-12' },
]

describe('accountBalance', () => {
  it('trừ đúng ví đã chọn, không đụng ví khác', () => {
    expect(accountBalance(cash, txs)).toBe(450_000) // 500k − 30k − 20k
    expect(accountBalance(bank, txs)).toBe(11_500_000) // 2tr + 10tr − 500k
  })

  it('cộng tổng các ví', () => {
    expect(totalBalance([cash, bank], txs)).toBe(11_950_000)
  })
})

describe('summarizeMoney', () => {
  it('tách thu và chi', () => {
    expect(summarizeMoney(txs)).toEqual({ income: 10_000_000, expense: 550_000, net: 9_450_000, count: 4 })
  })

  it('lọc theo khoảng ngày', () => {
    expect(summarizeMoney(txs, ['2026-08-13'])).toMatchObject({ income: 0, expense: 50_000, count: 2 })
  })
})

describe('expenseByDate / expenseByCategory', () => {
  it('chỉ cộng khoản chi', () => {
    expect(expenseByDate(txs, ['2026-08-12', '2026-08-13'])).toEqual({ '2026-08-12': 500_000, '2026-08-13': 50_000 })
  })

  it('gộp theo danh mục, nhiều nhất trước', () => {
    expect(expenseByCategory(txs)).toEqual([['FOOD', 530_000], ['TRANSPORT', 20_000]])
  })
})

describe('parseAmount', () => {
  it('hiểu k, tr và dấu chấm ngăn nghìn', () => {
    expect(parseAmount('30k')).toBe(30_000)
    expect(parseAmount('1tr')).toBe(1_000_000)
    expect(parseAmount('1.5tr')).toBe(1_500_000)
    expect(parseAmount('25.000')).toBe(25_000)
    expect(parseAmount('')).toBe(0)
  })
})
