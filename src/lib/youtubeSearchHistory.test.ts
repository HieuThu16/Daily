import { beforeEach, describe, expect, it } from 'vitest'
import {
  addSearchHistory,
  clearSearchHistory,
  getStoredSearchHistory,
  removeSearchHistory,
} from './youtubeSearchHistory'

describe('youtubeSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lưu từ khoá tìm kiếm mới lên đầu danh sách', () => {
    addSearchHistory('React tutorial')
    addSearchHistory('Vite build')

    expect(getStoredSearchHistory()).toEqual(['Vite build', 'React tutorial'])
  })

  it('loại bỏ trùng lặp không phân biệt chữ hoa thường và đưa lên đầu', () => {
    addSearchHistory('react')
    addSearchHistory('TypeScript')
    addSearchHistory('REACT')

    expect(getStoredSearchHistory()).toEqual(['REACT', 'TypeScript'])
  })

  it('xoá một từ khoá khỏi lịch sử', () => {
    addSearchHistory('React')
    addSearchHistory('Vue')
    addSearchHistory('Angular')

    removeSearchHistory('Vue')
    expect(getStoredSearchHistory()).toEqual(['Angular', 'React'])
  })

  it('xoá toàn bộ lịch sử', () => {
    addSearchHistory('React')
    addSearchHistory('Vue')

    clearSearchHistory()
    expect(getStoredSearchHistory()).toEqual([])
  })
})
