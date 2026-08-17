import { describe, expect, it } from 'vitest'
import { BL_SHARD_COUNT, blShardOf, blShardPath } from './blShards'

describe('blShardOf', () => {
  it('luôn nằm trong khoảng số mảnh', () => {
    for (const slug of ['the-leashed', 'a', '', 'truyện-có-dấu', 'x'.repeat(200)]) {
      const shard = blShardOf(slug)
      expect(shard).toBeGreaterThanOrEqual(0)
      expect(shard).toBeLessThan(BL_SHARD_COUNT)
      expect(Number.isInteger(shard)).toBe(true)
    }
  })

  it('cùng slug thì luôn ra cùng mảnh', () => {
    expect(blShardOf('the-leashed')).toBe(blShardOf('the-leashed'))
  })

  it('rải slug ra nhiều mảnh khác nhau', () => {
    const slugs = Array.from({ length: 500 }, (_, i) => `truyen-${i}`)
    expect(new Set(slugs.map(blShardOf)).size).toBeGreaterThan(BL_SHARD_COUNT / 2)
  })
})

describe('blShardPath', () => {
  it('trỏ đúng file mảnh', () => {
    expect(blShardPath('the-leashed')).toBe(`/data/bl/img-${blShardOf('the-leashed')}.json`)
  })
})
