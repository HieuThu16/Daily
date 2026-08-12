/** Chiều rộng tối đa của ảnh bìa đã chuẩn hoá. Đủ nét cho ô 120px ở màn chi tiết. */
export const COVER_MAX_WIDTH = 600
/** Chiều cao tối đa. 900 = 600 × 3/2, đúng tỉ lệ bìa sách thường gặp, nên ca bình thường
 *  không bao giờ chạm trần này — nó chỉ chặn trang quá cao bất thường. */
export const COVER_MAX_HEIGHT = 900
export const COVER_QUALITY = 0.8

/**
 * Xuất canvas ra JPEG. Canvas được thu về 0x0 sau khi xuất để iOS Safari nhả bộ nhớ —
 * ảnh bìa render từ PDF có thể chiếm vài chục MB backing store.
 */
export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0
        canvas.height = 0
        resolve(blob)
      },
      'image/jpeg',
      COVER_QUALITY,
    )
  })
}

/**
 * Giải mã một blob ảnh (lấy từ EPUB hoặc do người dùng chọn), thu về COVER_MAX_WIDTH
 * và xuất JPEG. Trả null nếu blob không phải ảnh giải mã được.
 */
export async function blobToCover(blob: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return null
  }

  try {
    // Chặn trên bằng 1: ảnh nhỏ hơn thì giữ nguyên, phóng to chỉ làm mờ và nặng thêm.
    const scale = Math.min(1, COVER_MAX_WIDTH / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await canvasToJpeg(canvas)
  } finally {
    bitmap.close?.()
  }
}
