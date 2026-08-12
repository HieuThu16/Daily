import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'

type BookCoverProps = {
  url: string | null | undefined
  alt: string
  /** `thumb` cho thẻ trong danh sách, `large` cho ô bìa ở màn chi tiết. */
  size: 'thumb' | 'large'
}

export function BookCover({ url, alt, size }: BookCoverProps) {
  const [failed, setFailed] = useState(false)

  // Reset theo url để đổi bìa xong ảnh mới được thử lại, không kẹt ở placeholder.
  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url || failed) {
    return (
      <span className={`book-cover-placeholder book-cover-${size}`} aria-hidden="true">
        <BookOpen size={size === 'large' ? 34 : 19} />
      </span>
    )
  }

  return (
    <img
      className={`book-cover-img book-cover-${size}`}
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
