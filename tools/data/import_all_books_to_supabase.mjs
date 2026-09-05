import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

config();

const USER_ID = '7370be55-0665-44b7-aa83-739135938958';
const CHARS_PER_PAGE = 1800;
const CHAPTER_BATCH_SIZE = 20;

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function localDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function slugify(text) {
  return (text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'book';
}

async function uploadCoverImage(mediaItemId, coverPath, title) {
  if (!coverPath) return null;
  try {
    const fileBuf = await fs.readFile(coverPath);
    const ext = path.extname(coverPath).toLowerCase();
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const { v2: cloudinary } = await import('cloudinary');
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
          secure: true,
        });
        const res = await cloudinary.uploader.upload(`data:image/jpeg;base64,${fileBuf.toString('base64')}`, {
          folder: 'media-covers',
          public_id: `${slugify(title)}-${mediaItemId.slice(0, 8)}`,
          resource_type: 'image',
          overwrite: true,
        });
        if (res?.secure_url) return res.secure_url;
      } catch (cErr) {
        console.warn('Cloudinary upload error in import, fallback to Supabase:', cErr.message);
      }
    }

    const storagePath = `covers/${slugify(title)}-${mediaItemId.slice(0, 8)}.jpg`;

    const { error: upErr } = await supabase.storage
      .from('media-covers')
      .upload(storagePath, fileBuf, { contentType: 'image/jpeg', upsert: true });

    if (upErr) {
      console.warn(`    ⚠️ Upload cover error for "${title}":`, upErr.message);
      return null;
    }

    const { data } = supabase.storage.from('media-covers').getPublicUrl(storagePath);
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (err) {
    console.warn(`    ⚠️ Read cover error for "${title}":`, err.message);
    return null;
  }
}

async function main() {
  console.log('===============================================================');
  console.log('🚀 BẮT ĐẦU IMPORT TOÀN BỘ SÁCH VÀO SUPABASE DATABASE');
  console.log(`👤 Target User ID: ${USER_ID}`);
  console.log('===============================================================\n');

  const raw = await fs.readFile('d:/Desktop/Daily/prepared_books.json', 'utf8');
  const books = JSON.parse(raw);
  console.log(`📚 Tìm thấy tổng cộng ${books.length} cuốn sách đã chuẩn bị sẵn sàng.\n`);

  // Lấy danh sách media_items đã có để tránh trùng lặp
  const { data: existingMedia } = await supabase
    .from('media_items')
    .select('id, name')
    .eq('type', 'BOOK');
  const existingNames = new Set((existingMedia || []).map((m) => m.name.trim().toLowerCase()));

  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    const indexStr = `[${i + 1}/${books.length}]`;

    if (existingNames.has(b.title.trim().toLowerCase())) {
      console.log(`${indexStr} ⏩ Bỏ qua (Đã tồn tại trong DB): "${b.title}"`);
      skippedCount++;
      continue;
    }

    try {
      // 1. Tạo media_items
      const { data: mediaItem, error: mediaErr } = await supabase
        .from('media_items')
        .insert({
          user_id: USER_ID,
          type: 'BOOK',
          name: b.title,
          author: b.author,
          genre: b.genre,
          description: b.description,
          status: 'IN_PROGRESS',
          book_format: 'READ',
          is_public: true,
          is_favorite: false,
          start_date: localDate(),
          log_date: localDate(),
        })
        .select()
        .single();

      if (mediaErr || !mediaItem) {
        throw new Error(`Lỗi insert media_items: ${mediaErr?.message}`);
      }

      // 2. Upload cover nếu có và update cover_url
      let coverUrl = null;
      if (b.cover_path) {
        coverUrl = await uploadCoverImage(mediaItem.id, b.cover_path, b.title);
        if (coverUrl) {
          await supabase
            .from('media_items')
            .update({ cover_url: coverUrl })
            .eq('id', mediaItem.id);
        }
      }

function sanitizeText(s) {
  return (s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').trim();
}

      // 3. Tính toán chapters, offsets, char counts
      let runningOffset = 0;
      const chaptersWithOffsets = b.chapters.map((c, idx) => {
        const cleanContent = sanitizeText(c.content);
        const cleanTitle = sanitizeText(c.title);
        const charCount = cleanContent.length;
        const chapterRow = {
          idx,
          title: cleanTitle,
          content: cleanContent,
          char_count: charCount,
          char_offset: runningOffset,
        };
        runningOffset += charCount;
        return chapterRow;
      });

      const totalChars = runningOffset;
      const estPages = b.page_count || Math.max(1, Math.round(totalChars / CHARS_PER_PAGE));

      // 4. Tạo book_documents
      const { data: bookDoc, error: docErr } = await supabase
        .from('book_documents')
        .insert({
          user_id: USER_ID,
          media_item_id: mediaItem.id,
          source_format: b.source_filename.toLowerCase().endsWith('.epub') ? 'EPUB' : 'PDF',
          source_filename: b.source_filename,
          total_chars: totalChars,
          page_count: b.page_count || null,
          est_pages: estPages,
          chapter_count: chaptersWithOffsets.length,
        })
        .select()
        .single();

      if (docErr || !bookDoc) {
        throw new Error(`Lỗi insert book_documents: ${docErr?.message}`);
      }

      // 5. Insert chapters in batches
      const chapterRows = chaptersWithOffsets.map((c) => ({
        document_id: bookDoc.id,
        user_id: USER_ID,
        idx: c.idx,
        title: c.title,
        content: c.content,
        char_count: c.char_count,
        char_offset: c.char_offset,
      }));

      for (let start = 0; start < chapterRows.length; start += CHAPTER_BATCH_SIZE) {
        const batch = chapterRows.slice(start, start + CHAPTER_BATCH_SIZE);
        const { error: chErr } = await supabase.from('book_chapters').insert(batch);
        if (chErr) {
          // Cleanup partial doc
          await supabase.from('book_documents').delete().eq('id', bookDoc.id);
          await supabase.from('media_items').delete().eq('id', mediaItem.id);
          throw new Error(`Lỗi insert book_chapters batch ${start}: ${chErr.message}`);
        }
      }

      existingNames.add(b.title.trim().toLowerCase());
      successCount++;

      console.log(
        `${indexStr} ✅ Thành công: "${b.title}" | Tác giả: ${b.author} | Thể loại: ${b.genre} | ${b.chapters.length} chương | ${estPages} trang | Bìa: ${coverUrl ? 'OK' : 'Mặc định'}`
      );
    } catch (err) {
      failCount++;
      console.error(`${indexStr} ❌ Thất bại: "${b.title}" - ${err.message}`);
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 TỔNG KẾT QUÁ TRÌNH IMPORT SÁCH');
  console.log(`✅ Thành công: ${successCount} cuốn`);
  console.log(`⏩ Đã có sẵn: ${skippedCount} cuốn`);
  console.log(`❌ Thất bại: ${failCount} cuốn`);
  console.log('===============================================================\n');
}

main().catch(console.error);
