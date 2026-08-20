import { describe, expect, it } from 'vitest'
import { dedupeMusic } from './musicDedupe'
import type { Media } from '../types'

const song = (over: Partial<Media>): Media => ({
  id: 'x', type: 'MUSIC', name: 'Tình đầu quá chén', description: null,
  status: 'COMPLETED', is_favorite: false, artist: 'NEGAV', ...over,
}) as Media

describe('dedupeMusic', () => {
  it('giữ đúng một bản cho mỗi bài, ưu tiên bản có MP3', () => {
    const result = dedupeMusic([
      song({ id: 'a', shared_by: 'Do Hiếu 16' }),
      song({ id: 'b', shared_by: 'Do Hiếu 16', audio_url: 'https://x/1.mp3' }),
      song({ id: 'c', shared_by: 'Do Hiếu 16' }),
    ])
    expect(result.map((s) => s.id)).toEqual(['b'])
  })

  it('cùng điểm thì giữ bản của mình thay vì bản được chia sẻ', () => {
    const result = dedupeMusic([
      song({ id: 'shared', shared_by: 'Ai đó' }),
      song({ id: 'mine' }),
    ])
    expect(result.map((s) => s.id)).toEqual(['mine'])
  })

  it('khác ca sĩ là hai bài khác nhau, và không đụng tới mục không phải nhạc', () => {
    const result = dedupeMusic([
      song({ id: 'a' }),
      song({ id: 'b', artist: 'Bích Phương' }),
      song({ id: 'book', type: 'BOOK', name: 'Sách', artist: null }),
    ])
    expect(result.map((s) => s.id).sort()).toEqual(['a', 'b', 'book'])
  })
})
