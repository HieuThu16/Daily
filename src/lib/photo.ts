/** Cạnh dài tối đa của ảnh kỉ niệm sau khi chuẩn hoá. */
export const PHOTO_MAX_SIZE = 2000
export const PHOTO_QUALITY = 0.85

/**
 * Chuẩn hoá ảnh người dùng chọn về JPEG trước khi upload.
 *
 * Ảnh chụp thẳng từ máy ảnh (iPhone) là HEIC/HEIF: Supabase lưu được nhưng <img> trên
 * hầu hết trình duyệt không giải mã được nên hiện ra ô trắng. Ảnh tải từ Zalo đã là JPEG
 * nên xem bình thường. Ảnh gốc cũng có thể 12MP+ — vượt trần canvas của iOS Safari nếu
 * vẽ nguyên cỡ. Giải mã bằng createImageBitmap (Safari giải được HEIC vì hệ điều hành
 * hỗ trợ) rồi vẽ lại nhỏ hơn và xuất JPEG giải quyết cả hai.
 *
 * Trả về null nếu không giải mã được — caller tự quyết định fallback.
 */
export async function fileToUploadableJpeg(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap
  try {
    // imageOrientation: ảnh máy ảnh hay có EXIF xoay; không xử lý thì ảnh dọc bị nằm ngang.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }

  try {
    const scale = Math.min(1, PHOTO_MAX_SIZE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          // Thu canvas về 0x0 để iOS Safari nhả backing store vài chục MB ngay.
          canvas.width = 0
          canvas.height = 0
          resolve(blob)
        },
        'image/jpeg',
        PHOTO_QUALITY,
      )
    })
  } finally {
    bitmap.close?.()
  }
}
