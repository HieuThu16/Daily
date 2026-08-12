import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blobToCover, COVER_MAX_WIDTH, COVER_QUALITY } from './cover'

// jsdom không có canvas thật lẫn createImageBitmap, nên test stub cả hai và khẳng định
// trên tham số được truyền vào thay vì trên nội dung ảnh.
type ToBlobCall = { width: number; height: number; type: string; quality: number }

let toBlobCalls: ToBlobCall[]
let bitmapClosed: boolean

function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width,
      height,
      close: () => {
        bitmapClosed = true
      },
    })),
  )
}

beforeEach(() => {
  toBlobCalls = []
  bitmapClosed = false

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never
  HTMLCanvasElement.prototype.toBlob = function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    toBlobCalls.push({
      width: this.width,
      height: this.height,
      type: type ?? '',
      quality: quality ?? 0,
    })
    callback(new Blob(['jpeg-bytes'], { type: type ?? 'image/jpeg' }))
  } as never
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('blobToCover', () => {
  it('thu ảnh lớn về đúng COVER_MAX_WIDTH và giữ tỉ lệ', async () => {
    stubBitmap(1200, 1800)

    const cover = await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(cover).not.toBeNull()
    expect(toBlobCalls).toHaveLength(1)
    expect(toBlobCalls[0].width).toBe(COVER_MAX_WIDTH)
    expect(toBlobCalls[0].height).toBe(900)
  })

  it('không phóng to ảnh hẹp hơn COVER_MAX_WIDTH', async () => {
    stubBitmap(400, 600)

    await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(toBlobCalls[0].width).toBe(400)
    expect(toBlobCalls[0].height).toBe(600)
  })

  it('luôn xuất JPEG với chất lượng COVER_QUALITY', async () => {
    stubBitmap(800, 1200)

    const cover = await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(toBlobCalls[0].type).toBe('image/jpeg')
    expect(toBlobCalls[0].quality).toBe(COVER_QUALITY)
    expect(cover?.type).toBe('image/jpeg')
  })

  it('giải phóng bitmap sau khi vẽ xong', async () => {
    stubBitmap(800, 1200)

    await blobToCover(new Blob(['src'], { type: 'image/png' }))

    expect(bitmapClosed).toBe(true)
  })

  it('trả null khi blob không giải mã được thành ảnh', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('không phải ảnh')
      }),
    )

    const cover = await blobToCover(new Blob(['không phải ảnh'], { type: 'text/plain' }))

    expect(cover).toBeNull()
    expect(toBlobCalls).toHaveLength(0)
  })
})
