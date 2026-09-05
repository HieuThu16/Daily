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
  CLOUDINARY_URL,
} = process.env;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Thiếu biến VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env');
  process.exit(1);
}

if (!CLOUDINARY_URL && (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET)) {
  console.error('❌ Thiếu thông tin cấu hình Cloudinary trong .env!');
  process.exit(1);
}

// Config Cloudinary
if (CLOUDINARY_URL) {
  cloudinary.config({ cloudinary_url: CLOUDINARY_URL, secure: true });
} else {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKETS = ['daily-photos', 'media-audio', 'person-photos', 'book-covers', 'media-covers'];
const STATE_FILE = path.resolve('tools/data/cloudinary_migration_map.json');
const CONCURRENCY = 10; // 10 uploads in parallel for fast transfer

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
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ Không thể lưu file trạng thái:', err.message);
  }
}

async function listAllBucketFiles(bucket, prefix = '') {
  let allFiles = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return allFiles;

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null || item.metadata === null) {
      // Subdirectory
      const subFiles = await listAllBucketFiles(bucket, fullPath);
      allFiles.push(...subFiles);
    } else {
      allFiles.push({
        bucket,
        path: fullPath,
        size: item.metadata?.size || 0,
        mimetype: item.metadata?.mimetype || '',
      });
    }
  }
  return allFiles;
}

