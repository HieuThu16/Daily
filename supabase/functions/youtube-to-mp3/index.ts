import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { youtubeUrl } = await req.json()
    const id = String(youtubeUrl ?? '').match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)?.[1]
    if (!id) throw new Error('Invalid YouTube URL')
    const key = Deno.env.get('CONVERTER_API_KEY')
    const endpoint = Deno.env.get('CONVERTER_API_URL') ?? 'https://youtube-mp36.p.rapidapi.com/dl'
    if (!key) throw new Error('Converter API key is not configured')
    const converted = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com' } })
    if (!converted.ok) throw new Error(`Converter returned ${converted.status}`)
    const result = await converted.json(); const downloadUrl = result.link ?? result.downloadUrl ?? result.url
    if (!downloadUrl) throw new Error('Converter response has no download URL')
    const file = await (await fetch(downloadUrl)).arrayBuffer()
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const user = await client.auth.getUser(); if (!user.data.user) throw new Error('Unauthorized')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); const path = `${user.data.user.id}/${id}.mp3`
    const upload = await admin.storage.from('media-audio').upload(path, file, { contentType: 'audio/mpeg', upsert: true }); if (upload.error) throw upload.error
    const { data } = admin.storage.from('media-audio').getPublicUrl(path)
    return new Response(JSON.stringify({ audioUrl: data.publicUrl, storagePath: path }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Conversion failed' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }) }
})
