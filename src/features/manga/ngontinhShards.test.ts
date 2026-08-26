import { describe, expect, it } from 'vitest'
import { NGONTINH_SHARD_COUNT, ngontinhShardOf, ngontinhShardPath } from './ngontinhShards'

describe('ngontinhShardOf', () => {
  it('cung slug thi luon ra cung manh - script tach va app phai khop nhau', () => {
    expect(ngontinhShardOf('xam-nhap-vao-truong')).toBe(ngontinhShardOf('xam-nhap-vao-truong'))
  })

  it('luon nam trong khoang manh hop le', () => {
    for (const slug of ['a', 'truyen-hay-123', 'x'.repeat(200), 'co-dau-tieng-viet']) {
      const n = ngontinhShardOf(slug)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(NGONTINH_SHARD_COUNT)
    }
  })

  it('rai tuong doi deu, khong don het vao mot manh', () => {
    const used = new Set<number>()
    for (let i = 0; i < 2000; i++) used.add(ngontinhShardOf('truyen-so-' + i))
    // Don cuc bo thi so manh dung se it hon han
    expect(used.size).toBe(NGONTINH_SHARD_COUNT)
  })

  it('duong dan dung dinh dang', () => {
    expect(ngontinhShardPath('abc')).toMatch(/^[/]data[/]ngontinh[/]ch-\d+[.]json$/)
  })
})
