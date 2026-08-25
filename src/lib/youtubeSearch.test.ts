import { describe, expect, it } from 'vitest'
import { mergeSearchPages, type YouTubeSearchResult } from './youtubeSearch'

const v = (id: string): YouTubeSearchResult => ({
  videoId: id, title: 't' + id, description: '', channelTitle: 'c', thumbnail: '',
})

describe('mergeSearchPages', () => {
  it('noi trang moi vao cuoi, giu thu tu', () => {
    expect(mergeSearchPages([v('a'), v('b')], [v('c')]).map((x) => x.videoId)).toEqual(['a', 'b', 'c'])
  })

  it('bo video trung - YouTube hay tra lap giua cac trang', () => {
    expect(mergeSearchPages([v('a'), v('b')], [v('b'), v('c')]).map((x) => x.videoId)).toEqual(['a', 'b', 'c'])
  })

  it('bo dong khong co videoId', () => {
    expect(mergeSearchPages([v('a')], [v('')]).map((x) => x.videoId)).toEqual(['a'])
  })

  it('trang moi rong thi giu nguyen', () => {
    expect(mergeSearchPages([v('a')], [])).toHaveLength(1)
  })
})
