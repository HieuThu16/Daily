import { describe, expect, it } from 'vitest'
import { youtubePlaylistId } from './youtubeMeta'
import { classifyYoutubeInput, classifyYoutubeLink } from '../features/youtube/AddYoutubeModal'

const PL = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'

describe('youtubePlaylistId', () => {
  it('đọc link danh sách phát', () => {
    expect(youtubePlaylistId(`https://www.youtube.com/playlist?list=${PL}`)).toBe(PL)
  })

  it('đọc cả link đang xem video trong danh sách', () => {
    expect(youtubePlaylistId(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${PL}&index=3`)).toBe(PL)
  })

  it('bỏ qua Xem sau và Video đã thích vì API không đọc được', () => {
    expect(youtubePlaylistId('https://www.youtube.com/playlist?list=WL')).toBeNull()
    expect(youtubePlaylistId('https://www.youtube.com/playlist?list=LL')).toBeNull()
  })

  it('link video thường hay link lạ thì null', () => {
    expect(youtubePlaylistId('https://youtu.be/dQw4w9WgXcQ')).toBeNull()
    expect(youtubePlaylistId('https://vimeo.com/playlist?list=' + PL)).toBeNull()
    expect(youtubePlaylistId('không phải url')).toBeNull()
  })
})

describe('phân loại link có danh sách phát', () => {
  it('link vừa có v= vừa có list= thì tính là danh sách phát', () => {
    expect(classifyYoutubeLink(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${PL}`)).toBe('playlist')
  })

  it('danh sách phát đi vào nhóm cào, không thành video lẻ', () => {
    const parsed = classifyYoutubeInput(
      `https://www.youtube.com/playlist?list=${PL}\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/@web5ngay`,
    )
    expect(parsed.playlists).toEqual([`https://www.youtube.com/playlist?list=${PL}`])
    expect(parsed.channels).toHaveLength(2)
    expect(parsed.videos.map((v) => v.videoId)).toEqual(['dQw4w9WgXcQ'])
  })
})
