import { describe, expect, it } from 'vitest'
import { cueIndexAt, type SubCue } from './dualSubs'

const cues: SubCue[] = [
  { start: 0, end: 2, text: 'a' },
  { start: 2, end: 5, text: 'b' },
  { start: 8, end: 9, text: 'c' },
]

describe('cueIndexAt', () => {
  it('tìm đúng câu đang nói', () => {
    expect(cueIndexAt(cues, 0)).toBe(0)
    expect(cueIndexAt(cues, 1.9)).toBe(0)
    expect(cueIndexAt(cues, 2)).toBe(1)
    expect(cueIndexAt(cues, 8.5)).toBe(2)
  })

  it('trả -1 ở khoảng lặng, trước và sau video', () => {
    expect(cueIndexAt(cues, 6)).toBe(-1)
    expect(cueIndexAt(cues, 100)).toBe(-1)
    expect(cueIndexAt([], 1)).toBe(-1)
  })
})
