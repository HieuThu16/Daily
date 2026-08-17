/** Số mảnh chứa URL ảnh của truyện BL. Đổi số này thì phải chạy lại `npm run split:bl`. */
export const BL_SHARD_COUNT = 128

/** Băm slug về số mảnh cố định (djb2) — script tách dữ liệu và app phải dùng chung hàm này. */
export function blShardOf(slug: string): number {
  let h = 5381
  for (let i = 0; i < slug.length; i++) h = ((h * 33) ^ slug.charCodeAt(i)) >>> 0
  return h % BL_SHARD_COUNT
}

/** Đường dẫn file mảnh ảnh của một truyện. */
export function blShardPath(slug: string): string {
  return `/data/bl/img-${blShardOf(slug)}.json`
}
