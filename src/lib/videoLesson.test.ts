import { describe, expect, it } from 'vitest'
import { MAX_CHUNK_SEC, chunkVideo, toKnowledgeRows, videosNeedingLesson } from './videoLesson'

const video = { videoId: 'abc', title: 'Học Rust' }

describe('videoLesson', () => {
  it('mỗi thẻ AI thành một dòng hỏi-đáp, thể loại là tên kênh', () => {
    const rows = toKnowledgeRows(video, [{ question: ' Ownership là gì? ', answer: ' Quy tắc sở hữu. ' }], ' Kênh A ')
    expect(rows).toEqual([
      {
        question: 'Ownership là gì?',
        answer: `Quy tắc sở hữu.

— Từ video: Học Rust`,
        category: 'Kênh A',
        source_video_id: 'abc',
      },
    ])
  })

  it('bỏ thẻ thiếu câu hỏi, kênh rỗng về Chung', () => {
    const rows = toKnowledgeRows(video, [{ question: '  ', answer: 'x' }, { question: 'Q', answer: 'A' }], '')
    expect(rows).toHaveLength(1)
    expect(rows[0].category).toBe('Chung')
  })

  it('chỉ lấy video chưa có thẻ', () => {
    expect(videosNeedingLesson([{ video_id: 'a' }, { video_id: 'b' }], new Set(['a']))).toEqual([{ video_id: 'b' }])
  })

  it('video ngắn không chia khúc', () => {
    expect(chunkVideo(600)).toBeNull()
    expect(chunkVideo(MAX_CHUNK_SEC)).toBeNull()
    expect(chunkVideo(null)).toBeNull()
  })

  it('video dài chia thành các khúc liền mạch, phủ hết thời lượng', () => {
    const chunks = chunkVideo(7200)!
    expect(chunks).toHaveLength(8)
    expect(chunks[0].startSec).toBe(0)
    expect(chunks[chunks.length - 1].endSec).toBe(7200)
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].startSec).toBe(chunks[i - 1].endSec)
    for (const c of chunks) expect(c.endSec - c.startSec).toBeLessThanOrEqual(MAX_CHUNK_SEC)
  })
})
