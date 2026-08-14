import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Media } from '../../types'
import { VideoDetailView } from './VideoDetailView'

afterEach(cleanup)

const video: Media = {
  id: 'yt-1',
  type: 'YOUTUBE',
  name: 'Ai là triệu phú tập 12',
  description: 'Tập có câu hỏi về lịch sử',
  status: 'IN_PROGRESS',
  is_favorite: false,
  channel: 'VTV3',
  log_date: '2026-08-12',
  log_time: '21:30',
  youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
}

const noop = () => {}

describe('VideoDetailView', () => {
  it('hiện tên, kênh và ghi chú', () => {
    render(<VideoDetailView item={video} onBack={noop} onEdit={noop} onStatusChange={noop} />)

    expect(screen.getByRole('heading', { name: 'Ai là triệu phú tập 12' })).toBeInTheDocument()
    expect(screen.getByText('VTV3')).toBeInTheDocument()
    expect(screen.getByText('Tập có câu hỏi về lịch sử')).toBeInTheDocument()
  })

  // Nhúng sẵn iframe thì mỗi lần mở chi tiết là tải vài trăm KB của YouTube dù
  // người dùng chưa định xem, nên phải bấm mới nhúng.
  it('chỉ nhúng trình phát sau khi bấm xem', async () => {
    const user = userEvent.setup()
    const { container } = render(<VideoDetailView item={video} onBack={noop} onEdit={noop} onStatusChange={noop} />)
    expect(container.querySelector('iframe')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xem Ai là triệu phú tập 12' }))

    expect(container.querySelector('iframe')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
    )
  })

  it('lấy ảnh đại diện từ CDN của YouTube', () => {
    const { container } = render(<VideoDetailView item={video} onBack={noop} onEdit={noop} onStatusChange={noop} />)

    expect(container.querySelector('.video-detail-poster img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
  })

  it('chưa có link thì nhắc dán link thay vì hiện khung hỏng', () => {
    render(
      <VideoDetailView item={{ ...video, youtube_url: null }} onBack={noop} onEdit={noop} onStatusChange={noop} />,
    )

    expect(screen.getByText(/Chưa có link YouTube/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Xem / })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Mở trên YouTube/ })).not.toBeInTheDocument()
  })

  it('đánh dấu trạng thái đang chọn và đổi được', async () => {
    const onStatusChange = vi.fn()
    const user = userEvent.setup()
    render(<VideoDetailView item={video} onBack={noop} onEdit={noop} onStatusChange={onStatusChange} />)

    expect(screen.getByRole('button', { name: 'Đang xem' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Đã xem' }))

    expect(onStatusChange).toHaveBeenCalledWith(video, 'COMPLETED')
  })

  it('quay lại và chỉnh sửa báo ra ngoài', async () => {
    const onBack = vi.fn()
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<VideoDetailView item={video} onBack={onBack} onEdit={onEdit} onStatusChange={noop} />)

    await user.click(screen.getByRole('button', { name: 'Quay lại thư viện' }))
    await user.click(screen.getByRole('button', { name: /Chỉnh sửa/ }))

    expect(onBack).toHaveBeenCalled()
    expect(onEdit).toHaveBeenCalledWith(video)
  })
})
