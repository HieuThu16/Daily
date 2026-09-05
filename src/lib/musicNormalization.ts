import type { Media } from '../types'

/**
 * Chuẩn hoá thể loại nhạc:
 * Ví dụ: kpop / KPOP / K-POP -> 'K-Pop'
 * us uk / US UK / us-uk -> 'US-UK'
 * vpop / V-POP / v-pop -> 'V-Pop'
 * bolero / trữ tình -> 'Bolero / Trữ Tình'
 * rap / hip hop -> 'Rap / Hip-hop'
 * remix / edm -> 'Remix'
 */
export function normalizeMusicGenre(raw?: string | null): string {
  if (!raw) return 'Chưa phân loại'
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()

  if (/^(k[-_\s]?pop)$/i.test(lower) || lower.includes('kpop') || lower.includes('k-pop')) {
    return 'K-Pop'
  }
  if (/^(us[-_\s]?uk|usuk)$/i.test(lower) || lower.includes('us uk') || lower.includes('us-uk')) {
    return 'US-UK'
  }
  if (/^(v[-_\s]?pop|vpop)$/i.test(lower) || lower.includes('vpop') || lower.includes('v-pop') || lower === 'nhạc trẻ') {
    return 'V-Pop'
  }
  if (lower.includes('bolero') || lower.includes('trữ tình') || lower.includes('quê hương')) {
    return 'Bolero / Trữ Tình'
  }
  if (lower.includes('remix') || lower.includes('vinahouse') || lower.includes('edm') || lower === 'chất') {
    return 'Remix'
  }
  if (lower.includes('rap') || lower.includes('hiphop') || lower.includes('hip-hop') || lower.includes('hip hop')) {
    return 'Rap / Hip-hop'
  }
  if (lower.includes('ballad')) {
    return 'Ballad'
  }
  if (lower.includes('lofi') || lower.includes('lo-fi') || lower.includes('chill')) {
    return 'Lo-fi / Chill'
  }
  if (lower.includes('acoustic') || lower.includes('guitar')) {
    return 'Acoustic'
  }
  if (lower.includes('trịnh') || lower.includes('trịnh công sơn')) {
    return 'Nhạc Trịnh'
  }
  if (lower.includes('ost') || lower.includes('nhạc phim') || lower.includes('soundtrack')) {
    return 'Nhạc Phim (OST)'
  }
  if (lower.includes('không lời') || lower.includes('piano') || lower.includes('instrumental')) {
    return 'Không lời / Piano'
  }
  if (lower.includes('anh trai')) {
    return 'Anh trai'
  }
  if (lower.includes('thiếu nhi') || lower.includes('trẻ em')) {
    return 'Thiếu Nhi'
  }
  if (lower.includes('dễ thương')) {
    return 'V-Pop'
  }
  if (lower === 'pop') {
    return 'Pop'
  }
  if (lower.includes('rock')) {
    return 'Rock'
  }
  if (lower.includes('jazz')) {
    return 'Jazz'
  }
  if (lower.includes('r&b') || lower.includes('rnb')) {
    return 'R&B'
  }
  if (lower.includes('tri thức') || lower.includes('podcast')) {
    return 'Podcast / Tri thức'
  }

  return trimmed
}

/**
 * Chuẩn hoá tên ca sĩ:
 * Gộp các biến thể chữ hoa/thường (HOÀI LÂM -> Hoài Lâm, SOOBIN -> Soobin Hoàng Sơn)
 */
