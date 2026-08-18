/** Khung xám nhấp nháy trong lúc chờ dữ liệu, giữ chỗ để layout không nhảy. */
export function Skeleton({ height = 16, width = '100%', radius = 8 }: { height?: number | string; width?: number | string; radius?: number }) {
  return <span className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />
}

/** Danh sách chờ: n dòng thẻ. */
export function SkeletonList({ rows = 4, height = 64 }: { rows?: number; height?: number }) {
  return (
    <div className="skeleton-list" role="status" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={14} />
      ))}
    </div>
  )
}

/** Lưới chờ: n ô vuông, dùng cho grid sách / phim / truyện. */
export function SkeletonGrid({ items = 8, height = 180, min = 130 }: { items?: number; height?: number; min?: number }) {
  return (
    <div className="skeleton-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }} role="status" aria-label="Đang tải">
      {Array.from({ length: items }, (_, i) => (
        <Skeleton key={i} height={height} radius={14} />
      ))}
    </div>
  )
}
