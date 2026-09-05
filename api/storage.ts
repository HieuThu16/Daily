import { createClient } from '@supabase/supabase-js'
import { getCloudinaryConfig, cloudinary } from './_cloudinary.js'

export const config = { maxDuration: 60 }

function extractPublicIdFromUrl(url: string): { publicId: string; resourceType: string } | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('cloudinary.com')) return null

    // Format: /<cloud_name>/<resource_type>/upload/(v<version>/)?<public_id>.<ext>
    const parts = parsed.pathname.split('/')
    const uploadIndex = parts.indexOf('upload')
    if (uploadIndex === -1) return null

    const resourceType = parts[uploadIndex - 1] || 'image'
    const afterUpload = parts.slice(uploadIndex + 1)
    if (afterUpload.length === 0) return null

    // If next segment starts with v followed by numbers, skip version
    if (/^v\d+$/.test(afterUpload[0])) {
      afterUpload.shift()
    }

    const fullPath = afterUpload.join('/')
    // Remove extension
    const dotIndex = fullPath.lastIndexOf('.')
    const publicId = dotIndex !== -1 ? fullPath.substring(0, dotIndex) : fullPath

    return { publicId, resourceType }
  } catch {
    return null
  }
}

async function handleCloudinaryUpload(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cConfig = getCloudinaryConfig({
    cloudName: req.headers['x-cloudinary-cloud-name'],
    apiKey: req.headers['x-cloudinary-api-key'],
    apiSecret: req.headers['x-cloudinary-api-secret'],
  })

  if (!cConfig) {
    return res.status(503).json({
      error: 'Cloudinary chưa được cấu hình. Vui lòng thêm CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
      unconfigured: true,
    })
  }

  try {
    const { file, folder = 'daily-app', resourceType = 'auto', publicId } = req.body || {}

    if (!file) {
      return res.status(400).json({ error: 'Thiếu dữ liệu file để upload' })
    }

    const uploadOptions: Record<string, any> = {
      folder,
      resource_type: resourceType,
      overwrite: true,
    }

    if (publicId) {
      uploadOptions.public_id = publicId
    }

    const uploadResult = await cloudinary.uploader.upload(file, uploadOptions)

    return res.status(200).json({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      resourceType: uploadResult.resource_type,
    })
  } catch (error: any) {
    console.error('Cloudinary upload error:', error)
    return res.status(500).json({
      error: error?.message || 'Không thể tải tệp lên Cloudinary',
    })
  }
}

async function handleCloudinaryDelete(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cConfig = getCloudinaryConfig({
    cloudName: req.headers['x-cloudinary-cloud-name'],
    apiKey: req.headers['x-cloudinary-api-key'],
    apiSecret: req.headers['x-cloudinary-api-secret'],
  })

  if (!cConfig) {
    return res.status(503).json({
      error: 'Cloudinary chưa được cấu hình',
      unconfigured: true,
    })
  }

  try {
    let { publicId, url, resourceType = 'image' } = req.body || {}

    if (!publicId && url) {
      const extracted = extractPublicIdFromUrl(url)
      if (extracted) {
        publicId = extracted.publicId
        resourceType = extracted.resourceType
      }
    }

    if (!publicId) {
      return res.status(400).json({ error: 'Thiếu publicId hoặc url để xóa' })
    }

    let result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    if (result.result !== 'ok' && resourceType === 'image') {
      const videoResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' })
      if (videoResult.result === 'ok') {
        result = videoResult
      } else {
        const rawResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
        if (rawResult.result === 'ok') result = rawResult
      }
    }

    return res.status(200).json({
      success: result.result === 'ok',
      result: result.result,
      publicId,
    })
  } catch (error: any) {
    console.error('Cloudinary delete error:', error)
    return res.status(500).json({
      error: error?.message || 'Không thể xóa tệp trên Cloudinary',
    })
  }
}

async function handleCloudinaryUsage(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const customConfig = {
    cloudName: (req.headers['x-cloudinary-cloud-name'] as string) || req.body?.cloudName,
    apiKey: (req.headers['x-cloudinary-api-key'] as string) || req.body?.apiKey,
    apiSecret: (req.headers['x-cloudinary-api-secret'] as string) || req.body?.apiSecret,
  }

  const cConfig = getCloudinaryConfig(customConfig)

  if (!cConfig) {
    return res.status(200).json({
      configured: false,
      message: 'Cloudinary chưa được cấu hình khóa trong .env',
    })
  }

  try {
    const usage = await cloudinary.api.usage()

    return res.status(200).json({
      configured: true,
      cloudName: cConfig.cloudName,
      plan: usage.plan || 'Free',
      lastUpdated: usage.last_updated,
      credits: {
        used: usage.credits?.usage || 0,
        percent: usage.credits?.percent_of_limit || 0,
        limit: 25,
      },
      storage: {
        usedBytes: usage.storage?.usage || 0,
        creditsUsed: usage.storage?.credits_usage || 0,
      },
      bandwidth: {
        usedBytes: usage.bandwidth?.usage || 0,
        creditsUsed: usage.bandwidth?.credits_usage || 0,
      },
      transformations: {
        count: usage.transformations?.usage || 0,
        creditsUsed: usage.transformations?.credits_usage || 0,
      },
      objects: {
        count: usage.objects?.usage || usage.resources || 0,
      },
    })
  } catch (error: any) {
    console.error('Cloudinary usage API error:', error)
    return res.status(500).json({
      configured: true,
      error: error?.message || 'Không thể lấy thông tin dung lượng từ Cloudinary',
    })
  }
}

async function handleStorageDelete(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' })
  }

  const { bucket, paths } = req.body || {}
  if (!bucket || !paths || !Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'Thiếu thông tin bucket hoặc danh sách paths cần xóa' })
  }

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

export default async function handler(req: any, res: any) {
  const action = req.query?.action || req.body?.action

  if (action === 'cloudinary-upload' || action === 'upload') {
    return handleCloudinaryUpload(req, res)
  }
  if (action === 'cloudinary-delete' || action === 'delete') {
    return handleCloudinaryDelete(req, res)
  }
  if (action === 'cloudinary-usage' || action === 'usage') {
    return handleCloudinaryUsage(req, res)
  }
  if (action === 'storage-delete' || action === 'supabase-delete') {
    return handleStorageDelete(req, res)
  }

  // Auto-detect based on payload or query
  if (req.method === 'GET') {
    return handleCloudinaryUsage(req, res)
  }
  if (req.body?.bucket && req.body?.paths) {
    return handleStorageDelete(req, res)
  }
  if (req.body?.file) {
    return handleCloudinaryUpload(req, res)
  }
  if (req.body?.publicId || (req.body?.url && req.body.url.includes('cloudinary.com'))) {
    return handleCloudinaryDelete(req, res)
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
