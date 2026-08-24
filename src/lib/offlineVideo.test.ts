import { describe, expect, it } from 'vitest'
import { formatBytes, safeFileName } from './offlineVideo'

describe('offlineVideo', () => {
  it('đọc được dung lượng', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(512 * 1024)).toBe('512 KB')
    expect(formatBytes(1048576 * 3.5)).toBe('3.5 MB')
    expect(formatBytes(1048576 * 350)).toBe('350 MB')
    expect(formatBytes(1048576 * 1024 * 2)).toBe('2.0 GB')
  })

  it('đặt tên file theo id, giữ đuôi, bỏ tên gốc lung tung', () => {
    expect(safeFileName('phim hay.MP4', 'ov_1')).toBe('ov_1.mp4')
    expect(safeFileName('tập 3 — bản đẹp.webm', 'ov_2')).toBe('ov_2.webm')
    expect(safeFileName('khong-co-duoi', 'ov_3')).toBe('ov_3.mp4')
  })
})
