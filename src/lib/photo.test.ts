import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressForUpload } from './photo'

const file = (name: string, type = 'image/jpeg') =>
  new File([new Uint8Array(1024)], name, { type })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('compressForUpload', () => {
  it('nén được thì trả blob JPEG đã nén, đuôi thành jpg', async () => {
    const small = new Blob([new Uint8Array(64)], { type: 'image/jpeg' })
    // Giả lập cả chuỗi createImageBitmap -> canvas -> toBlob.
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 3000, close() {} }))
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob: (cb: (b: Blob) => void) => cb(small),
    } as unknown as HTMLCanvasElement)

    const out = await compressForUpload(file('ANH_MAY_ANH.HEIC', 'image/heic'))
    expect(out.ext).toBe('jpg')
    expect(out.blob).toBe(small)
    expect(out.blob.size).toBeLessThan(1024)
  })

  it('không giải mã được thì giữ nguyên file gốc, không mất ảnh', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('trinh duyet khong ho tro')
    })
    const original = file('anh.png', 'image/png')
    const out = await compressForUpload(original)
    expect(out.blob).toBe(original)
    expect(out.ext).toBe('png')
  })

  it('file không có đuôi thì mặc định jpg', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('x')
    })
    expect((await compressForUpload(file('khongcoduoi'))).ext).toBe('jpg')
  })
})
