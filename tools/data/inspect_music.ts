import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: songs, error } = await supabase
    .from('media_items')
    .select('id, name, artist, genre, music_genre, audio_url, youtube_url, cover_url')
    .eq('type', 'MUSIC')

  if (error) {
    console.error('Error fetching songs:', error)
    return
  }

  console.log('Total songs:', songs.length)
  const withAudio = songs.filter((s) => s.audio_url && s.audio_url.trim().length > 0)
  const withoutAudio = songs.filter((s) => !s.audio_url || !s.audio_url.trim().length)
  console.log('Songs WITH audio_url:', withAudio.length)
  console.log('Songs WITHOUT audio_url:', withoutAudio.length)

  const artistMap: Record<string, { count: number; withAudio: number; sample: string }> = {}
  const genreMap: Record<string, { count: number; withAudio: number; sample: string }> = {}

  songs.forEach((s) => {
    const a = (s.artist || '(Trống / Chưa có)').trim()
    const g = (s.music_genre || s.genre || '(Trống / Chưa có)').trim()
    const hasAudio = Boolean(s.audio_url && s.audio_url.trim().length > 0)

    if (!artistMap[a]) artistMap[a] = { count: 0, withAudio: 0, sample: s.name }
    artistMap[a].count++
    if (hasAudio) artistMap[a].withAudio++

    if (!genreMap[g]) genreMap[g] = { count: 0, withAudio: 0, sample: s.name }
    genreMap[g].count++
    if (hasAudio) genreMap[g].withAudio++
  })

  console.log('\n--- ARTISTS ---')
  console.log(JSON.stringify(artistMap, null, 2))

  console.log('\n--- GENRES ---')
  console.log(JSON.stringify(genreMap, null, 2))

  // Also query music_artists and music_genres
  const { data: dbArtists } = await supabase.from('music_artists').select('*')
  console.log('\n--- DB MUSIC_ARTISTS Table ---')
  console.log(JSON.stringify(dbArtists, null, 2))

  const { data: dbGenres } = await supabase.from('music_genres').select('*')
  console.log('\n--- DB MUSIC_GENRES Table ---')
  console.log(JSON.stringify(dbGenres, null, 2))
}

run()
