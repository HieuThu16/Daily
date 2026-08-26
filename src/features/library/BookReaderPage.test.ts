import { describe, expect, it } from 'vitest'
import { quoteBarTop } from './BookReaderPage'

const VH = 800
const BAR = 52

describe('quoteBarTop', () => {
  it('du cho phia tren thi dat NGAY TREN vung boi den', () => {
    // Boi den o giua man hinh -> thanh nut nam phia tren no
    const top = quoteBarTop(400, VH, BAR)
    expect(top).toBeLessThan(400)
    expect(top).toBeGreaterThan(0)
  })

  it('boi den sat mep tren thi lat XUONG DUOI, khong tran ra ngoai man hinh', () => {
    const top = quoteBarTop(10, VH, BAR)
    expect(top).toBeGreaterThan(10)
    expect(top + BAR).toBeLessThanOrEqual(VH)
  })

  it('boi den sat day thi van nam trong man hinh', () => {
    const top = quoteBarTop(VH - 5, VH, BAR)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + BAR).toBeLessThanOrEqual(VH)
  })

  it('khong do duoc vung chon thi roi ve day nhu cu', () => {
    expect(quoteBarTop(null, VH, BAR)).toBe(VH - BAR - 24)
  })

  it('gia tri hong khong lam vo', () => {
    expect(quoteBarTop(NaN, VH, BAR)).toBe(VH - BAR - 24)
    expect(quoteBarTop(Infinity, VH, BAR)).toBe(VH - BAR - 24)
  })

  it('man hinh rat thap van cho ra so khong am', () => {
    expect(quoteBarTop(null, 30, BAR)).toBeGreaterThanOrEqual(0)
  })

  it('man hinh THAP + boi den sat tren: lat xuong nhung KHONG tran khoi man hinh', () => {
    /*
     * Truong hop duy nhat cham toi nhanh chan tran. Man hinh cao binh thuong
     * thi lat xuong bao nhieu cung con thua cho, nen test o 800px khong chung
     * minh duoc gi - phai ep man hinh thap moi lo ra.
     */
    const vh = 100
    const top = quoteBarTop(20, vh, BAR)
    expect(top + BAR).toBeLessThanOrEqual(vh)
  })
})
