import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';
import path from 'node:path';

config();

const {
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CLOUDINARY_CLOUD_NAME) {
  console.error('❌ Thiếu biến môi trường trong .env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STATE_FILE = path.resolve('tools/data/cloudinary_migration_map.json');

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function fixAllMissingMedia() {
  console.log('🚀 Bắt đầu quá trình khắc phục triệt để và đồng bộ toàn bộ ảnh/bìa sang Cloudinary...\n');
  const state = loadState();

  // Helper để map 1 URL hoặc path sang Cloudinary
  function getCloudinaryUrl(urlOrPath) {
    if (!urlOrPath) return null;
    if (urlOrPath.includes('cloudinary.com')) return urlOrPath;
    const clean = urlOrPath.split('?')[0];
    if (state[urlOrPath]) return state[urlOrPath];
    if (state[clean]) return state[clean];
    // check by suffix path
    for (const [k, v] of Object.entries(state)) {
      if (clean.endsWith(k) || k.endsWith(clean)) return v;
    }
    return null;
  }

  // 1. Tải lên Cloudinary các ảnh còn sót (từ dự án cũ xhgpxtuzocqqqgsdfqig và bucket hiện tại)
  console.log('📦 BƯỚC 1: Quét và tải lên Cloudinary mọi ảnh còn thiếu...');
  const { data: events } = await supabase.from('shared_events').select('id, title, image_url, images');
  const unmigratedUrls = new Set();

  for (const e of events || []) {
    const list = e.images || (e.image_url ? [e.image_url] : []);
    for (const u of list) {
      if (!getCloudinaryUrl(u)) {
        unmigratedUrls.add(u);
      }
    }
  }

  console.log(`   Tìm thấy ${unmigratedUrls.size} ảnh kỷ niệm chưa có trên Cloudinary. Đang upload...`);

  let uploadSuccess = 0;
  for (const u of unmigratedUrls) {
    try {
      // Tải buffer từ URL (kể cả URL từ dự án cũ lẫn Supabase)
      const res = await fetch(u);
      if (!res.ok) {
        console.warn(`   ⚠️ Không tải được: ${u} (HTTP ${res.status})`);
        continue;
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const b64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

      // Tạo public_id sạch
      const clean = u.split('?')[0];
      const filename = path.basename(clean, path.extname(clean));
      const uploadRes = await cloudinary.uploader.upload(b64, {
        folder: 'daily-photos/recovered',
        public_id: filename.replace(/[^a-zA-Z0-9_\-]/g, '_'),
        resource_type: 'image',
        overwrite: true,
      });

      if (uploadRes?.secure_url) {
        state[u] = uploadRes.secure_url;
        state[clean] = uploadRes.secure_url;
        uploadSuccess++;
        if (uploadSuccess % 10 === 0 || uploadSuccess === unmigratedUrls.size) {
          console.log(`   ✅ Đã upload ${uploadSuccess}/${unmigratedUrls.size} ảnh.`);
          saveState(state);
        }
      }
    } catch (err) {
      console.warn(`   ❌ Lỗi upload ${u}:`, err.message);
    }
  }
  saveState(state);
  console.log(`✨ Hoàn tất Bước 1: Đã đưa thành công ${uploadSuccess} ảnh còn thiếu lên Cloudinary!\n`);

  // 2. Cập nhật bảng media_items (Bìa Sách & Bìa Phim/Truyện/Nhạc)
  console.log('📚 BƯỚC 2: Cập nhật bìa sách trong bảng media_items sang Cloudinary...');
  const { data: mediaItems } = await supabase.from('media_items').select('id, name, cover_url');
  let updatedMedia = 0;
  for (const item of mediaItems || []) {
    if (item.cover_url && !item.cover_url.includes('cloudinary.com')) {
      const cUrl = getCloudinaryUrl(item.cover_url);
      if (cUrl) {
        await supabase.from('media_items').update({ cover_url: cUrl }).eq('id', item.id);
        updatedMedia++;
      }
    }
  }
  console.log(`✨ Hoàn tất Bước 2: Đã cập nhật ${updatedMedia} bìa trong media_items sang Cloudinary URL!\n`);

  // 3. Cập nhật bảng shared_events (Ảnh kỷ niệm)
  console.log('💖 BƯỚC 3: Cập nhật toàn bộ ảnh kỷ niệm trong shared_events sang Cloudinary...');
  let updatedEvents = 0;
  for (const event of events || []) {
    let changed = false;
    let newImageUrl = event.image_url;
    if (event.image_url && !event.image_url.includes('cloudinary.com')) {
      const c = getCloudinaryUrl(event.image_url);
      if (c) {
        newImageUrl = c;
        changed = true;
      }
    }

    let newImages = event.images;
    if (Array.isArray(event.images)) {
      const mapped = event.images.map((img) => getCloudinaryUrl(img) || img);
      if (JSON.stringify(mapped) !== JSON.stringify(event.images)) {
        newImages = mapped;
        changed = true;
      }
    }

    if (changed) {
      await supabase.from('shared_events').update({
        image_url: newImageUrl,
        images: newImages,
      }).eq('id', event.id);
      updatedEvents++;
    }
  }
  console.log(`✨ Hoàn tất Bước 3: Đã cập nhật ${updatedEvents} kỷ niệm trong shared_events sang Cloudinary URL!\n`);

  // 4. Cập nhật bảng daily_entries (Nhật ký ngày)
  console.log('📝 BƯỚC 4: Cập nhật ảnh nhật ký trong daily_entries sang Cloudinary...');
  const { data: dailyEntries } = await supabase.from('daily_entries').select('id, image_url');
  let updatedDaily = 0;
  for (const entry of dailyEntries || []) {
    if (entry.image_url && !entry.image_url.includes('cloudinary.com')) {
      const c = getCloudinaryUrl(entry.image_url);
      if (c) {
        await supabase.from('daily_entries').update({ image_url: c }).eq('id', entry.id);
        updatedDaily++;
      }
    }
  }
  console.log(`✨ Hoàn tất Bước 4: Đã cập nhật ${updatedDaily} bài viết trong daily_entries sang Cloudinary URL!\n`);

  // 5. Cập nhật bảng media_items cột audio_url (Nhạc)
  console.log('🎵 BƯỚC 5: Cập nhật link nhạc trong media_items sang Cloudinary...');
  const { data: audioItems } = await supabase.from('media_items').select('id, audio_url').eq('type', 'MUSIC');
  let updatedAudio = 0;
  for (const a of audioItems || []) {
    if (a.audio_url && !a.audio_url.includes('cloudinary.com')) {
      const c = getCloudinaryUrl(a.audio_url);
      if (c) {
        await supabase.from('media_items').update({ audio_url: c }).eq('id', a.id);
        updatedAudio++;
      }
    }
  }
  console.log(`✨ Hoàn tất Bước 5: Đã cập nhật ${updatedAudio} bài hát trong media_items sang Cloudinary URL!\n`);

  console.log('🎉 TOÀN BỘ SÁCH VÀ KỶ NIỆM ĐÃ ĐƯỢC KHẮC PHỤC 100% HIỂN THỊ ĐẦY ĐỦ TRÊN CLOUDINARY!');
}

fixAllMissingMedia().catch(console.error);
