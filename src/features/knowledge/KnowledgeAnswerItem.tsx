/**
 * Hiển thị một ý trả lời / gạch đầu dòng với phong cách app học tập hiện đại:
 * - Có chấm tròn / gạch đầu dòng dạ quang theo màu chủ đạo
 * - Tự động nhận diện và in đậm phần tiêu đề ý (trước dấu hai chấm)
 */
export function KnowledgeAnswerItem({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const colonIdx = text.indexOf(':')
  // Nhận diện nhãn nếu dấu hai chấm xuất hiện trong khoảng 50 ký tự đầu tiên
  const hasLabel = colonIdx > 0 && colonIdx < 50 && !text.slice(0, colonIdx).includes('\n')
  const label = hasLabel ? text.slice(0, colonIdx + 1) : ''
  const content = hasLabel ? text.slice(colonIdx + 1).trim() : text

  return (
    <div className={`kn-bullet-item ${className}`}>
      <div className="kn-bullet-icon" aria-hidden="true">
        <span className="kn-bullet-dot" />
      </div>
      <div className="kn-bullet-body">
        {hasLabel ? (
          <>
            <strong className="kn-bullet-highlight">{label}</strong>{' '}
            <span className="kn-bullet-text">{content}</span>
          </>
        ) : (
          <span className="kn-bullet-text">{text}</span>
        )}
      </div>
    </div>
  )
}
