import { supabase } from './supabase';

const DB_NAME = 'DailyMangaCoversDB';
const STORE_NAME = 'covers';
const DB_VERSION = 1;
const PHOTO_BUCKET = 'daily-photos';

// In-memory ObjectURL cache for zero-latency instant rendering
const memoryCache = new Map<string, string>();

/** Mở hoặc khởi tạo IndexedDB lưu trữ Blob ảnh bìa */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Lấy Blob ảnh bìa từ IndexedDB */
export async function getCachedCoverBlobUrl(key: string): Promise<string | null> {
  if (!key) return null;
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const blob: Blob | undefined = req.result;
        if (blob && blob instanceof Blob) {
          const url = URL.createObjectURL(blob);
          memoryCache.set(key, url);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Lưu Blob ảnh bìa vào IndexedDB */
export async function setCachedCoverBlob(key: string, blob: Blob): Promise<string> {
  if (!key || !blob) return '';
  const url = URL.createObjectURL(blob);
  memoryCache.set(key, url);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, key);
  } catch (err) {
    console.warn('[IndexedDB saveCover error]', err);
  }
  return url;
}

/** Tải ảnh bìa về máy và lưu đệm vào IndexedDB */
export async function fetchAndCacheCover(url: string, key: string): Promise<string | null> {
  if (!url || !key) return null;
  try {
    const res = await fetch(url, { referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob && blob.size > 500) {
      return await setCachedCoverBlob(key, blob);
    }
  } catch {}
  return null;
}

/** Đẩy ảnh bìa lên Supabase Storage để phục vụ qua CDN siêu tốc */
export async function uploadCoverToSupabase(slug: string, rawCoverUrl: string): Promise<string | null> {
  if (!supabase || !slug || !rawCoverUrl) return null;
  
  // Nếu đã là link Supabase Storage thì không cần upload lại
  if (rawCoverUrl.includes('supabase.co/storage/v1/object/public/')) {
    return rawCoverUrl;
  }

  try {
    const res = await fetch(rawCoverUrl, { referrerPolicy: 'no-referrer' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size < 500) return null;

    const ext = blob.type.includes('png') ? 'png' : (blob.type.includes('webp') ? 'webp' : 'jpg');
    const path = `manga-covers/${slug}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

    if (!upErr) {
      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }
  } catch (e) {
    console.warn('[uploadCoverToSupabase error]', e);
  }
  return null;
}
