import { describe, expect, it } from 'vitest'
import { pickPlayUrl } from '../../api/crawl-tiktok'

const ID = '7222276572911324442'
/** Rút gọn từ state thật của https://www.tiktok.com/embed/v2/<id>. */
const state = (video: unknown) => ({
  source: { data: { [`/embed/v2/${ID}`]: { videoData: { itemInfos: { video } } } } },
})

describe('pickPlayUrl', () => {
  it('lấy link phát từ đúng hình dạng state của TikTok', () => {
    const url = 'https://v16m.tiktokcdn.com/abc/video.mp4?x-expires=123'
    expect(pickPlayUrl(state({ urls: [url] }), ID)).toBe(url)
  })

  it('state đổi hình dạng thì trả null chứ không ném lỗi', () => {
    expect(pickPlayUrl({}, ID)).toBeNull()
    expect(pickPlayUrl(null, ID)).toBeNull()
    expect(pickPlayUrl(state({}), ID)).toBeNull()
    expect(pickPlayUrl(state({ urls: [] }), ID)).toBeNull()
  })

  it('bỏ link không phải https — proxy chỉ nhận https', () => {
    expect(pickPlayUrl(state({ urls: ['http://v16m.tiktokcdn.com/a.mp4'] }), ID)).toBeNull()
  })

  it('state của video khác thì không nhận nhầm', () => {
    const url = 'https://v16m.tiktokcdn.com/abc/video.mp4'
    expect(pickPlayUrl(state({ urls: [url] }), '9999999999999999999')).toBeNull()
  })
})
