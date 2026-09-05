import { describe, expect, it } from 'vitest'
import {
  normalizeMusicGenre,
  normalizeMusicArtist,
  hasMp3Audio,
  groupSongsByArtist,
  groupSongsByGenre,
} from './musicNormalization'
import type { Media } from '../types'

describe('musicNormalization', () => {
  describe('normalizeMusicGenre', () => {
    it('normalizes K-Pop variations to K-Pop', () => {
      expect(normalizeMusicGenre('kpop')).toBe('K-Pop')
      expect(normalizeMusicGenre('KPOP')).toBe('K-Pop')
      expect(normalizeMusicGenre('k-pop')).toBe('K-Pop')
      expect(normalizeMusicGenre('K-POP')).toBe('K-Pop')
      expect(normalizeMusicGenre('K Pop')).toBe('K-Pop')
    })

    it('normalizes US-UK variations to US-UK', () => {
      expect(normalizeMusicGenre('us uk')).toBe('US-UK')
      expect(normalizeMusicGenre('US UK')).toBe('US-UK')
      expect(normalizeMusicGenre('us-uk')).toBe('US-UK')
      expect(normalizeMusicGenre('US-UK')).toBe('US-UK')
      expect(normalizeMusicGenre('usuk')).toBe('US-UK')
    })

    it('normalizes V-Pop variations to V-Pop', () => {
      expect(normalizeMusicGenre('vpop')).toBe('V-Pop')
      expect(normalizeMusicGenre('V-POP')).toBe('V-Pop')
      expect(normalizeMusicGenre('nhạc trẻ')).toBe('V-Pop')
    })

    it('normalizes Bolero variations to Bolero / Trữ Tình', () => {
      expect(normalizeMusicGenre('bolero')).toBe('Bolero / Trữ Tình')
      expect(normalizeMusicGenre('Bolero')).toBe('Bolero / Trữ Tình')
      expect(normalizeMusicGenre('trữ tình')).toBe('Bolero / Trữ Tình')
    })

    it('normalizes Rap variations to Rap / Hip-hop', () => {
      expect(normalizeMusicGenre('rap')).toBe('Rap / Hip-hop')
      expect(normalizeMusicGenre('Hip-hop')).toBe('Rap / Hip-hop')
      expect(normalizeMusicGenre('hip hop')).toBe('Rap / Hip-hop')
    })

    it('normalizes Remix variations to Remix', () => {
      expect(normalizeMusicGenre('remix')).toBe('Remix')
      expect(normalizeMusicGenre('EDM')).toBe('Remix')
      expect(normalizeMusicGenre('vinahouse')).toBe('Remix')
    })
  })

  describe('normalizeMusicArtist', () => {
    it('normalizes case variations and known duplicates', () => {
      expect(normalizeMusicArtist('HOÀI LÂM')).toBe('Hoài Lâm')
      expect(normalizeMusicArtist('Hoài Lâm')).toBe('Hoài Lâm')
      expect(normalizeMusicArtist('SOOBIN HOÀNG SƠN')).toBe('Soobin Hoàng Sơn')
      expect(normalizeMusicArtist('Soobin')).toBe('Soobin Hoàng Sơn')
      expect(normalizeMusicArtist('soobin')).toBe('Soobin Hoàng Sơn')
      expect(normalizeMusicArtist('VŨ PHỤNG TIÊN')).toBe('Vũ Phụng Tiên')
      expect(normalizeMusicArtist('WREN EVANS')).toBe('Wren Evans')
      expect(normalizeMusicArtist('Văn mẫn')).toBe('Văn Mẫn')
    })
  })

  describe('hasMp3Audio', () => {
    it('returns true only if item is MUSIC and has non-empty audio_url', () => {
      const validSong: Media = {
        id: '1',
        type: 'MUSIC',
        name: 'Bài hát có mp3',
        description: null,
        audio_url: 'https://example.com/audio.mp3',
        status: 'COMPLETED',
        is_favorite: false,
      }
      const noAudioSong: Media = {
        id: '2',
        type: 'MUSIC',
        name: 'Bài hát ko có mp3',
        description: null,
        audio_url: null,
        status: 'COMPLETED',
        is_favorite: false,
      }
      const emptyAudioSong: Media = {
        id: '3',
        type: 'MUSIC',
        name: 'Bài hát audio rỗng',
        description: null,
        audio_url: '   ',
        status: 'COMPLETED',
        is_favorite: false,
      }
      const bookWithAudio: Media = {
        id: '4',
        type: 'BOOK',
        name: 'Sách nói',
        description: null,
        audio_url: 'https://example.com/book.mp3',
        status: 'COMPLETED',
        is_favorite: false,
      }

      expect(hasMp3Audio(validSong)).toBe(true)
      expect(hasMp3Audio(noAudioSong)).toBe(false)
      expect(hasMp3Audio(emptyAudioSong)).toBe(false)
      expect(hasMp3Audio(bookWithAudio)).toBe(false)
    })
  })

  describe('groupSongsByArtist and groupSongsByGenre', () => {
    const mockSongs: Media[] = [
      {
        id: '1',
        type: 'MUSIC',
        name: 'Flower',
        artist: 'JISOO',
        music_genre: 'kpop',
        audio_url: 'https://example.com/jisoo.mp3',
        status: 'COMPLETED',
        is_favorite: false,
        description: null,
      },
      {
        id: '2',
        type: 'MUSIC',
        name: 'Kill This Love',
        artist: 'BLACKPINK',
        music_genre: 'KPOP',
        audio_url: 'https://example.com/bp.mp3',
        status: 'COMPLETED',
        is_favorite: false,
        description: null,
      },
      {
        id: '3',
        type: 'MUSIC',
        name: 'Pink Venom (No MP3)',
        artist: 'blackpink',
        music_genre: 'K-POP',
        audio_url: null, // Should be excluded from albums!
        status: 'COMPLETED',
        is_favorite: false,
        description: null,
      },
      {
        id: '4',
        type: 'MUSIC',
        name: 'DDU-DU DDU-DU',
        artist: 'blackpink',
        music_genre: 'k-pop',
        audio_url: 'https://example.com/bp2.mp3',
        status: 'COMPLETED',
        is_favorite: false,
        description: null,
      },
      {
        id: '5',
        type: 'MUSIC',
        name: 'Shape of You',
        artist: 'Ed Sheeran',
        music_genre: 'US UK',
        audio_url: 'https://example.com/ed.mp3',
        status: 'COMPLETED',
        is_favorite: false,
        description: null,
      },
    ]

    it('groupSongsByArtist only includes songs with MP3 and merges case variations', () => {
      const artistAlbums = groupSongsByArtist(mockSongs)
      // BLACKPINK has 2 MP3 tracks ('Kill This Love', 'DDU-DU DDU-DU'), the 3rd had no MP3
      const bpAlbum = artistAlbums.find((a) => a.normalizedKey === 'blackpink')
      expect(bpAlbum).toBeDefined()
      expect(bpAlbum?.tracks.length).toBe(2)
      expect(bpAlbum?.name).toBe('BLACKPINK')

      // Total albums: BLACKPINK (2), JISOO (1), Ed Sheeran (1)
      expect(artistAlbums.length).toBe(3)
    })

    it('groupSongsByGenre merges kpop / KPOP / k-pop into a single K-Pop album with only MP3 songs', () => {
      const genreAlbums = groupSongsByGenre(mockSongs)
      const kpopAlbum = genreAlbums.find((a) => a.name === 'K-Pop')
      expect(kpopAlbum).toBeDefined()
      // 3 MP3 tracks: Flower, Kill This Love, DDU-DU DDU-DU. Pink Venom excluded because no MP3.
      expect(kpopAlbum?.tracks.length).toBe(3)

      const usukAlbum = genreAlbums.find((a) => a.name === 'US-UK')
      expect(usukAlbum).toBeDefined()
      expect(usukAlbum?.tracks.length).toBe(1)
    })
  })
})
