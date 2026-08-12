import { describe, expect, it } from 'vitest'
import type { TextLine } from './types'
import {
  cleanBookLines,
  dehyphenate,
  isPageNumberLine,
  joinParagraphs,
  linesToContent,
  normalizeUnicode,
  stripRunningHeads,
} from './cleanText'

function line(text: string, extra: Partial<TextLine> = {}): TextLine {
  return { text, fontSize: 12, page: 0, isPageFirst: false, isPageLast: false, ...extra }
}

describe('normalizeUnicode', () => {
  it('giữ nguyên dấu tiếng Việt và chuẩn hoá về NFC', () => {
    const decomposed = 'Tiếng Việt'.normalize('NFD')
    expect(decomposed).not.toBe('Tiếng Việt')

    expect(normalizeUnicode(decomposed)).toBe('Tiếng Việt')
  })

  it('gỡ ligature, ký tự vô hình và gộp khoảng trắng', () => {
    const input = '  ofﬁce​   test here  '

    expect(normalizeUnicode(input)).toBe('office test here')
  })
})

describe('isPageNumberLine', () => {
  it('nhận ra các dạng số trang', () => {
    expect(isPageNumberLine('12')).toBe(true)
    expect(isPageNumberLine('- 12 -')).toBe(true)
    expect(isPageNumberLine('Trang 12')).toBe(true)
    expect(isPageNumberLine('Page 7')).toBe(true)
    expect(isPageNumberLine('xiv')).toBe(true)
  })

  it('không nhầm câu chữ thường thành số trang', () => {
    expect(isPageNumberLine('civil')).toBe(false)
    expect(isPageNumberLine('Chương 12')).toBe(false)
    expect(isPageNumberLine('Năm 1931 là một năm khó khăn.')).toBe(false)
  })
})

describe('stripRunningHeads', () => {
  it('xoá tiêu đề chạy lặp lại trên nhiều trang', () => {
    const lines: TextLine[] = []
    for (let page = 0; page < 10; page++) {
      lines.push(line('Đắc Nhân Tâm', { page, isPageFirst: true }))
      lines.push(line(`Nội dung trang ${page}`, { page }))
    }

    const result = stripRunningHeads(lines, 10)

    expect(result.some((l) => l.text === 'Đắc Nhân Tâm')).toBe(false)
    expect(result).toHaveLength(10)
  })

  it('giữ nguyên khi tài liệu dưới 5 trang', () => {
    const lines = [
      line('Đắc Nhân Tâm', { page: 0, isPageFirst: true }),
      line('Đắc Nhân Tâm', { page: 1, isPageFirst: true }),
    ]

    expect(stripRunningHeads(lines, 2)).toHaveLength(2)
  })
})

describe('dehyphenate', () => {
  it('nối từ bị gạch nối cuối dòng', () => {
    expect(dehyphenate(['một cuốn sách hay tuy-', 'ệt vời'])).toEqual(['một cuốn sách hay tuyệt vời'])
  })

  it('nối cả gạch nối mềm', () => {
    expect(dehyphenate(['thu­', 'ộc'])).toEqual(['thuộc'])
  })

  it('không nối khi dòng sau viết hoa', () => {
    expect(dehyphenate(['ký hiệu -', 'New York'])).toEqual(['ký hiệu -', 'New York'])
  })
})

describe('joinParagraphs', () => {
  it('gộp dòng bị ngắt thành một đoạn', () => {
    const result = joinParagraphs(['Ngày 7 tháng 5 năm 1931, cả thành phố', 'New York chứng kiến một cuộc vây bắt.'])

    expect(result).toBe('Ngày 7 tháng 5 năm 1931, cả thành phố New York chứng kiến một cuộc vây bắt.')
  })

  it('ngắt đoạn khi câu đã kết thúc hoặc gặp dòng trống', () => {
    const result = joinParagraphs(['Câu thứ nhất.', 'Câu thứ hai chưa xong', 'nên nối tiếp.', '', 'Đoạn mới.'])

    expect(result).toBe('Câu thứ nhất.\n\nCâu thứ hai chưa xong nên nối tiếp.\n\nĐoạn mới.')
  })

  it('tách đầu mục thành đoạn riêng', () => {
    expect(joinParagraphs(['Danh sách gồm', '- mục một', '- mục hai'])).toBe('Danh sách gồm\n\n- mục một\n\n- mục hai')
  })
})

describe('cleanBookLines', () => {
  it('gỡ số trang, tiêu đề chạy và dòng rỗng trong một lượt', () => {
    const lines: TextLine[] = []
    for (let page = 0; page < 8; page++) {
      lines.push(line('ĐẮC NHÂN TÂM', { page, isPageFirst: true }))
      lines.push(line(`  Nội dung trang ${page}  `, { page }))
      lines.push(line('   ', { page }))
      lines.push(line(String(page + 1), { page, isPageLast: true }))
    }

    const result = cleanBookLines(lines, 8)

    expect(result).toHaveLength(8)
    expect(result[0].text).toBe('Nội dung trang 0')
  })
})

describe('linesToContent', () => {
  it('nối gạch nối rồi gộp đoạn', () => {
    const lines = [line('Cuốn sách này rất tuy-'), line('ệt vời và đáng đọc.')]

    expect(linesToContent(lines)).toBe('Cuốn sách này rất tuyệt vời và đáng đọc.')
  })
})
