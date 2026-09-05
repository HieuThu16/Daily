import { getCloudinaryConfig, cloudinary } from './_cloudinary.js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const customConfig = {
    cloudName: (req.headers['x-cloudinary-cloud-name'] as string) || req.body?.cloudName,
    apiKey: (req.headers['x-cloudinary-api-key'] as string) || req.body?.apiKey,
    apiSecret: (req.headers['x-cloudinary-api-secret'] as string) || req.body?.apiSecret,
  }

  const config = getCloudinaryConfig(customConfig)

  if (!config) {
    return res.status(200).json({
      configured: false,
      message: 'Cloudinary chưa được cấu hình khóa trong .env',
    })
  }

  try {
    const usage = await cloudinary.api.usage()

    return res.status(200).json({
      configured: true,
      cloudName: config.cloudName,
      plan: usage.plan || 'Free',
      lastUpdated: usage.last_updated,
      credits: {
        used: usage.credits?.usage || 0,
        percent: usage.credits?.percent_of_limit || 0,
        limit: 25, // Cloudinary Free limit is 25 credits
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
