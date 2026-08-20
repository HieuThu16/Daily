import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchYouTubeMeta, youtubeVideoId, type YouTubeMeta } from '../lib/youtubeMeta'
import { guessShareKind, SHARE_LABELS, SHARE_ROUTES, type ShareGuess, type ShareKind } from '../lib/shareGuess'
import { supabase } from '../lib/supabase'

const KINDS: ShareKind[] = ['MUSIC', 'TVSHOW', 'REVIEW', 'VIDEO']

/**
 * Điểm rơi của "Chia sẻ tới My Space" (manifest share_target).
 *
 * Android gửi kèm title/text/url, nhiều app nhét luôn link vào `text` nên phải mò
 * link trong cả hai. Đoán được chắc chắn (kênh đã theo dõi, YouTube Music, kênh VEVO)
 * thì đi thẳng vào form tương ứng; còn mơ hồ thì hỏi một câu, chọn sẵn phương án đoán.
 */
export function ShareTarget() {
  const nav = useNavigate()
  const [link, setLink] = useState('')
  const [meta, setMeta] = useState<YouTubeMeta | null>(null)
  const [guess, setGuess] = useState<ShareGuess | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ')
    const found = raw.match(/https?:\/\/\S+/)?.[0] ?? ''

    if (!found || !youtubeVideoId(found)) {
      nav('/music', { replace: true })
      return
    }
    setLink(found)

    void (async () => {
      // Tên kênh đã theo dõi là manh mối chắc nhất, nên lấy trước khi đoán.
      const [meta, tvshow, review] = await Promise.all([
        fetchYouTubeMeta(found),
        supabase?.from('tvshow_creators').select('creator_name').is('deleted_at', null),
        supabase?.from('review_creators').select('creator_name').is('deleted_at', null),
      ])

      const known = {
        tvshow: ((tvshow?.data ?? []) as { creator_name: string }[]).map((c) => c.creator_name),
        review: ((review?.data ?? []) as { creator_name: string }[]).map((c) => c.creator_name),
      }

      setMeta(meta)
      const result = guessShareKind(found, meta, known)
      setGuess(result)
      if (result.confident) nav(SHARE_ROUTES[result.kind](found), { replace: true })
    })()
  }, [nav])

  if (!guess) {
    return (
      <section style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Đang đọc nội dung vừa chia sẻ…
      </section>
    )
  }

  return (
    <section style={{ padding: 16, maxWidth: 520, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 4px' }}>{meta?.title ?? 'Video YouTube'}</h2>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>
        {meta?.author ? `${meta.author} · ` : ''}
        {guess.reason}
      </p>

      <div style={{ display: 'grid', gap: 8 }}>
        {[guess.kind, ...KINDS.filter((k) => k !== guess.kind)].map((kind, index) => (
          <button
            key={kind}
            type="button"
            className={index === 0 ? 'primary' : undefined}
            onClick={() => nav(SHARE_ROUTES[kind](link), { replace: true })}
            style={{ padding: '12px 14px', borderRadius: 12, fontSize: '0.9rem', textAlign: 'left' }}
          >
            {SHARE_LABELS[kind]}
            {index === 0 && <span style={{ fontSize: '0.72rem', marginLeft: 8, opacity: 0.85 }}>· gợi ý</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