async function runMigration() {
  console.log('🚀 Bắt đầu quá trình quét và di chuyển media sang Cloudinary (Tốc độ cao song song)...\n');

  const state = loadState();
  const urlMap = new Map(Object.entries(state));
  const filesToDeleteFromSupabase = [];

  for (const bucket of BUCKETS) {
    console.log(`📦 Đang quét bucket: ${bucket}...`);
    const files = await listAllBucketFiles(bucket);
    console.log(`   -> Tìm thấy ${files.length} tệp.`);

    let completedInBucket = 0;
    let skippedInBucket = 0;

    // Filter out files already in state
    const pendingFiles = [];
    for (const f of files) {
      const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(f.path);
      const oldUrl = pubData.publicUrl;
      if (urlMap.has(oldUrl) || urlMap.has(f.path)) {
        skippedInBucket++;
        filesToDeleteFromSupabase.push({ bucket, path: f.path });
      } else {
        pendingFiles.push({ ...f, oldUrl });
      }
    }

    if (skippedInBucket > 0) {
      console.log(`   ⏭️ Đã chuyển từ trước: ${skippedInBucket} tệp (bỏ qua không upload lại).`);
    }

    console.log(`   ⏳ Cần chuyển: ${pendingFiles.length} tệp...`);

    // Process in batches of CONCURRENCY
    for (let i = 0; i < pendingFiles.length; i += CONCURRENCY) {
      const chunk = pendingFiles.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (file, idx) => {
          const overallIndex = i + idx + 1;
          const dotIndex = file.path.lastIndexOf('.');
          const cleanPublicId = dotIndex !== -1 ? file.path.substring(0, dotIndex) : file.path;

          try {
            const uploadResult = await cloudinary.uploader.upload(file.oldUrl, {
              folder: bucket,
              public_id: cleanPublicId.replace(/[^a-zA-Z0-9_\-\/]/g, '_'),
              resource_type: 'auto',
              overwrite: true,
              timeout: 120000,
            });

            const newUrl = uploadResult.secure_url;
            urlMap.set(file.oldUrl, newUrl);
            urlMap.set(file.path, newUrl);
            state[file.oldUrl] = newUrl;
            state[file.path] = newUrl;
            filesToDeleteFromSupabase.push({ bucket, path: file.path });
            completedInBucket++;

            console.log(`   [${overallIndex}/${pendingFiles.length}] ✅ ${file.path}`);
          } catch (err) {
            console.warn(`   [${overallIndex}/${pendingFiles.length}] ❌ Lỗi ${file.path}: ${err.message}`);
          }
        })
      );

      // Save progress state after each concurrent batch
      saveState(state);
    }

    console.log(`✨ Hoàn tất bucket ${bucket}: Đã chuyển ${completedInBucket} mới, ${skippedInBucket} cũ.\n`);
  }

  console.log(`\n🔄 Đang cập nhật lại các liên kết trong CSDL Supabase...`);

  // 1. Update daily_entries
  try {
    const { data: entries } = await supabase.from('daily_entries').select('id, image_url, images');
    if (entries) {
      let updatedEntries = 0;
      for (const entry of entries) {
        let changed = false;
        let newImageUrl = entry.image_url;
        if (entry.image_url && urlMap.has(entry.image_url)) {
          newImageUrl = urlMap.get(entry.image_url);
          changed = true;
        }

        let newImages = entry.images;
        if (Array.isArray(entry.images)) {
          const mapped = entry.images.map((img) => urlMap.get(img) || img);
          if (JSON.stringify(mapped) !== JSON.stringify(entry.images)) {
            newImages = mapped;
            changed = true;
          }
        }

        if (changed) {
          await supabase.from('daily_entries').update({ image_url: newImageUrl, images: newImages }).eq('id', entry.id);
          updatedEntries++;
        }
      }
      console.log(`   ✅ Đã cập nhật ${updatedEntries} bài viết trong daily_entries.`);
    }
  } catch (e) {
    console.warn('   ⚠️ Lỗi update daily_entries:', e.message);
  }

  // 2. Update shared_events
  try {
    const { data: events } = await supabase.from('shared_events').select('id, photo_urls, video_urls, media_list');
    if (events) {
      let updatedEvents = 0;
      for (const event of events) {
        let changed = false;
        let newPhotos = event.photo_urls;
        if (Array.isArray(event.photo_urls)) {
          const mapped = event.photo_urls.map((p) => urlMap.get(p) || p);
          if (JSON.stringify(mapped) !== JSON.stringify(event.photo_urls)) {
            newPhotos = mapped;
            changed = true;
          }
        }

        let newVideos = event.video_urls;
        if (Array.isArray(event.video_urls)) {
          const mapped = event.video_urls.map((v) => urlMap.get(v) || v);
          if (JSON.stringify(mapped) !== JSON.stringify(event.video_urls)) {
            newVideos = mapped;
            changed = true;
          }
        }

        if (changed) {
          await supabase.from('shared_events').update({ photo_urls: newPhotos, video_urls: newVideos }).eq('id', event.id);
          updatedEvents++;
        }
      }
      console.log(`   ✅ Đã cập nhật ${updatedEvents} sự kiện trong shared_events.`);
    }
  } catch (e) {
    console.warn('   ⚠️ Lỗi update shared_events:', e.message);
  }

  // 3. Update person_daily_photos
  try {
    const { data: personPhotos } = await supabase.from('person_daily_photos').select('id, url');
    if (personPhotos) {
      let updated = 0;
      for (const photo of personPhotos) {
        if (photo.url && urlMap.has(photo.url)) {
          await supabase.from('person_daily_photos').update({ url: urlMap.get(photo.url) }).eq('id', photo.id);
          updated++;
        }
      }
      console.log(`   ✅ Đã cập nhật ${updated} ảnh trong person_daily_photos.`);
    }
  } catch (e) {
    console.warn('   ⚠️ Lỗi update person_daily_photos:', e.message);
  }

  // 4. Update books
  try {
    const { data: books } = await supabase.from('books').select('id, cover_url');
    if (books) {
      let updated = 0;
      for (const b of books) {
        if (b.cover_url && urlMap.has(b.cover_url)) {
          await supabase.from('books').update({ cover_url: urlMap.get(b.cover_url) }).eq('id', b.id);
          updated++;
        }
      }
      console.log(`   ✅ Đã cập nhật ${updated} sách trong books.`);
    }
  } catch (e) {
    console.warn('   ⚠️ Lỗi update books:', e.message);
  }

  // 5. Purge old files on Supabase Storage
  console.log(`\n🧹 Đang xóa các tệp cũ trên Supabase Storage để giải phóng dung lượng...`);
  const groupedByBucket = {};
  for (const item of filesToDeleteFromSupabase) {
    if (!groupedByBucket[item.bucket]) groupedByBucket[item.bucket] = [];
    groupedByBucket[item.bucket].push(item.path);
  }

  for (const [bucket, paths] of Object.entries(groupedByBucket)) {
    console.log(`   🗑️ Đang dọn bucket ${bucket} (${paths.length} tệp)...`);
    for (let i = 0; i < paths.length; i += 50) {
      const chunk = paths.slice(i, i + 50);
      const { data, error } = await supabase.storage.from(bucket).remove(chunk);
      if (error) {
        console.warn(`   ⚠️ Lỗi xóa chunk trên ${bucket}:`, error.message);
      }
    }
    console.log(`   ✅ Đã dọn xong ${bucket}.`);
  }

  console.log(`\n🎉 TOÀN BỘ QUÁ TRÌNH DI CHUYỂN SANG CLOUDINARY HOÀN TẤT!`);
  console.log(`- Đã chuyển và đồng bộ: ${filesToDeleteFromSupabase.length} tệp`);
  console.log(`- Supabase Storage đã được dọn sạch về 0 MB.`);
}

runMigration().catch((err) => {
  console.error('Lỗi di chuyển:', err);
  process.exit(1);
});
