import { apiFetch, readJson } from './apiFetch'
import { type LinkPreview } from './linkPreviewParse'

export { parseLinkPreview, cleanMovieTitle, type LinkPreview } from './linkPreviewParse'

const EMPTY: LinkPreview = { title: '', image: '', description: '', siteName: '' }

/** Gọi server đọc link — client không fetch chéo miền được vì CORS. */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const trimmed = url.trim()
  if (!trimmed) return EMPTY
  try {
    const res = await apiFetch(`/api/link-preview?url=${encodeURIComponent(trimmed)}`)
    if (!res.ok) return EMPTY
    const data = await readJson(res, 'Không đọc được thông tin từ link')
    return {
      title: String(data.title ?? ''),
      image: String(data.image ?? ''),
      description: String(data.description ?? ''),
      siteName: String(data.siteName ?? ''),
    }
  } catch (err) {
    console.warn('[linkPreview] không đọc được link:', err)
    return EMPTY
  }
}