export function normalizeMusicArtist(raw?: string | null): string {
  if (!raw) return 'Chưa rõ ca sĩ'
  let artist = raw.trim()

  const map: Record<string, string> = {
    'hoài lâm': 'Hoài Lâm',
    'hoài lâm cover': 'Hoài Lâm',
    'soobin hoàng sơn': 'Soobin Hoàng Sơn',
    'soobin': 'Soobin Hoàng Sơn',
    'bích phương': 'Bích Phương',
    'sơn tùng m-tp': 'Sơn Tùng M-TP',
    'anh quân idol': 'Anh Quân Idol',
    'chillies': 'Chillies',
    'hoàng dũng': 'Hoàng Dũng',
    'diệu kiên': 'Diệu Kiên',
    'phúc du': 'Phúc Du',
    'phương ly': 'Phương Ly',
    'tiên tiên': 'Tiên Tiên',
    'ngô lan hương': 'Ngô Lan Hương',
    'vũ phụng tiên': 'Vũ Phụng Tiên',
    'tăng duy tân': 'Tăng Duy Tân',
    'wren evans': 'Wren Evans',
    'đan nguyên': 'Đan Nguyên',
    'đạt long vinh': 'Đạt Long Vinh',
    'văn mẫn': 'Văn Mẫn',
    '화사 (hwasa)': 'HWASA',
    'hwasa': 'HWASA',
    'fifty fifty (피프티피프티)': 'FIFTY FIFTY',
    'fifty fifty': 'FIFTY FIFTY',
    'jisoo': 'JISOO',
    'ân ngờ ft. mỹ mỹ [mini album 0 ngờ]': 'Ân Ngờ ft. Mỹ Mỹ',
    'buitruonglinh': 'Bùi Trường Linh',
    'hongkong1': 'Nguyễn Trọng Tài',
    'thế là anh bỏ lỡ chuyến xe cuộc đời remix': 'Thanh Hưng',
    'tấm thân dãi dầu (oxi remix)': 'Phát Huy T4 x H2O',
    '[xhtdrlx3] hương tình thân': 'Lâm Bảo Ngọc',
    'thằng hầu (dinhlong remix)': 'Nhật Phong',
    'thiên duyên tiền định': 'Đan Nguyên, Cát Lynh',
    'im đợi người anh thương': 'Wren Evans, Captain Boy, Ivan, Thế Thiên',
  }

  const lower = artist.toLowerCase()
  if (map[lower]) return map[lower]

  // If ALL CAPS with length > 3 and contains spaces or letters, convert to Title Case
  if (artist === artist.toUpperCase() && /[A-ZÀ-Ỵ]/.test(artist) && artist.length > 3) {
    if (!['BLACKPINK', 'MONSTAR', 'MONO', 'VSTRA', 'TIA', 'JISOO', 'HWASA', 'EDM'].includes(artist)) {
      artist = artist
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
  }

  return artist
}

export interface MusicAlbum {
  id: string
  type: 'ARTIST' | 'GENRE'
  name: string
  normalizedKey: string
  coverUrl?: string | null
  tracks: Media[]
  subtext?: string
}

/**
 * Kiểm tra xem bài hát có MP3 không:
 * Chỉ những bài có file audio_url hợp lệ mới được đưa vào Album!
 */
export function hasMp3Audio(item: Media): boolean {
  return Boolean(item.type === 'MUSIC' && item.audio_url && item.audio_url.trim().length > 0)
}

/**
 * Gom nhóm bài hát có MP3 thành danh sách Album theo Ca sĩ.
 * Gộp các biến thể chữ hoa / chữ thường về cùng 1 Album.
 */
export function groupSongsByArtist(items: Media[]): MusicAlbum[] {
  // Chỉ lấy bài có MP3
  const mp3Items = items.filter(hasMp3Audio)
  const map = new Map<string, { name: string; tracks: Media[]; coverUrl?: string | null }>()

  for (const song of mp3Items) {
    const artist = normalizeMusicArtist(song.artist)
    const key = artist.toLowerCase().trim()

    let album = map.get(key)
    if (!album) {
      album = { name: artist, tracks: [], coverUrl: song.cover_url || null }
      map.set(key, album)
    }

    album.tracks.push(song)
    if (!album.coverUrl && song.cover_url) {
      album.coverUrl = song.cover_url
    }
  }

  return Array.from(map.entries())
    .map(([key, data]) => ({
      id: `artist-${key}`,
      type: 'ARTIST' as const,
      name: data.name,
      normalizedKey: key,
      coverUrl: data.coverUrl,
      tracks: data.tracks,
      subtext: `${data.tracks.length} bài có MP3`,
    }))
    .sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name, 'vi'))
}

/**
 * Gom nhóm bài hát có MP3 thành danh sách Album theo Dòng nhạc / Thể loại.
 * Gộp các thể loại như kpop vs KPOP về cùng 'K-Pop'.
 */
export function groupSongsByGenre(items: Media[]): MusicAlbum[] {
  // Chỉ lấy bài có MP3
  const mp3Items = items.filter(hasMp3Audio)
  const map = new Map<string, { name: string; tracks: Media[]; coverUrl?: string | null }>()

  for (const song of mp3Items) {
    const genre = normalizeMusicGenre(song.music_genre || song.genre)
    const key = genre.toLowerCase().trim()

    let album = map.get(key)
    if (!album) {
      album = { name: genre, tracks: [], coverUrl: song.cover_url || null }
      map.set(key, album)
    }

    album.tracks.push(song)
    if (!album.coverUrl && song.cover_url) {
      album.coverUrl = song.cover_url
    }
  }

  return Array.from(map.entries())
    .map(([key, data]) => ({
      id: `genre-${key}`,
      type: 'GENRE' as const,
      name: data.name,
      normalizedKey: key,
      coverUrl: data.coverUrl,
      tracks: data.tracks,
      subtext: `${data.tracks.length} bài có MP3`,
    }))
    .sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name, 'vi'))
}
