import { describe, it, expect } from 'vitest'
import { parseTags, getCardAccent, MINIMAL_THEMES, KIND_LABEL } from './EnglishPage'
import type { EnglishItem } from '../../types'

describe('EnglishPage Utilities', () => {
  it('parseTags correctly splits, trims, and deduplicates tags', () => {
    expect(parseTags('ielts, daily,  ielts, work ')).toEqual(['ielts', 'daily', 'work'])
    expect(parseTags('')).toEqual([])
    expect(parseTags('   ,  , ')).toEqual([])
  })

  it('getCardAccent returns the explicitly chosen preset or hex', () => {
    const item: EnglishItem = {
      id: '1',
      kind: 'WORD',
      term: 'Ephemeral',
      meaning: 'Chóng tàn',
      tags: ['vocab'],
      color: 'emerald',
    }
    const accent = getCardAccent(item)
    expect(accent).toBe('#10b981')
  })

  it('getCardAccent falls back to a deterministic stable accent when no color is set', () => {
    const item1: EnglishItem = {
      id: 'item-abc-123',
      kind: 'WORD',
      term: 'Serendipity',
      meaning: 'Sự may mắn',
      tags: [],
    }
    const item2: EnglishItem = {
      id: 'item-abc-123',
      kind: 'WORD',
      term: 'Serendipity',
      meaning: 'Sự may mắn',
      tags: [],
    }
    const accent1 = getCardAccent(item1)
    const accent2 = getCardAccent(item2)

    expect(accent1).toBeDefined()
    expect(accent1).toBe(accent2)
    expect(MINIMAL_THEMES.some((p) => p.accent === accent1)).toBe(true)
  })

  it('KIND_LABEL maps types correctly', () => {
    expect(KIND_LABEL.WORD).toBe('Từ')
    expect(KIND_LABEL.SENTENCE).toBe('Câu')
  })
})
