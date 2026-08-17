import type { BLManga, ChapterImage, ReadingProgress, MangaChapter, HotMangaData } from '../../types/manga';
import { blShardOf, blShardPath } from './blShards';

const FAVORITES_KEY = 'daily_bl_favorites';
const HISTORY_KEY = 'daily_bl_history';

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
  const [dualeoList, sanyList] = await Promise.all([
    fetchDuaLeoMangaList(),
    fetchTeamsanyMangaList(),
  ]);

  const seenSlugs = new Set<string>();
  const combined: BLManga[] = [];

  // Add Sany Team mangas first or merged
  for (const item of sanyList) {
    seenSlugs.add(item.slug);
    combined.push({
      ...item,
      source: 'teamsany',
      sourceName: 'Sany Team'
    });
  }

  // Add DuaLeo mangas
  for (const item of dualeoList) {
    let slug = item.slug;
    if (seenSlugs.has(slug)) {
      slug = `dl-${slug}`;
    }
    seenSlugs.add(slug);
    combined.push({
      ...item,
      slug,
      source: item.source || 'dualeo',
      sourceName: item.sourceName || 'Dưa Leo'
    });
  }

  return combined;
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

export function saveReadingProgress(progress: ReadingProgress): void {
  const current = getReadingHistory();
  current[progress.slug] = {
    ...progress,
    readAt: new Date().toISOString(),
  };
  localStorage.setItem(HISTORY_KEY, JSON.stringify(current));
}

export function getMangaProgress(slug: string): ReadingProgress | null {
  const history = getReadingHistory();
  return history[slug] || null;
}

export function hasMangaData(manga?: { chapters?: any[]; totalChapters?: number } | null): boolean {
  if (!manga) return false;
  if (!manga.chapters || manga.chapters.length === 0) return false;
  return manga.chapters.some(
    (c) => (c.images && c.images.length > 0) || (c.imageCount && c.imageCount > 0)
  );
}
