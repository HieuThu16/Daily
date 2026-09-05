import { v2 as cloudinary } from 'cloudinary'

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export function getCloudinaryConfig(customConfig?: Partial<CloudinaryConfig>): CloudinaryConfig | null {
  const cloudName = customConfig?.cloudName || process.env.CLOUDINARY_CLOUD_NAME || ''
  const apiKey = customConfig?.apiKey || process.env.CLOUDINARY_API_KEY || ''
  const apiSecret = customConfig?.apiSecret || process.env.CLOUDINARY_API_SECRET || ''

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    })
    return { cloudName, apiKey, apiSecret }
  }

  // Also support CLOUDINARY_URL if present
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL,
      secure: true,
    })
    const url = new URL(process.env.CLOUDINARY_URL.replace('cloudinary://', 'http://'))
    return {
      cloudName: url.hostname,
      apiKey: url.username,
      apiSecret: url.password,
    }
  }

  return null
}

export { cloudinary }
