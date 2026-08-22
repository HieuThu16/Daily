import type { BLManga, ChapterImage, ReadingProgress, MangaChapter, HotMangaData } from '../../types/manga';
import { blShardOf, blShardPath } from './blShards';
import { supabase } from '../../lib/supabase';

const FAVORITES_KEY = 'daily_bl_favorites';
const HISTORY_KEY = 'daily_bl_history';
const CUSTOM_BL_MANGA_KEY = 'daily_custom_bl_manga';

export function getCustomBLMangaList(): BLManga[] {
  try {
    const saved = localStorage.getItem(CUSTOM_BL_MANGA_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveCustomBLManga(manga: BLManga): void {
  const current = getCustomBLMangaList();
  const idx = current.findIndex(m => m.slug === manga.slug);
  let updated: BLManga[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = manga;
  } else {
    updated = [manga, ...current];
  }
  try {
    localStorage.setItem(CUSTOM_BL_MANGA_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save custom BL manga to localStorage', e);
  }

  // Đồng bộ lên Supabase cho mọi thiết bị
  if (supabase) {
    void (async () => {
      try {
        const user = (await supabase.auth.getUser())?.data?.user;
        if (!user) return;
        const payload = {
          user_id: user.id,
          type: 'BL',
          name: manga.title,
          author: manga.author || null,
          genre: manga.genres?.join(', ') || null,
          cover_url: manga.cover || null,
          channel: manga.slug,
          description: JSON.stringify(manga),
          is_public: true,
        };

        const { data: existing } = await supabase
          .from('media_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('channel', manga.slug)
          .eq('type', 'BL')
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase.from('media_items').update(payload).eq('id', existing[0].id);
        } else {
          await supabase.from('media_items').insert(payload);
        }
      } catch (err) {
        console.warn('Could not sync custom BLManga to Supabase', err);
      }
    })();
  }
}

export async function syncBLMangaChapters(
  manga: BLManga,
  onProgress?: (msg: string) => void
): Promise<{ updated: boolean; manga: BLManga; addedCount: number }> {
  const storyUrl = manga.url || (manga.slug ? `https://teamsany.com/manga/${manga.slug}/` : '');
  if (!storyUrl) return { updated: false, manga, addedCount: 0 };

  onProgress?.('Đang kiểm tra chapter mới từ link gốc...');
  const res = await fetch('/api/crawl-bl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: storyUrl, existingChapters: manga.chapters })
  });

  if (!res.ok) {
    let errMsg = `Lỗi server HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error) errMsg = errJson.error;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  if (!data?.success || !data?.manga) {
    throw new Error(data?.error || 'Không nhận được dữ liệu truyện từ server');
  }

  const freshManga: BLManga = data.manga;
  const oldCount = Array.isArray(manga.chapters) ? manga.chapters.length : 0;
  const newCount = Array.isArray(freshManga.chapters) ? freshManga.chapters.length : 0;

  if (newCount > oldCount) {
    onProgress?.(`Đã tìm thấy ${newCount - oldCount} chapter mới! Đang lưu...`);
    saveCustomBLManga(freshManga);
    return { updated: true, manga: freshManga, addedCount: newCount - oldCount };
  }

  saveCustomBLManga(freshManga);
  return { updated: false, manga: freshManga, addedCount: 0 };
}

/**
 * Fetch BL Manga list from DuaLeo database
 */
export async function fetchDuaLeoMangaList(): Promise<BLManga[]> {
  // /data/bl/list.json là bản đã tách URL ảnh ra file mảnh (npm run split:bl).
  // /data/bl_manga.json là bản gốc kèm ảnh, chỉ còn dùng khi chạy máy cục bộ.
  for (const url of ['/data/bl/list.json', '/data/bl_manga.json']) {
    const list = await fetchMangaArray(url);
    if (list.length > 0) return list;
  }
  return [];
}

async function fetchMangaArray(url: string): Promise<BLManga[]> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(m => ({
          ...m,
          source: m.source || 'dualeo',
          sourceName: m.sourceName || 'Dưa Leo'
        }));
      }
    }
  } catch (err) {
    console.warn(`Could not load ${url}`, err);
  }
  return [];
}

/**
 * URL ảnh của truyện BL nằm trong file mảnh riêng (npm run split:bl) để mỗi file
 * dưới 100MB — giới hạn cứng của Vercel. Trả về map: số chương → danh sách ảnh.
 */
const shardCache = new Map<number, Promise<Record<string, Record<string, ChapterImage[]>>>>();

export async function fetchBLChapterImages(slug: string): Promise<Record<string, ChapterImage[]>> {
  const shard = blShardOf(slug);
  if (!shardCache.has(shard)) {
    shardCache.set(
      shard,
      fetch(blShardPath(slug))
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({})),
    );
  }
  const data = await shardCache.get(shard)!;
  return data[slug] ?? {};
}

/**
 * Fetch BL Manga list from Sany Team database
 */
export async function fetchTeamsanyMangaList(): Promise<BLManga[]> {
  try {
    const res = await fetch('/data/teamsany_manga.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(m => ({
          ...m,
          source: 'teamsany',
          sourceName: 'Sany Team'
        }));
      }
    }
  } catch (err) {
    console.warn('Could not load /data/teamsany_manga.json', err);
  }
  return [];
}

/**
 * Fetch combined BL Manga list from all database sources (DuaLeo + Sany Team)
 */
export async function fetchBLMangaList(): Promise<BLManga[]> {
  const [dualeoList, sanyList, otruyenList] = await Promise.all([
    fetchDuaLeoMangaList(),
    fetchTeamsanyMangaList(),
    fetchOtruyenBLList(),
  ]);

  const seenSlugs = new Set<string>();
  const combined: BLManga[] = [];

  // 1. Custom / Updated BL manga (local cache & cloud updates)
  const customList = getCustomBLMangaList();
  for (const item of customList) {
    if (item.slug && !seenSlugs.has(item.slug)) {
      seenSlugs.add(item.slug);
      combined.push(item);
    }
  }

  // 2. Add Sany Team mangas
  for (const item of sanyList) {
    if (seenSlugs.has(item.slug)) continue;
    seenSlugs.add(item.slug);
    combined.push({
      ...item,
      source: 'teamsany',
      sourceName: 'Sany Team'
    });
  }

  // 3. Add DuaLeo mangas
  for (const item of dualeoList) {
    let slug = item.slug;
    if (seenSlugs.has(slug)) {
      slug = `dl-${slug}`;
    }
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    combined.push({
      ...item,
      slug,
      source: item.source || 'dualeo',
      sourceName: item.sourceName || 'Dưa Leo'
    });
  }

  // 4. Đam mỹ / shounen ai quét từ otruyen: chỉ có mục lục, ảnh tải khi mở chương.
  for (const item of otruyenList) {
    if (seenSlugs.has(item.slug)) continue;
    seenSlugs.add(item.slug);
    combined.push({ ...item, source: 'otruyen', sourceName: 'OTruyen' });
  }

  return combined;
}

async function fetchOtruyenBLList(): Promise<BLManga[]> {
  try {
    const res = await fetch('/data/bl_list.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn('Could not load /data/bl_list.json', err);
  }
  return [];
}

export async function fetchHotMangaData(): Promise<HotMangaData | null> {
  try {
    const res = await fetch('/data/bl_hot_manga.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not load /data/bl_hot_manga.json', err);
  }

  return null;
}

export async function fetchTeamsanyHotData(): Promise<HotMangaData | null> {
  try {
    const res = await fetch('/data/teamsany_hot.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not load /data/teamsany_hot.json', err);
  }
  return null;
}

const FOLLOW_KEY = 'daily_bl_following';

export function getFollows(): string[] {
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFollow(slug: string): boolean {
  const current = getFollows();
  const exists = current.includes(slug);
  const updated = exists ? current.filter(s => s !== slug) : [...current, slug];
  localStorage.setItem(FOLLOW_KEY, JSON.stringify(updated));
  return !exists;
}

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(slug: string): boolean {
  const current = getFavorites();
  const exists = current.includes(slug);
  const updated = exists ? current.filter(s => s !== slug) : [...current, slug];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  return !exists;
}

export function getReadingHistory(): Record<string, ReadingProgress> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveReadingProgress(progress: Partial<ReadingProgress> & { slug: string }): void {
  const current = getReadingHistory();
  const existing = current[progress.slug];
  const isChangingChapter = existing && progress.chapterNumber != null && progress.chapterNumber !== existing.chapterNumber;
  const scrollRatio = progress.scrollRatio !== undefined
    ? progress.scrollRatio
    : (isChangingChapter ? 0 : (existing?.scrollRatio ?? 0));

  current[progress.slug] = {
    ...(existing || { slug: progress.slug, chapterNumber: 1, chapterName: 'Chương 1' }),
    ...progress,
    scrollRatio,
    readAt: new Date().toISOString(),
  } as ReadingProgress;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(current));
}

export function getMangaProgress(slug: string): ReadingProgress | null {
  const history = getReadingHistory();
  return history[slug] || null;
}

export function hasMangaData(manga?: { chapters?: any[]; totalChapters?: number; source?: string } | null): boolean {
  if (!manga) return false;
  // Truyện otruyen chỉ lưu mục lục, ảnh tải theo chương khi mở.
  if (manga.source === 'otruyen') return (manga.chapters?.length ?? 0) > 0;
  if (!manga.chapters || manga.chapters.length === 0) return false;
  return manga.chapters.some(
    (c) => (c.images && c.images.length > 0) || (c.imageCount && c.imageCount > 0)
  );
}
