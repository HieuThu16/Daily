import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Sparkles, X, Bookmark } from 'lucide-react'
import { useLastReadBook, clearLastReadBook } from '../../lib/bookReadingLog'
import { BookCover } from './BookCover'

export function ContinueReadingHero() {
  const lastRead = useLastReadBook()
  const nav = useNavigate()

  if (!lastRead || !lastRead.mediaItemId) return null

  const handleResume = () => {
    nav(`/library/books/${lastRead.mediaItemId}`)
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearLastReadBook()
  }

  const percent = Math.min(100, Math.max(0, Math.round(lastRead.percent || 0)))

  return (
    <div
      onClick={handleResume}
      style={{
        position: 'relative',
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.15) 50%, rgba(236, 72, 153, 0.1) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.28)',
        boxShadow: '0 8px 24px -6px rgba(99, 102, 241, 0.18), 0 2px 6px rgba(0, 0, 0, 0.04)',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(10px)',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(99, 102, 241, 0.28), 0 4px 12px rgba(0, 0, 0, 0.08)'
        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.45)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(99, 102, 241, 0.18), 0 2px 6px rgba(0, 0, 0, 0.04)'
        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.28)'
      }}
    >
      {/* Nút đóng / ẩn thẻ */}
      <button
        type="button"
        onClick={handleDismiss}
        title="Ẩn thông báo đang đọc dở"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0, 0, 0, 0.05)',
          color: 'var(--text-muted)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          padding: 0,
          zIndex: 2,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
          e.currentTarget.style.color = '#ef4444'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        <X size={13} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Ảnh bìa nổi bật với shadow 3D */}
        <div
          style={{
            position: 'relative',
            width: 52,
            height: 72,
            flexShrink: 0,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 6px 14px -3px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <BookCover url={lastRead.coverUrl} alt={lastRead.title} size="grid" />
        </div>

        {/* Nội dung thông tin sách & tiến độ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
                color: 'var(--purple)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <Sparkles size={11} color="var(--amber)" /> Đang đọc dở
            </span>

            {lastRead.page && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Trang {lastRead.page}{lastRead.pageCount ? `/${lastRead.pageCount}` : ''}
              </span>
            )}
          </div>

          <h4
            style={{
              margin: '0 0 2px',
              fontSize: '0.96rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingRight: 20,
            }}
          >
            {lastRead.title}
          </h4>

          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginBottom: 8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {lastRead.chapterTitle ? (
              <span>Chương {lastRead.chapterIdx + 1}: {lastRead.chapterTitle}</span>
            ) : lastRead.author ? (
              <span>Tác giả: {lastRead.author}</span>
            ) : (
              <span>Đang đọc chương {lastRead.chapterIdx + 1}</span>
            )}
          </div>

          {/* Thanh tiến độ đọc phát sáng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 4,
                background: 'rgba(0, 0, 0, 0.08)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
                  boxShadow: '0 0 8px rgba(168, 85, 247, 0.5)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--purple)', flexShrink: 0 }}>
              {percent}%
            </span>
          </div>
        </div>

        {/* Nút bấm lớn Tiếp tục đọc */}
        <div style={{ flexShrink: 0, paddingLeft: 4 }}>
          <button
            type="button"
            onClick={handleResume}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.35)'
            }}
          >
            <BookOpen size={14} /> Tiếp tục <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
