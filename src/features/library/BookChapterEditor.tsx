import { ArrowUpToLine, Trash2 } from 'lucide-react'
import type { RawChapter } from '../../lib/book/types'

type Props = {
  chapters: RawChapter[]
  onChange: (chapters: RawChapter[]) => void
}

/** Danh sách chương ở màn hình xem trước: đổi tên, xoá, gộp lên. */
export function BookChapterEditor({ chapters, onChange }: Props) {
  const rename = (index: number, title: string) => {
    onChange(chapters.map((chapter, i) => (i === index ? { ...chapter, title } : chapter)))
  }

  /** Xoá chương: nội dung chuyển lên chương trên, tiêu đề bỏ đi. */
  const remove = (index: number) => {
    const next = chapters.slice()
    const [removed] = next.splice(index, 1)
    next[index - 1] = {
      ...next[index - 1],
      content: `${next[index - 1].content}\n\n${removed.content}`,
    }
    onChange(next)
  }

  /** Gộp lên: giữ tiêu đề của chương bị gộp như một dòng trong nội dung. */
  const mergeUp = (index: number) => {
    const next = chapters.slice()
    const [merged] = next.splice(index, 1)
    next[index - 1] = {
      ...next[index - 1],
      content: `${next[index - 1].content}\n\n${merged.title}\n\n${merged.content}`,
    }
    onChange(next)
  }

  return (
    <ul className="book-chapter-editor">
      {chapters.map((chapter, index) => (
        <li key={index}>
          <span className="book-chapter-number">{index + 1}</span>
          <input
            aria-label={`Tên chương ${index + 1}`}
            value={chapter.title}
            onChange={(event) => rename(index, event.target.value)}
          />
          <span className="book-chapter-size">{chapter.content.length.toLocaleString('vi-VN')} ký tự</span>
          {index > 0 && (
            <>
              <button
                className="icon small"
                aria-label={`Gộp ${chapter.title} vào chương trên`}
                title="Gộp vào chương trên"
                onClick={() => mergeUp(index)}
              >
                <ArrowUpToLine size={13} />
              </button>
              <button
                className="icon small danger"
                aria-label={`Xoá chương ${chapter.title}`}
                title="Xoá chương, giữ lại nội dung"
                onClick={() => remove(index)}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
