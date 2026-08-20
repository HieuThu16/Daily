import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { youtubeVideoId } from '../lib/youtubeMeta'

/**
 * Điểm rơi của "Chia sẻ tới My Space" (manifest share_target).
 *
 * Android gửi kèm title/text/url; nhiều app nhét luôn link vào `text` nên phải
 * mò link trong cả hai. Có link YouTube thì mở form Thêm Nhạc với link điền sẵn,
 * không nhận ra được gì thì đưa về trang nhạc để tự dán.
 */
export function ShareTarget() {
  const nav = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ')
    const link = raw.match(/https?:\/\/\S+/)?.[0] ?? ''

    if (link && youtubeVideoId(link)) {
      nav(`/music?youtube=${encodeURIComponent(link)}`, { replace: true })
      return
    }
    nav('/music', { replace: true })
  }, [nav])

  return (
    <section style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
      Đang mở nội dung vừa chia sẻ…
    </section>
  )
}
