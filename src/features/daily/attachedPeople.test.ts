import { describe, expect, it } from 'vitest'
import type { Entry, Person } from '../../types'
import { getAttachedPeople, formatDisplayContent } from '../DailyPage'

describe('getAttachedPeople & formatDisplayContent', () => {
  const mockPeople: Person[] = [
    { id: 'p-1', name: 'mẹ', group_key: 'FAMILY' },
    { id: 'p-2', name: 'Ái Vy', group_key: 'FAMILY' },
    { id: 'p-3', name: 'cha', group_key: 'FAMILY' },
    { id: 'p-4', name: 'Hiếu Liver', group_key: 'FRIEND' },
    { id: 'p-5', name: 'Phú', group_key: 'FAMILY' },
    { id: 'p-6', name: 'Kim Ý', group_key: 'FAMILY', is_partner: true },
  ]

  it('nhận diện người thân qua tags', () => {
    const entry: Entry = {
      id: 'e-1',
      content: 'Đi ăn tối cùng nhau',
      entry_date: '2026-09-02',
      entry_type: 'FEELING',
      created_at: '2026-09-02T12:00:00Z',
      tags: ['@Ái Vy', 'FAMILY'],
    }
    const attached = getAttachedPeople(entry, mockPeople)
    expect(attached.map((p) => p.name)).toContain('Ái Vy')
  })

  it('nhận diện người thân qua cú pháp [@Tên] hoặc [👤 Tên]', () => {
    const entry: Entry = {
      id: 'e-2',
      content: '[@mẹ] [Đặc biệt] Mua cho mẹ 1 cái móc khóa con heo bự',
      entry_date: '2026-09-02',
      entry_type: 'FEELING',
      created_at: '2026-09-02T12:00:00Z',
    }
    const attached = getAttachedPeople(entry, mockPeople)
    expect(attached.map((p) => p.name)).toContain('mẹ')
  })

  it('nhận diện người thân khi nhắc tên trong nội dung tiếng Việt', () => {
    const entry: Entry = {
      id: 'e-3',
      content: 'Chiều nay ngồi nói chuyện với Phú và cha ở trước sân',
      entry_date: '2026-09-02',
      entry_type: 'FEELING',
      created_at: '2026-09-02T12:00:00Z',
    }
    const attached = getAttachedPeople(entry, mockPeople)
    const names = attached.map((p) => p.name)
    expect(names).toContain('Phú')
    expect(names).toContain('cha')
    expect(names).not.toContain('mẹ')
  })

  it('làm sạch hiển thị tiêu đề với formatDisplayContent', () => {
    const raw = '[@mẹ] [Đặc biệt] [Lần đầu] Nay mua cho mẹ 1 cái móc khóa con heo bự'
    const clean = formatDisplayContent(raw)
    expect(clean).toBe('Nay mua cho mẹ 1 cái móc khóa con heo bự')
  })
})
