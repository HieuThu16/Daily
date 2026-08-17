import { describe, expect, it } from 'vitest'
import { moveItem, parseVideoLinks } from './ReviewSeriesView'

describe('parseVideoLinks', () => {
  it('giữ nguyên thứ tự dán — thứ tự đó chính là thứ tự phần', () => {
    const { valid } = parseVideoLinks(
      ['https://www.youtube.com/watch?v=aaaaaaaaaaa', 'https://youtu.be/bbbbbbbbbbb'].join('\n'),
    )
    expect(valid.map((v) => v.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    expect(valid[0].url).toBe('https://www.youtube.com/watch?v=aaaaaaaaaaa')
  })

  it('bỏ link trùng dù khác dạng, chỉ giữ lần đầu', () => {
    const { valid } = parseVideoLinks(
      'https://youtu.be/aaaaaaaaaaa\nhttps://www.youtube.com/watch?v=aaaaaaaaaaa',
    )
    expect(valid).toHaveLength(1)
  })

  it('một link cũng hợp lệ', () => {
    expect(parseVideoLinks('https://youtu.be/aaaaaaaaaaa').valid).toHaveLength(1)
  })

  it('gom riêng dòng hỏng thay vì nuốt im lặng', () => {
    const { valid, invalid } = parseVideoLinks('https://youtu.be/aaaaaaaaaaa\nhttps://vimeo.com/123\nlung-tung')
    expect(valid).toHaveLength(1)
    expect(invalid).toEqual(['https://vimeo.com/123', 'lung-tung'])
  })

  it('link kênh không phải link video nên bị loại', () => {
    expect(parseVideoLinks('https://www.youtube.com/@phephim').valid).toHaveLength(0)
  })

  it('ô trống không sinh gì', () => {
    expect(parseVideoLinks('  \n ')).toEqual({ valid: [], invalid: [] })
  })
})

describe('moveItem', () => {
  it('đổi chỗ lên và xuống', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('ra ngoài biên thì giữ nguyên, không ném lỗi', () => {
    const items = ['a', 'b']
    expect(moveItem(items, 0, -1)).toBe(items)
    expect(moveItem(items, 1, 2)).toBe(items)
  })
})
