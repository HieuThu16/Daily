import { getCloudinaryConfig, cloudinary } from './_cloudinary.js'

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const config = getCloudinaryConfig({
    cloudName: req.headers['x-cloudinary-cloud-name'],
    apiKey: req.headers['x-cloudinary-api-key'],
    apiSecret: req.headers['x-cloudinary-api-secret'],
  })

  if (!config) {
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

    // Attempt deletion with specified resourceType, fallback to 'video' or 'raw' if not found
    let result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    if (result.result !== 'ok' && resourceType === 'image') {
      // Could be video/audio
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
