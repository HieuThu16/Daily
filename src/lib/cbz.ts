import JSZip from 'jszip'

export type CbzPage = { name: string; url: string }
export type CbzBook = { name: string; pages: CbzPage[] }

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp)$/i

/**
 * So tên file kiểu người đọc truyện mong đợi: "2.jpg" đứng trước "10.jpg".
 * So chuỗi thuần sẽ ra 10 trước 2, lật vài trang là biết ngay sai.
 */
export function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
}

/** Lọc và sắp các trang ảnh trong danh sách tên file lấy từ zip. */
export function sortedImageNames(names: string[]): string[] {
  return names
    // Thư mục __MACOSX và file ẩn của macOS hay lẫn trong zip, bỏ kẻo hiện trang rác.
    .filter((name) => IMAGE_EXT.test(name) && !name.startsWith('__MACOSX/') && !(name.split('/').pop() ?? '').startsWith('.'))
    .sort(compareNatural)
}

/**
 * Mở file .cbz (thực chất là zip chứa ảnh) thành danh sách trang đọc được.
 * Ảnh nằm trong bộ nhớ trình duyệt dưới dạng blob URL — không tải lên đâu cả,
 * nên đọc được cả khi mất mạng. Đọc xong nhớ gọi `releaseCbz` để nhả bộ nhớ.
 */
export async function openCbz(file: File): Promise<CbzBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = sortedImageNames(Object.keys(zip.files).filter((name) => !zip.files[name].dir))

  if (names.length === 0) throw new Error('File này không có trang ảnh nào.')

  const pages: CbzPage[] = []
  for (const name of names) {
    const blob = await zip.files[name].async('blob')
    pages.push({ name, url: URL.createObjectURL(blob) })
  }

  return { name: file.name.replace(/\.(cbz|zip)$/i, ''), pages }
}

/** Thu hồi blob URL; quên bước này là mỗi lần mở truyện lại rò thêm vài trăm MB. */
export function releaseCbz(pages: CbzPage[]) {
  for (const page of pages) URL.revokeObjectURL(page.url)
}
