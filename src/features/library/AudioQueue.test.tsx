import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Media } from '../../types'
import { AudioQueuePicker, AudioQueuePlayer } from './AudioQueue'

afterEach(cleanup)

// jsdom không cài đặt play(); không stub thì đổi bài sẽ ném lỗi "not implemented".
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})

const track = (id: string, name: string, extra: Partial<Media> = {}): Media => ({
  id,
  type: 'MUSIC',
  name,
  description: null,
  status: 'COMPLETED',
  is_favorite: false,
  artist: 'Nghệ sĩ ' + id,
  music_genre: 'Ballad',
  log_date: '2026-08-12',
  log_time: '10:04',
  audio_url: `https://example.com/${id}.mp3`,
  youtube_url: null,
  ...extra,
})

const tracks = [track('a', 'Bài một'), track('b', 'Bài hai'), track('c', 'Bài ba')]

/** Bọc picker bằng state thật để kiểm tra được luồng chọn rồi bấm nghe. */
function PickerHarness({ onPlay }: { onPlay: (picked: string[]) => void }) {
  const [picks, setPicks] = useState<string[]>([])
  return (
    <AudioQueuePicker
      items={tracks}
      selectedIds={picks}
      onToggle={(id) => setPicks((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
      onToggleAll={() => setPicks((ids) => (ids.length === tracks.length ? [] : tracks.map((t) => t.id)))}
      onPlay={() => onPlay(picks)}
    />
  )
}

describe('AudioQueuePicker', () => {
  it('nhắc thêm MP3 khi chưa có bài nào', () => {
    render(<AudioQueuePicker items={[]} selectedIds={[]} onToggle={() => {}} onToggleAll={() => {}} onPlay={() => {}} />)
    expect(screen.getByText(/Chưa có bài nào gắn MP3/)).toBeInTheDocument()
  })

  it('chưa chọn bài nào thì không bấm nghe được', () => {
    render(<PickerHarness onPlay={() => {}} />)
    expect(screen.getByRole('button', { name: /Nghe/ })).toBeDisabled()
  })

  it('chọn nhiều bài rồi bấm nghe thì trả về đúng các bài đã chọn', async () => {
    const onPlay = vi.fn()
    render(<PickerHarness onPlay={onPlay} />)

    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await userEvent.click(screen.getAllByRole('checkbox')[2])
    await userEvent.click(screen.getByRole('button', { name: /Nghe 2 bài/ }))

    expect(onPlay).toHaveBeenCalledWith(['a', 'c'])
  })

  it('nút chọn hết tích toàn bộ rồi bấm lần nữa thì bỏ hết', async () => {
    render(<PickerHarness onPlay={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: /Chọn hết \(3\)/ }))
    expect(screen.getAllByRole('checkbox').every((box) => (box as HTMLInputElement).checked)).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: /Bỏ chọn hết/ }))
    expect(screen.getAllByRole('checkbox').some((box) => (box as HTMLInputElement).checked)).toBe(false)
  })
})

describe('AudioQueuePlayer', () => {
  it('mở ra là ở bài đầu tiên', () => {
    render(<AudioQueuePlayer queue={tracks} onClose={() => {}} />)
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByTitle('Bài một')).toBeInTheDocument()
  })

  it('hết một bài thì tự nhảy sang bài kế', () => {
    const { container } = render(<AudioQueuePlayer queue={tracks} onClose={() => {}} />)

    fireEvent.ended(container.querySelector('audio')!)

    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(screen.getByTitle('Bài hai')).toBeInTheDocument()
  })

  it('dừng ở bài cuối chứ không quay vòng', () => {
    const { container } = render(<AudioQueuePlayer queue={tracks} onClose={() => {}} />)

    fireEvent.ended(container.querySelector('audio')!)
    fireEvent.ended(container.querySelector('audio')!)
    expect(screen.getByText('3/3')).toBeInTheDocument()

    fireEvent.ended(container.querySelector('audio')!)
    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bài kế' })).toBeDisabled()
  })

  it('bấm lùi để nghe lại bài trước, ở bài đầu thì nút lùi tắt', async () => {
    const { container } = render(<AudioQueuePlayer queue={tracks} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Bài trước' })).toBeDisabled()

    fireEvent.ended(container.querySelector('audio')!)
    await userEvent.click(screen.getByRole('button', { name: 'Bài trước' }))

    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('đóng thanh nghe báo ra ngoài', async () => {
    const onClose = vi.fn()
    render(<AudioQueuePlayer queue={tracks} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Đóng thanh nghe' }))

    expect(onClose).toHaveBeenCalled()
  })
})
