import { supabase } from './supabase'
import { deleteStorageFile } from './storageDelete'

export interface UploadOptions {
  folder?: string
  fileName?: string
  bucketFallback?: string
  resourceType?: 'image' | 'video' | 'raw' | 'auto'
}

export interface UploadResult {
  url: string
  provider: 'cloudinary' | 'supabase'
  publicId?: string
  bytes?: number
}

export interface CloudinaryUsageData {
  configured: boolean
  message?: string
  error?: string
  cloudName?: string
  plan?: string
  lastUpdated?: string
  credits?: {
    used: number
    percent: number
    limit: number
  }
  storage?: {
    usedBytes: number
    creditsUsed: number
  }
  bandwidth?: {
    usedBytes: number
    creditsUsed: number
  }
  transformations?: {
    count: number
    creditsUsed: number
  }
  objects?: {
    count: number
  }
}

/**
 * Convert Blob or File to Base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Không thể đọc tệp thành base64'))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('Lỗi đọc tệp'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Upload a file to Cloudinary first; if Cloudinary is not configured or fails,
 * fall back gracefully to Supabase Storage.
 */
export async function uploadMediaFile(
  fileOrBlob: File | Blob,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    folder = 'daily-app',
    fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    bucketFallback = 'daily-photos',
    resourceType = 'auto',
  } = options

  // 1. Attempt Cloudinary upload via serverless API
  try {
    const dataUrl = await blobToDataUrl(fileOrBlob)
    const res = await fetch('/api/cloudinary-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: dataUrl,
        folder,
        resourceType,
        publicId: fileName.replace(/\.[^/.]+$/, ''), // without extension for publicId
      }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data?.url) {
        return {
          url: data.url,
          provider: 'cloudinary',
          publicId: data.publicId,
          bytes: data.bytes,
        }
      }
    }
  } catch (err) {
    console.warn('[StorageService] Cloudinary upload skipped or failed, falling back to Supabase:', err)
  }

  // 2. Fallback to Supabase Storage
  const ext = fileOrBlob.type?.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
  const finalFileName = fileName.includes('.') ? fileName : `${fileName}.${ext}`
  const path = `${folder}/${finalFileName}`

  if (!supabase) {
    throw new Error('Supabase client chưa được cấu hình')
  }

  const { error: uploadError } = await supabase.storage
    .from(bucketFallback)
    .upload(path, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || undefined,
    })

  if (uploadError) {
    throw new Error(`Upload thất bại: ${uploadError.message}`)
  }

  const { data: pubData } = supabase.storage.from(bucketFallback).getPublicUrl(path)
  return {
    url: pubData.publicUrl,
    provider: 'supabase',
    bytes: fileOrBlob.size,
  }
}

/**
 * Delete a media file cleanly whether it's stored on Cloudinary or Supabase Storage.
 */
export async function deleteMediaFile(
  urlOrPath: string,
  bucketFallback: string = 'daily-photos'
): Promise<{ success: boolean; provider: 'cloudinary' | 'supabase' }> {
  if (!urlOrPath) return { success: false, provider: 'supabase' }

  // Check if it's a Cloudinary URL
  if (urlOrPath.includes('cloudinary.com')) {
    try {
      const res = await fetch('/api/cloudinary-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlOrPath }),
      })
      if (res.ok) {
        const data = await res.json()
        return { success: !!data?.success, provider: 'cloudinary' }
      }
    } catch (e) {
      console.warn('[StorageService] Cloudinary delete failed:', e)
    }
    return { success: false, provider: 'cloudinary' }
  }

  // Supabase Storage
  const res = await deleteStorageFile(bucketFallback, urlOrPath)
  return { success: res.success, provider: 'supabase' }
}

/**
 * Fetch Cloudinary usage & storage stats
 */
export async function getCloudinaryUsage(): Promise<CloudinaryUsageData> {
  try {
    const res = await fetch('/api/cloudinary-usage')
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return {
        configured: false,
        error: err?.error || `HTTP error ${res.status}`,
      }
    }
    return await res.json()
  } catch (error: any) {
    return {
      configured: false,
      error: error?.message || 'Không thể kết nối đến máy chủ Cloudinary',
    }
  }
}
