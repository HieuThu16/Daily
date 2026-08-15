import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const jsonPath = 'D:/Desktop/React-PWA-App-read-book/data/library/1367.json';
  const raw = await fs.readFile(jsonPath, 'utf8');
  const book = JSON.parse(raw);

  console.log('Book Title:', book.title);
  console.log('Author:', book.author);
  console.log('Chapters:', book.chapters.length);

  // Check upload cover image
  const imgPath = 'D:/Desktop/React-PWA-App-read-book/nguồn/1367.jpeg';
  const imgBuf = await fs.readFile(imgPath);
  const storagePath = `covers/test-1367.jpg`;
  
  const { data: uploadData, error: upErr } = await supabase.storage
    .from('media-covers')
    .upload(storagePath, imgBuf, { contentType: 'image/jpeg', upsert: true });

  if (upErr) console.error('Upload err:', upErr);
  else {
    const { data: { publicUrl } } = supabase.storage.from('media-covers').getPublicUrl(storagePath);
    console.log('Cover Public URL:', publicUrl);
  }
}

main().catch(console.error);
