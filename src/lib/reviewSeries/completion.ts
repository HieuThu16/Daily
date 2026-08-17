/**
 * Quyết định một series review đã đủ phần hay chưa.
 *
 * Quy tắc sống còn của sản phẩm: chỉ COMPLETE khi có bằng chứng cứng — nền
 * tảng báo đủ số item, hoặc có phần cuối và dãy phần liền mạch từ 1. Không có
 * bằng chứng thì UNKNOWN/STALLED, tuyệt đối không tự suy ra COMPLETE.
 */

import type { CompletionResult, ReviewSeries } from './types'

export type CompletionInput = {
  series: ReviewSeries
  /** Số item playlist do nền tảng công bố; null khi nền tảng không cho. */
  playlistItemCount?: number | null
  now?: Date
  /** Bao nhiêu ngày im lặng thì coi là STALLED. Mặc định 30. */
  stalledAfterDays?: number
}

const DAY = 86_400_000

/** Số phần bị thiếu trong dãy 1..expected. */
function gaps(found: number[], expected: number | null): number[] {
  const have = new Set(found)
  const top = expected ?? (found.length ? Math.max(...found) : 0)
  const missing: number[] = []
  for (let i = 1; i <= top; i++) if (!have.has(i)) missing.push(i)
  return missing
}

export function evaluateCompletion(input: CompletionInput): CompletionResult {
  const { series, playlistItemCount = null, now = new Date(), stalledAfterDays = 30 } = input
  const evidence: string[] = []

  const videos = series.videos
  const found = videos.length
  if (found === 0) {
    return { status: 'UNKNOWN', expected: playlistItemCount, found: 0, missingParts: [], confidence: 0, evidence }
  }

  const parts = videos.map((v) => v.part.partNumber).filter((n): n is number => n !== null)
  const declaredTotal = videos.map((v) => v.part.totalParts).find((n): n is number => n !== null) ?? null

  // Kỳ vọng: số playlist mạnh nhất, rồi tới tổng do chính tiêu đề khai ("3/5").
  let expected: number | null = null
  if (playlistItemCount !== null) {
    expected = playlistItemCount
    evidence.push('platform playlist count')
  } else if (declaredTotal !== null) {
    expected = declaredTotal
    evidence.push('declared total in title')
  }

  const missingParts = gaps(parts, expected)
  const hasFinal = videos.some((v) => v.part.isFinal)
  const sequential = parts.length > 0 && missingParts.length === 0

  // --- Bằng chứng mạnh -----------------------------------------------------
  if (playlistItemCount !== null) {
    if (found >= playlistItemCount && missingParts.length === 0) {
      return { status: 'COMPLETE', expected, found, missingParts: [], confidence: 0.95, evidence }
    }
    return { status: 'INCOMPLETE', expected, found, missingParts, confidence: 0.9, evidence }
  }

  if (hasFinal && sequential && parts.length === found) {
    evidence.push('explicit final part', 'no gaps')
    // Có khai tổng thì phải khớp; không khai thì tin vào từ khoá "phần cuối".
    if (declaredTotal === null || found >= declaredTotal) {
      return { status: 'COMPLETE', expected: expected ?? found, found, missingParts: [], confidence: 0.85, evidence }
    }
    return { status: 'INCOMPLETE', expected, found, missingParts, confidence: 0.8, evidence }
  }

  if (missingParts.length > 0) {
    evidence.push('gap in part numbers')
    return { status: 'INCOMPLETE', expected, found, missingParts, confidence: 0.8, evidence }
  }

  // --- Bằng chứng vừa ------------------------------------------------------
  if (hasFinal) {
    evidence.push('final keyword without full sequence')
    return { status: 'POSSIBLY_COMPLETE', expected, found, missingParts, confidence: 0.5, evidence }
  }

  // --- Bằng chứng yếu: im lặng lâu KHÔNG phải là xong ----------------------
  const latest = videos.reduce((max, v) => (v.publishedAt > max ? v.publishedAt : max), videos[0].publishedAt)
  const idleDays = (now.getTime() - new Date(latest).getTime()) / DAY
  if (Number.isFinite(idleDays) && idleDays >= stalledAfterDays) {
    evidence.push(`no new video for ${Math.floor(idleDays)} days`)
    return { status: 'STALLED', expected, found, missingParts, confidence: 0.3, evidence }
  }

  return { status: 'UNKNOWN', expected, found, missingParts, confidence: 0.2, evidence }
}
