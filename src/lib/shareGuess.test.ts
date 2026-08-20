import { describe, expect, it } from 'vitest'
import { guessShareKind } from './shareGuess'

const known = { tvshow: ['Web5Ngay'], review: ['Phê Phim'] }
const YT = 'https://www.youtube.com/watch?v=abcdefghijk'

describe('guessShareKind', () => {
  it('kênh đã có trong app thì chắc chắn, không cần hỏi', () => {
    expect(guessShareKind(YT, { title: 'Bài học', author: 'Web5Ngay' }, known)).toMatchObject({ kind: 'TVSHOW', confident: true })
    expect(guessShareKind(YT, { title: 'Phim gì đó', author: 'phê phim' }, known)).toMatchObject({ kind: 'REVIEW', confident: true })
  })

  it('link YouTube Music là nhạc', () => {
    expect(guessShareKind('https://music.youtube.com/watch?v=abcdefghijk', { title: 'x' }, known)).toMatchObject({
      kind: 'MUSIC',
      confident: true,
    })
  })

  it('kênh VEVO hoặc Topic là nhạc chính thức', () => {
    expect(guessShareKind(YT, { title: 'Bài hát', author: 'SonTungMTPVEVO' }, known).kind).toBe('MUSIC')
    expect(guessShareKind(YT, { title: 'Bài hát', author: 'Bích Phương - Topic' }, known).kind).toBe('MUSIC')
  })

  it('đoán theo từ khoá tiêu đề nhưng vẫn hỏi lại', () => {
    expect(guessShareKind(YT, { title: 'ANH TRAI | OFFICIAL MUSIC VIDEO', author: 'Ai đó' }, known)).toMatchObject({
      kind: 'MUSIC',
      confident: false,
    })
    expect(guessShareKind(YT, { title: 'Review phim Interstellar', author: 'Ai đó' }, known).kind).toBe('REVIEW')
    expect(guessShareKind(YT, { title: 'Chương trình abc - Tập 12', author: 'Ai đó' }, known).kind).toBe('TVSHOW')
  })

  it('không có manh mối gì thì để người dùng chọn', () => {
    expect(guessShareKind(YT, { title: 'Một video nào đó', author: 'Ai đó' }, known)).toMatchObject({
      kind: 'VIDEO',
      confident: false,
    })
  })

  it('không đọc được metadata vẫn chạy được', () => {
    expect(guessShareKind(YT, null).kind).toBe('VIDEO')
  })
})
