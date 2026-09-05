import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 30 }

/**
 * Xóa an toàn tệp trong Supabase Storage bằng service_role key.
 * Giải quyết triệt để lỗi RLS trên client hoặc người dùng chưa cấp quyền DELETE,
 * bảo đảm tệp thực sự bị xóa khỏi Supabase Storage và giải phóng dung lượng.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' })
  }

  const { bucket, paths } = req.body || {}
  if (!bucket || !paths || !Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'Thiếu thông tin bucket hoặc danh sách paths cần xóa' })
  }

  // Lọc các path hợp lệ, không cho phép path rỗng hoặc chứa ký tự độc hại
  const cleanPaths = paths
    .map((p: any) => String(p || '').trim())
    .filter((p: string) => p.length > 0 && !p.includes('..'))

  if (cleanPaths.length === 0) {
    return res.status(400).json({ error: 'Không có đường dẫn tệp hợp lệ để xóa' })
  }

  const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server chưa cấu hình Supabase Service Key' })
  }

  const admin = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  try {
    // 1. Gọi Storage API bằng service_role để xóa vật lý file trên storage
    const { data, error } = await admin.storage.from(bucket).remove(cleanPaths)
    if (error) {
      return res.status(500).json({ error: `Lỗi khi xóa tệp: ${error.message}` })
    }

    const removedCount = Array.isArray(data) ? data.length : 0

    return res.status(200).json({
      success: true,
      removedCount,
      deleted: data || [],
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Lỗi xử lý xóa tệp' })
  }
}
