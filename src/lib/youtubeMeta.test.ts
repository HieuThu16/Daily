import { describe, expect, it, vi } from 'vitest'
import { fetchYouTubeMeta, parseChannelName, parseMusicTitle, stripTitleNoise, youtubeVideoId, detectMusicGenre } from './youtubeMeta'

describe('youtubeVideoId', () => {
  it('đọc được các dạng link YouTube thường gặp', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM')).toBe('dQw4w9WgXcQ')
  })

  it('bỏ qua tham số thừa và link chia sẻ từ điện thoại', () => {
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc123&t=42')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&t=1s')).toBe('dQw4w9WgXcQ')
  })

  it('trả về null khi không phải link video YouTube', () => {
    expect(youtubeVideoId('')).toBeNull()
    expect(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/@RickAstleyYT')).toBeNull()
    expect(youtubeVideoId('chỉ là một dòng chữ')).toBeNull()
  })
})

describe('stripTitleNoise', () => {
  it('bỏ các cụm quảng cáo trong ngoặc', () => {
    expect(stripTitleNoise('Never Gonna Give You Up (Official Video) (4K Remaster)')).toBe('Never Gonna Give You Up')
    expect(stripTitleNoise('Thanh Xuân [Official MV]')).toBe('Thanh Xuân')
    expect(stripTitleNoise('Niềm Vui Của Em (Lyrics Video)')).toBe('Niềm Vui Của Em')
  })

  it('giữ lại ngoặc mang nội dung thật', () => {
    expect(stripTitleNoise('Hạ Còn Vương Nắng (Remix)')).toBe('Hạ Còn Vương Nắng (Remix)')
    expect(stripTitleNoise('Chuyện Cũ Bỏ Qua (feat. Đen)')).toBe('Chuyện Cũ Bỏ Qua (feat. Đen)')
  })

  it('cắt đuôi quảng cáo sau dấu gạch đứng', () => {
    expect(stripTitleNoise('LỚN RỒI CÒN KHÓC NHÈ | OFFICIAL MV')).toBe('LỚN RỒI CÒN KHÓC NHÈ')
  })
})

describe('parseChannelName', () => {
  it('bỏ các đuôi kênh không phải tên thật', () => {
    expect(parseChannelName('Rick Astley - Topic')).toBe('Rick Astley')
    expect(parseChannelName('Trúc Nhân Official')).toBe('Trúc Nhân')
    expect(parseChannelName('SonTungMTPVEVO')).toBe('SonTungMTP')
    expect(parseChannelName('Da LAB Official Music')).toBe('Da LAB')
  })

  it('giữ nguyên tên kênh bình thường', () => {
    expect(parseChannelName('Da LAB')).toBe('Da LAB')
  })
})

describe('parseMusicTitle', () => {
  it('tách "Ca sĩ - Tên bài" theo lối phương Tây', () => {
    expect(parseMusicTitle('Rick Astley - Never Gonna Give You Up (Official Video)', 'Rick Astley')).toEqual({
      name: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
    })
  })

  it('tách "Tên bài - Ca sĩ" khi vế sau mới khớp tên kênh', () => {
    expect(parseMusicTitle('Thanh Xuân - Da LAB (Official MV)', 'Da LAB Official')).toEqual({
      name: 'Thanh Xuân',
      artist: 'Da LAB',
    })
  })

  it('xử lý kiểu gạch đứng nhiều vế của MV Việt', () => {
    expect(parseMusicTitle('LỚN RỒI CÒN KHÓC NHÈ | TRÚC NHÂN | OFFICIAL MV', 'Trúc Nhân Official')).toEqual({
      name: 'LỚN RỒI CÒN KHÓC NHÈ',
      artist: 'TRÚC NHÂN',
    })
  })

  it('so khớp tên kênh bỏ qua dấu và hoa thường', () => {
    expect(parseMusicTitle('NGÀY ĐẸP TRỜI ĐỂ NÓI CHIA TAY - LOU HOÀNG', 'Lou Hoang Official')).toEqual({
      name: 'NGÀY ĐẸP TRỜI ĐỂ NÓI CHIA TAY',
      artist: 'LOU HOÀNG',
    })
  })

  it('không tách được thì lấy tên kênh làm ca sĩ', () => {
    expect(parseMusicTitle('Lấy vợ ngoại thành', 'Quang Lê Official')).toEqual({
      name: 'Lấy vợ ngoại thành',
      artist: 'Quang Lê',
    })
  })

  it('chỉ có một dấu gạch mà không vế nào khớp kênh thì coi vế đầu là ca sĩ', () => {
    expect(parseMusicTitle('Đen Vâu - Đi Về Nhà', 'Kênh Nhạc Tổng Hợp')).toEqual({
      name: 'Đi Về Nhà',
      artist: 'Đen Vâu',
    })
  })

  it('không bao giờ trả về tên bài rỗng', () => {
    expect(parseMusicTitle('   ', 'Da LAB').name).toBe('')
    expect(parseMusicTitle('Da LAB', 'Da LAB')).toEqual({ name: 'Da LAB', artist: 'Da LAB' })
  })
})

describe('fetchYouTubeMeta', () => {
  const ok = (body: unknown) =>
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) } as unknown as Response)

  it('lấy tiêu đề và kênh từ oEmbed', async () => {
    const fetchImpl = ok({ title: 'Thanh Xuân - Da LAB', author_name: 'Da LAB Official' })

    await expect(fetchYouTubeMeta('https://youtu.be/dQw4w9WgXcQ', fetchImpl)).resolves.toEqual({
      title: 'Thanh Xuân - Da LAB',
      author: 'Da LAB Official',
    })
  })

  it('không gọi mạng khi link không phải YouTube', async () => {
    const fetchImpl = ok({})

    await expect(fetchYouTubeMeta('https://example.com/abc', fetchImpl)).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('video riêng tư hoặc đã xoá thì trả về null chứ không ném lỗi', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response)

    await expect(fetchYouTubeMeta('https://youtu.be/dQw4w9WgXcQ', fetchImpl)).resolves.toBeNull()
  })

  it('mất mạng thì trả về null chứ không ném lỗi', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))

    await expect(fetchYouTubeMeta('https://youtu.be/dQw4w9WgXcQ', fetchImpl)).resolves.toBeNull()
  })
})

describe('detectMusicGenre', () => {
  it('đoán đúng các thể loại phổ biến', () => {
    expect(detectMusicGenre('1 Phút Lofi Chill Buồn', 'Andiez')).toBe('Lo-fi / Chill')
    expect(detectMusicGenre('Waiting For You (Remix EDM Vinahouse)', 'MONO')).toBe('EDM / Remix')
    expect(detectMusicGenre('Đi Về Nhà - Đen Vâu ft. JustaTee (Rap)', 'Đen Vâu')).toBe('Rap / Hip-hop')
    expect(detectMusicGenre('Hạ Trắng (Nhạc Trịnh Guitar Acoustic)', 'Hà Anh Tuấn')).toBe('Acoustic')
    expect(detectMusicGenre('Diễm Xưa - Trịnh Công Sơn', 'Khánh Ly')).toBe('Nhạc Trịnh')
    expect(detectMusicGenre('Sầu Tím Thiệp Hồng (Bolero Trữ Tình)', 'Quang Lê')).toBe('Bolero / Trữ Tình')
    expect(detectMusicGenre('See Tình (Official MV)', 'Hoàng Thùy Linh')).toBe('V-Pop')
    expect(detectMusicGenre('Shape of You', 'Ed Sheeran')).toBe('Pop')
  })
})
