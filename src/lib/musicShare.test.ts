import { describe, expect, it, vi, beforeEach } from 'vitest'
import { shareMusicToAll } from './musicShare'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

describe('musicShare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gọi RPC share_music_to_all với đúng mediaItemId và trả về số người đã gửi', async () => {
    const mockRpc = vi.mocked(supabase!.rpc)
    mockRpc.mockResolvedValueOnce({
      data: 3,
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as any)

    const count = await shareMusicToAll('song-123')
    expect(mockRpc).toHaveBeenCalledWith('share_music_to_all', {
      p_media_item_id: 'song-123',
    })
    expect(count).toBe(3)
  })

  it('quăng lỗi khi RPC trả về lỗi', async () => {
    const mockRpc = vi.mocked(supabase!.rpc)
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Bài hát không có file MP3/Audio để chia sẻ.', details: '', hint: '', code: '400' },
      count: null,
      status: 400,
      statusText: 'Bad Request',
    } as any)

    await expect(shareMusicToAll('song-invalid')).rejects.toThrow('Bài hát không có file MP3/Audio để chia sẻ.')
  })
})
