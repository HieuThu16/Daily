import { describe, expect, it } from 'vitest'
import { readJson } from './apiFetch'

/** Response giả, chỉ cần đủ hình dạng cho readJson. */
const fake = (body: string, status = 200) =>
  ({ status, text: async () => body }) as unknown as Response

describe('readJson', () => {
  it('JSON hợp lệ thì trả về nguyên vẹn', async () => {
    await expect(readJson(fake('{"videos":[1,2]}'), 'x')).resolves.toEqual({ videos: [1, 2] })
  })

  it('thân rỗng coi như object rỗng, không ném', async () => {
    await expect(readJson(fake(''), 'x')).resolves.toEqual({})
  })

  it('trang lỗi HTML thì nói rõ là HTML kèm mã HTTP, không phải "Unexpected token"', async () => {
    const html = '<!DOCTYPE html><html><body>A server error has occurred</body></html>'
    await expect(readJson(fake(html, 500), 'Không tải được video')).rejects.toThrow(
      /Không tải được video — máy chủ trả về trang HTML \(HTTP 500\)/,
    )
  })

  it('dữ liệu lạ không phải HTML thì báo "dữ liệu lạ"', async () => {
    await expect(readJson(fake('FUNCTION_INVOCATION_TIMEOUT', 504), 'Hỏng')).rejects.toThrow(
      /Hỏng — máy chủ trả về dữ liệu lạ \(HTTP 504\)/,
    )
  })

  it('kèm mẩu nội dung để lần ra nguyên nhân, và cắt ngắn cho gọn', async () => {
    const long = 'x'.repeat(500)
    await expect(readJson(fake(long, 500), 'Hỏng')).rejects.toThrow(/x{120}(?!x)/)
  })
})
