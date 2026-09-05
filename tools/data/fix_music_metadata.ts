import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export function normalizeGenre(raw?: string | null): string {
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
  if (lower.includes('rap') || lower.includes('hiphop') || lower.includes('hip-hop')) {
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

export function normalizeArtist(raw?: string | null): string {
  if (!raw) return 'Chưa rõ ca sĩ'
  let artist = raw.trim()

  // Replace common noise / weird encodings
  const map: Record<string, string> = {
    'HOÀI LÂM': 'Hoài Lâm',
    'Hoài Lâm Cover': 'Hoài Lâm',
    'SOOBIN HOÀNG SƠN': 'Soobin Hoàng Sơn',
    'Soobin': 'Soobin Hoàng Sơn',
    'BÍCH PHƯƠNG': 'Bích Phương',
    'SƠN TÙNG M-TP': 'Sơn Tùng M-TP',
    'ANH QUÂN IDOL': 'Anh Quân Idol',
    'CHILLIES': 'Chillies',
    'HOÀNG DŨNG': 'Hoàng Dũng',
    'DIỆU KIÊN': 'Diệu Kiên',
    'PHÚC DU': 'Phúc Du',
    'PHƯƠNG LY': 'Phương Ly',
    'TIÊN TIÊN': 'Tiên Tiên',
    'NGÔ LAN HƯƠNG': 'Ngô Lan Hương',
    'VŨ PHỤNG TIÊN': 'Vũ Phụng Tiên',
    'TĂNG DUY TÂN': 'Tăng Duy Tân',
    'WREN EVANS': 'Wren Evans',
    'ĐAN NGUYÊN': 'Đan Nguyên',
    'ĐẠT LONG VINH': 'Đạt Long Vinh',
    'Văn mẫn': 'Văn Mẫn',
    '화사 (HWASA)': 'HWASA',
    'FIFTY FIFTY (피프티피프티)': 'FIFTY FIFTY',
    'JISOO': 'JISOO',
    'Ân Ngờ FT. Mỹ Mỹ [Mini Album 0 Ngờ]': 'Ân Ngờ ft. Mỹ Mỹ',
    'buitruonglinh': 'Bùi Trường Linh',
    'HongKong1': 'Nguyễn Trọng Tài',
    'Thế Là Anh Bỏ Lỡ Chuyến Xe Cuộc Đời Remix': 'Thanh Hưng',
    'Tấm Thân Dãi Dầu (OXI Remix)': 'Phát Huy T4 x H2O',
    '[XHTDRLX3] Hương Tình Thân': 'Lâm Bảo Ngọc',
    'Thằng Hầu (DinhLong Remix)': 'Nhật Phong',
    'Thiên Duyên Tiền Định': 'Đan Nguyên, Cát Lynh',
    'IM ĐỢI NGƯỜI ANH THƯƠNG': 'Wren Evans, Captain Boy, Ivan, Thế Thiên',
  }

  if (map[artist]) return map[artist]

  // If ALL CAPS with length > 2 and contains spaces or vietnamese letters, convert to Title Case
  if (artist === artist.toUpperCase() && /[A-ZÀ-Ỵ]/.test(artist) && artist.length > 3) {
    // Exceptions like BLACKPINK, MONSTAR, MONO, VSTRA, TIA
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

async function dryRun() {
  const { data: songs } = await supabase.from('media_items').select('*').eq('type', 'MUSIC')
  if (!songs) return

  console.log('Total songs:', songs.length)

  // Map to hold unique fix predictions
  const sampleFixes: any[] = []

  songs.forEach((s) => {
    let rawArtist = s.artist
    if (!rawArtist || !rawArtist.trim()) {
      if (s.description && s.description.includes('Ca sĩ:')) {
        const m = s.description.match(/Ca sĩ:\s*([^\n|]+)/i)
        if (m) rawArtist = m[1].trim()
      }
    }

    // Swapped or specific fixes
    let newName = s.name
    let newArtist = rawArtist
    let newGenre = s.music_genre || s.genre

    if (s.name === 'Nhật Phong - Bản Remix Cực Căng - Orinn Remix') {
      newName = 'Thằng Hầu (Remix)'
      newArtist = 'Nhật Phong'
      newGenre = 'Remix'
    } else if (s.name === 'Đan Nguyên & Cát Lynh') {
      newName = 'Thiên Duyên Tiền Định'
      newArtist = 'Đan Nguyên, Cát Lynh'
      newGenre = 'Bolero / Trữ Tình'
    } else if (s.name.includes('TINH HÀ SAY HI')) {
      newName = 'Im Đợi Người Anh Thương'
      newArtist = 'Wren Evans, Captain Boy, Ivan, Thế Thiên'
      newGenre = 'Anh trai'
    } else if (s.name === 'Chuyến Xe Cuộc Đời - Thanh Hưng x Domino Remix') {
      newName = 'Chuyến Xe Cuộc Đời (Remix)'
      newArtist = 'Thanh Hưng'
      newGenre = 'Remix'
    } else if (s.name.includes('Hỡi Thế Gian Kiếp Tương Phùng')) {
      newName = 'Tấm Thân Dãi Dầu (Remix)'
      newArtist = 'Phát Huy T4 x H2O'
      newGenre = 'Remix'
    } else if (s.name.includes('Lâm Bảo Ngọc "vuốt ve"')) {
      newName = 'Hương Tình Thân'
      newArtist = 'Lâm Bảo Ngọc'
      newGenre = 'V-Pop'
    } else if (s.name === 'MV LYRIC - Nguyễn Trọng Tài x San Ji x Double X') {
      newName = 'HongKong1'
      newArtist = 'Nguyễn Trọng Tài, San Ji, Double X'
      newGenre = 'V-Pop'
    } else if (s.name === 'OFFICIAL MV' && newArtist?.toUpperCase() === 'TIÊN TIÊN') {
      newName = 'Say You Do'
      newArtist = 'Tiên Tiên'
      newGenre = 'V-Pop'
    } else if (s.name.includes("Next Level") && !newArtist) {
      newName = 'Next Level'
      newArtist = 'aespa'
      newGenre = 'K-Pop'
    } else if (s.name.includes("Mở Lòng Vì Ai") && !newArtist) {
      newName = 'Mở Lòng Vì Ai (Remix)'
      newArtist = 'Inso'
      newGenre = 'Remix'
    } else if (s.name.includes("Cảm Ơn Người Đã Thức Cùng Tôi") && !newArtist) {
      newName = 'A Little Dream Of Me (OST Cảm Ơn Người Đã Thức Cùng Tôi)'
      newArtist = 'Thảo Tâm ft. Công Dương'
      newGenre = 'Nhạc Phim (OST)'
    } else if (s.name.includes("Xin Đừng Rời Xa Anh") && !newArtist && s.name.includes("Lừa Dối")) {
      newName = 'Mashup Xin Đừng Rời Xa Anh x Anh Đã Lừa Dối Em Rồi'
      newArtist = 'Ness Remix'
      newGenre = 'Remix'
    } else if (s.name === 'Xin Đừng Rời Xa Anh' && !newArtist) {
      newName = 'Xin Đừng Rời Xa Anh (Remix)'
      newArtist = 'Vũ Duy Khánh'
      newGenre = 'Remix'
    } else if (s.name === 'Ngày Em Đi Bầu Trời Mây Giăng Kín Lối' && !newArtist) {
      newName = 'Mùa Thu Và Lời Xin Lỗi (Remix)'
      newArtist = 'Thành Đạt'
      newGenre = 'Remix'
    } else if (s.name.toLowerCase().includes('cô thắm về làng') && !newArtist) {
      newName = 'Cô Thắm Về Làng (Remix)'
      newArtist = 'A T'
      newGenre = 'Remix'
    } else if (s.name.includes('Đâu Phải Cho Anh') && !newArtist) {
      newName = 'Đâu Phải Cho Anh (Remix)'
      newArtist = 'Phát Lee x TVk'
      newGenre = 'Remix'
    } else if (s.name.includes('SƠN THUỶ TRÙNG MÂY') && !newArtist) {
      newName = 'Sơn Thuỷ Trùng Mây (Remix)'
      newArtist = 'Jena, Anh Rồng, Thương Võ, Mây Bae'
      newGenre = 'Remix'
    } else if (s.name.includes('Khó Giữ Chân Thành') && !newArtist) {
      newName = 'Khó Giữ Chân Thành (Remix)'
      newArtist = 'Yến Tatoo'
      newGenre = 'Remix'
    } else if (s.name.includes('BỞI VÌ ANH YÊU EM') && !newArtist) {
      newName = 'Bởi Vì Anh Yêu Em (Remix)'
      newArtist = 'Phan Đình Tùng'
      newGenre = 'Remix'
    } else if (s.name === 'Lấy vợ ngoại thành' && !newArtist) {
      newArtist = 'Văn Mẫn'
      newGenre = 'Bolero / Trữ Tình'
    } else if (s.name === 'Hỏi vợ ngoại thành' && !newArtist) {
      newArtist = 'Văn Mẫn'
      newGenre = 'Bolero / Trữ Tình'
    } else if (s.name === 'Tình thắm duyên quê' && !newArtist) {
      newArtist = 'Văn Mẫn'
      newGenre = 'Bolero / Trữ Tình'
    } else if (s.name === 'Nói với em rằng' && !newArtist) {
      newArtist = 'Bùi Anh Tuấn'
      newGenre = 'Ballad'
    } else if (s.name === 'Ước Gì' && !newArtist) {
      newArtist = 'Bùi Anh Tuấn'
      newGenre = 'Ballad'
    } else if (s.name === 'Em chưa bao giờ giấu anh điều gì' && !newArtist) {
      newArtist = 'Đạt G'
      newGenre = 'Ballad'
    } else if (s.name === 'Nơi tình yêu kết thúc' && !newArtist) {
      newArtist = 'Bùi Anh Tuấn'
      newGenre = 'Ballad'
    } else if (s.name === 'cạn dòng nước mắt' && !newArtist) {
      newArtist = 'Bùi Anh Tuấn'
      newGenre = 'Ballad'
    } else if (s.name === 'Đã Sai Từ Lúc Đầu') {
      newArtist = 'Bùi Anh Tuấn'
      newGenre = 'Ballad'
    } else if (s.name === 'biết tìm đâu') {
      newArtist = 'Tuấn Hưng'
      newGenre = 'V-Pop'
    } else if (s.name === 'Niềm Vui Của Em') {
      newArtist = 'Bé Thùy Trang'
      newGenre = 'Thiếu Nhi'
    } else if (s.name === 'THUYỀN QUYÊN') {
      newName = 'Thuyền Quyên'
      newArtist = 'Diệu Kiên'
      newGenre = 'V-Pop'
    } else if (s.name === 'Waiting For You (Album 22') {
      newName = 'Waiting For You'
      newArtist = 'MONO'
      newGenre = 'V-Pop'
    } else if (s.name === "'Good Goodbye' MV") {
      newName = 'Good Goodbye'
      newArtist = 'HWASA'
      newGenre = 'K-Pop'
    } else if (s.name === 'dđ') {
      newName = 'Dẫu Đã Biết'
      newArtist = 'Bùi Anh Tuấn'
      newGenre = 'Ballad'
    }

    // Normalize artist and genre
    newArtist = normalizeArtist(newArtist)
    newGenre = normalizeGenre(newGenre)

    // Fallback genre inference by artist
    if (newGenre === 'Chưa phân loại') {
      const aLower = newArtist.toLowerCase()
      if (['đen', 'phúc du', 'pháo', 'double2t x masew', 'd.blue x đạt g'].includes(aLower)) {
        newGenre = 'Rap / Hip-hop'
      } else if (['ed sheeran', 'camila cabello', 'imagine dragons', 'imagine dragons x j.i.d', 'the chainsmokers', 'pharrell williams'].includes(aLower)) {
        newGenre = 'US-UK'
      } else if (['blackpink', 'jisoo', 'fifty fifty', 'aespa', 'hwasa'].includes(aLower)) {
        newGenre = 'K-Pop'
      } else if (['đan nguyên', 'hồ phương liên', 'tố my, ngọc phụng', 'hương lan', 'đàm vĩnh hưng', 'văn mẫn'].includes(aLower)) {
        newGenre = 'Bolero / Trữ Tình'
      } else if (aLower.includes('bùi anh tuấn') || aLower.includes('quốc thiên') || aLower.includes('hương tràm') || aLower.includes('nguyễn trọng tài') || aLower.includes('nguyên hà')) {
        newGenre = 'Ballad'
      } else if (aLower.includes('thành nghiệp')) {
        newGenre = 'Acoustic'
      } else if (aLower.includes('musique de salon')) {
        newGenre = 'Nhạc Trịnh'
      } else if (aLower.includes('trinh explained') || aLower.includes('the human page') || aLower.includes('vui vẻ')) {
        newGenre = 'Podcast / Tri thức'
      } else {
        newGenre = 'V-Pop'
      }
    }

    if (newName !== s.name || newArtist !== s.artist || newGenre !== s.music_genre || newGenre !== s.genre) {
      sampleFixes.push({
        id: s.id,
        origName: s.name,
        newName,
        origArtist: s.artist,
        newArtist,
        origGenre: s.music_genre,
        newGenre,
      })
    }
  })

  console.log(`Total songs requiring update: ${sampleFixes.length}`)

  // Batch update media_items
  const batchSize = 40
  console.log(`Updating ${sampleFixes.length} media_items in batches of ${batchSize}...`)
  for (let i = 0; i < sampleFixes.length; i += batchSize) {
    const chunk = sampleFixes.slice(i, i + batchSize)
    await Promise.all(
      chunk.map((item) =>
        supabase
          .from('media_items')
          .update({
            name: item.newName,
            artist: item.newArtist,
            music_genre: item.newGenre,
            genre: item.newGenre,
          })
          .eq('id', item.id)
      )
    )
    process.stdout.write(`Updated ${Math.min(i + batchSize, sampleFixes.length)}/${sampleFixes.length} songs\r`)
  }
  console.log('\nAll media_items updated successfully!')

  // Update music_genres table
  console.log('Synchronizing music_genres table...')
  const standardGenres = [
    'Ballad',
    'V-Pop',
    'Acoustic',
    'Bolero / Trữ Tình',
    'Thiếu Nhi',
    'US-UK',
    'Remix',
    'Rap / Hip-hop',
    'Nhạc Phim (OST)',
    'K-Pop',
    'Lo-fi / Chill',
    'Nhạc Trịnh',
    'Anh trai',
    'Pop',
    'Podcast / Tri thức',
  ]

  const { data: currentGenres } = await supabase.from('music_genres').select('*')
  const existingNames = new Set((currentGenres || []).map((g) => g.name.toLowerCase()))

  for (const genreName of standardGenres) {
    if (!existingNames.has(genreName.toLowerCase())) {
      await supabase.from('music_genres').insert({ name: genreName })
      console.log(`Inserted standard genre: ${genreName}`)
    }
  }

  // Clean up outdated duplicate genres like 'K-POP', 'US UK', 'Bolero'
  if (currentGenres) {
    for (const g of currentGenres) {
      const norm = normalizeGenre(g.name)
      if (norm !== g.name) {
        console.log(`Deleting non-standard genre: "${g.name}" (normalized is "${norm}")`)
        await supabase.from('music_genres').delete().eq('id', g.id)
      }
    }
  }

  // Update music_artists table: normalize names, delete duplicates
  console.log('Synchronizing music_artists table...')
  const { data: currentArtists } = await supabase.from('music_artists').select('*')
  if (currentArtists) {
    const seenNormalized = new Map<string, string>() // normalized lower -> id to keep
    for (const a of currentArtists) {
      const norm = normalizeArtist(a.name)
      const normLower = norm.toLowerCase()

      if (seenNormalized.has(normLower)) {
        console.log(`Deleting duplicate artist entry: "${a.name}" (already have "${seenNormalized.get(normLower)}")`)
        await supabase.from('music_artists').delete().eq('id', a.id)
      } else {
        seenNormalized.set(normLower, norm)
        if (norm !== a.name) {
          console.log(`Updating artist: "${a.name}" -> "${norm}"`)
          await supabase.from('music_artists').update({ name: norm }).eq('id', a.id)
        }
      }
    }
  }

  console.log('Database synchronization completed successfully!')
}

dryRun()
