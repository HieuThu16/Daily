/**
 * Chạy `worker` cho từng phần tử với số việc song song giới hạn, báo tiến độ
 * theo từng phần tử hoàn tất (không phải theo mẻ). Lỗi đầu tiên làm dừng cả lượt.
 */
export async function mapWithProgress<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  options: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<void> {
  const total = items.length
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, total))
  if (!total) return

  let nextIndex = 0
  let done = 0

  const runner = async () => {
    while (true) {
      const index = nextIndex++
      if (index >= total) return
      await worker(items[index], index)
      done += 1
      options.onProgress?.(done, total)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, runner))
}
