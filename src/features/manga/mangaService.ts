import type { BLManga, ReadingProgress, MangaChapter, HotMangaData } from '../../types/manga';

const FAVORITES_KEY = 'daily_bl_favorites';
const HISTORY_KEY = 'daily_bl_history';

export async function fetchBLMangaList(): Promise<BLManga[]> {
  try {
    const res = await fetch('/data/bl_manga.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not load /data/bl_manga.json, trying fallback import', err);
  }

  try {
    const fallback = await import('../../data/bl_manga.json');
    return (fallback.default || fallback) as unknown as BLManga[];
  } catch (e) {
    console.warn('Fallback import bl_manga.json not available yet', e);
    return [];
  }
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

  try {
    const fallback = await import('../../data/bl_hot_manga.json');
    return (fallback.default || fallback) as unknown as HotMangaData;
  } catch (e) {
    return null;
  }
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
