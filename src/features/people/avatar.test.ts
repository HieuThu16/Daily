import { describe, expect, it } from 'vitest'
import { avatarStyle, avatarTone, initials } from './avatar'

describe('initials', () => {
  it('lấy chữ cái đầu của từ đầu và từ cuối', () => {
    expect(initials('Nguyễn Thuỳ Linh')).toBe('NL')
  })

  it('tên một từ chỉ trả một chữ', () => {
    expect(initials('Linh')).toBe('L')
  })

  it('bỏ khoảng trắng thừa', () => {
    expect(initials('  Minh   Anh  ')).toBe('MA')
  })

  it('tên rỗng trả dấu hỏi', () => {
    expect(initials('   ')).toBe('?')
  })
})

describe('avatarTone', () => {
  it('cùng một tên luôn ra cùng màu', () => {
    expect(avatarTone('Linh')).toBe(avatarTone('Linh'))
  })

  it('luôn nằm trong bảng màu cho trước', () => {
    const tones = ['Linh', 'Minh', 'An', 'Bảo', 'Chi', 'Dũng', ''].map(avatarTone)
    for (const tone of tones) {
      expect(['blue', 'amber', 'emerald', 'purple', 'rose', 'cyan']).toContain(tone)
    }
  })
})

describe('avatarStyle', () => {
  it('trả về biến màu token tương ứng', () => {
    const tone = avatarTone('Linh')
    expect(avatarStyle('Linh')).toEqual({ background: `var(--${tone}-bg)`, color: `var(--${tone})` })
  })
})
