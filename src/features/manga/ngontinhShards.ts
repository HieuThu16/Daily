/**
 * Chia mục lục chương của truyện ngôn tình thành nhiều mảnh nhỏ.
 *
 * Trước đây danh sách truyện nhét kèm cả mục lục chương VÀ url ảnh từng trang:
 * mở tab Ngôn tình là tải 169MB JSON chỉ để vẽ lưới bìa. Giờ lưới đọc file chỉ
 * mục nhẹ, mục lục chương chỉ tải đúng mảnh chứa truyện đang mở.
 *
 * Đổi `NGONTINH_SHARD_COUNT` thì phải chạy lại `npm run build:ngontinh`.
 */
export const NGONTINH_SHARD_COUNT = 64

/** Băm slug về số mảnh cố định (djb2) — script tách và app phải dùng chung hàm này. */
export function ngontinhShardOf(slug: string): number {
  let h = 5381
  for (let i = 0; i < slug.length; i++) h = ((h * 33) ^ slug.charCodeAt(i)) >>> 0
  return h % NGONTINH_SHARD_COUNT
}

/** Đường dẫn file mảnh mục lục chương của một truyện. */
export function ngontinhShardPath(slug: string): string {
  return `/data/ngontinh/ch-${ngontinhShardOf(slug)}.json`
}
