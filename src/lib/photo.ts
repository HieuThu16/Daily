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

/**
 * Chuẩn bị một tệp để tải lên: nén được thì nén, không thì dùng nguyên bản.
 *
 * Có hàm `fileToUploadableJpeg` từ lâu nhưng chỉ một màn hình gọi tới, nên ảnh
 * kỷ niệm và ảnh nhật ký vẫn đẩy thẳng file gốc từ máy ảnh — mỗi tấm 4-7MB thay
 * vì ~300KB. Gói lại ở đây để mọi chỗ tải ảnh đều đi qua cùng một cửa.
 *
 * Không giải mã được (định dạng lạ, trình duyệt cũ) thì trả lại file gốc: thà
 * nặng còn hơn mất ảnh.
 */
export async function compressForUpload(file: File): Promise<{ blob: Blob; ext: string }> {
  const jpeg = await fileToUploadableJpeg(file)
  if (jpeg) return { blob: jpeg, ext: 'jpg' }
  return { blob: file, ext: extensionOf(file.name) }
}

/**
 * Đuôi tệp, mặc định 'jpg'.
 *
 * `name.split('.').pop()` trên tên KHÔNG có dấu chấm trả về nguyên cả tên, nên
 * `?? 'jpg'` viết kiểu cũ không bao giờ chạy — file tên "anhcuoi" thành
 * "uuid.anhcuoi". Phải kiểm tra thật sự có dấu chấm và đuôi trông ra đuôi.
 */
function extensionOf(name: string): string {
  const parts = name.split('.')
  if (parts.length < 2) return 'jpg'
  const ext = (parts.pop() ?? '').toLowerCase()
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg'
}
