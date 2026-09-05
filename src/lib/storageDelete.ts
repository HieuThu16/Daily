import { supabase } from './supabase'

export interface DeleteStorageResult {
  success: boolean
  removedCount: number
  error?: string
}

/**
 * Xóa an toàn một hoặc nhiều tệp khỏi Supabase Storage.
 * Ưu tiên gọi backend `/api/storage-delete` (dùng service_role, vượt qua mọi lỗi RLS phân quyền).
 * Tự động fallback sang Supabase Client trực tiếp nếu offline/lỗi mạng.
 */
export async function deleteStorageFiles(
  bucket: string,
  paths: string[],
): Promise<DeleteStorageResult> {
  const cleanPaths = paths
    .map((p) => (p || '').trim())
    .filter((p) => p.length > 0)

  if (!bucket || cleanPaths.length === 0) {
    return { success: false, removedCount: 0, error: 'Thiếu bucket hoặc đường dẫn tệp' }
  }

  // Handle Cloudinary URLs
  const cloudinaryUrls = cleanPaths.filter((p) => p.includes('cloudinary.com'))
  const normalPaths = cleanPaths.filter((p) => !p.includes('cloudinary.com'))

  let cloudinaryDeleted = 0
  for (const cUrl of cloudinaryUrls) {
    try {
      const res = await fetch('/api/cloudinary-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cUrl }),
      })
      if (res.ok) {
        const d = await res.json()
        if (d?.success) cloudinaryDeleted += 1
      }
    } catch {
      // ignore
    }
  }

  if (normalPaths.length === 0) {
    return {
      success: cloudinaryDeleted > 0 || cloudinaryUrls.length === 0,
      removedCount: cloudinaryDeleted,
    }
  }

  // 1. Thử qua backend API /api/storage-delete (dùng master key service_role)
  try {
    const res = await fetch('/api/storage-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, paths: normalPaths }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data?.success) {
        return {
          success: true,
          removedCount: Number(data.removedCount ?? normalPaths.length) + cloudinaryDeleted,
        }
      }
    }
  } catch {
    // Nếu mạng lỗi hoặc chạy môi trường không có /api, tiếp tục fallback phía dưới
  }

  // 2. Fallback: gọi trực tiếp qua Supabase Client
  if (!supabase) {
    return { success: false, removedCount: 0, error: 'Chưa khởi tạo Supabase client' }
  }

  try {
    const res = await supabase.storage.from(bucket).remove(cleanPaths)
    if (res?.error) {
      return { success: false, removedCount: 0, error: res.error.message }
    }

    // Nếu res.data rỗng [] nghĩa là RLS chặn lệnh xóa
    const count = Array.isArray(res?.data) ? res.data.length : 0
    if (count === 0) {
      // 3. Thử gọi RPC bảo mật delete_storage_object nếu đã cài
      let rpcDeleted = 0
      for (const p of cleanPaths) {
        try {
          const { data: ok } = await supabase.rpc('delete_storage_object', {
            p_bucket: bucket,
            p_name: p,
          })
          if (ok) rpcDeleted += 1
        } catch {
          // ignore
        }
      }

      if (rpcDeleted > 0) {
        return { success: true, removedCount: rpcDeleted }
      }

      return {
        success: false,
        removedCount: 0,
        error:
          'Supabase từ chối quyền xóa (RLS chặn). Hãy áp dụng SQL Migration phân quyền DELETE cho storage.',
      }
    }

    return { success: true, removedCount: count }
  } catch (err: any) {
    return {
      success: false,
      removedCount: 0,
      error: err?.message || 'Không thể xóa tệp khỏi Supabase Storage',
    }
  }
}

/**
 * Xóa một tệp đơn lẻ khỏi Supabase Storage
 */
export async function deleteStorageFile(
  bucket: string,
  path: string,
): Promise<DeleteStorageResult> {
  return deleteStorageFiles(bucket, [path])
}
