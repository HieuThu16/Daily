import { supabase } from './supabase'

export type LessonCard = { question: string; answer: string }

/**
 * Khúc dài nhất gửi một lần. Thử thực tế: video 30 phút gửi nguyên bị Gemini
 * trả 503, khúc 10 phút thì trôi — nên chốt 15 phút cho có biên an toàn.
 */
export const MAX_CHUNK_SEC = 15 * 60

/** Chia video dài thành các khúc đều nhau. Không biết thời lượng thì coi như một khúc. */
export function chunkVideo(durationSec: number | null | undefined): { startSec: number; endSec: number }[] | null {
  if (!durationSec || durationSec <= MAX_CHUNK_SEC) return null
  const parts = Math.ceil(durationSec / MAX_CHUNK_SEC)
  const step = Math.ceil(durationSec / parts)
  return Array.from({ length: parts }, (_, i) => ({
    startSec: i * step,
    endSec: Math.min(durationSec, (i + 1) * step),
  }))
}

async function callFunction(body: Record<string, unknown>): Promise<LessonCard[]> {
  const { data, error } = await supabase!.functions.invoke('video-lesson', { body })
  // invoke chỉ đưa lỗi HTTP chung chung; lý do thật nằm trong body phản hồi.
  if (error) throw new Error(await errorMessage(error))
  if (!Array.isArray(data?.cards) || !data.cards.length) throw new Error(data?.error || 'Không rút được thẻ nào')
  return data.cards
}

async function errorMessage(error: unknown): Promise<string> {
  const res = (error as { context?: Response })?.context
  if (res && typeof res.json === 'function') {
    try {
      const body = await res.json()
      return [body?.error, body?.detail].filter(Boolean).join(' — ') || `Lỗi ${res.status}`
    } catch {
      /* body không phải JSON thì dùng thông điệp mặc định */
    }
  }
  return (error as Error)?.message || 'Không gọi được AI'
}

/**
 * Rút thẻ hỏi-đáp từ video. Video dài thì chia khúc rồi gộp thẻ lại.
 * Ném lỗi để nơi gọi đếm thất bại.
 */
export async function summarizeVideo(videoId: string, durationSec?: number | null): Promise<LessonCard[]> {
  if (!supabase) throw new Error('Chưa kết nối Supabase')
  const chunks = chunkVideo(durationSec)
  if (!chunks) return callFunction({ videoId })

  const all: LessonCard[] = []
  for (const c of chunks) all.push(...(await callFunction({ videoId, ...c })))
  return all
}

/**
 * Đổi thẻ AI trả về thành dòng knowledge_items.
 * Thể loại lấy theo tên kênh, để bên Kiến thức gom được nguồn từ đâu ra.
 */
export function toKnowledgeRows(
  video: { videoId: string; title: string },
  cards: LessonCard[],
  channelName: string
) {
  const category = channelName.trim() || 'Chung'
  return cards
    .filter((c) => c.question?.trim())
    .map((c) => ({
      question: c.question.trim(),
      answer: `${c.answer.trim()}

— Từ video: ${video.title}`,
      category,
      source_video_id: video.videoId,
    }))
}

/** Video còn cần AI: chưa có thẻ kiến thức nào sinh từ nó. */
export function videosNeedingLesson<T extends { video_id: string }>(videos: T[], done: Set<string>): T[] {
  return videos.filter((v) => !done.has(v.video_id))
}
