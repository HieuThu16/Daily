import { getCloudinaryConfig, cloudinary } from './_cloudinary.js'

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

    // Cloudinary supports base64 data URIs, remote URLs, or buffer strings
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
