import type { NgontinhManga, ReadingProgress, HotMangaData } from '../../types/manga';

const FAVORITES_KEY = 'daily_ngontinh_favorites';
const HISTORY_KEY = 'daily_ngontinh_history';

export async function fetchNgontinhList(): Promise<NgontinhManga[]> {
  try {
    const res = await fetch('/data/ngontinh_manga.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not load /data/ngontinh_manga.json from public', err);
  }

  try {
    const fallback = await import('../../data/ngontinh_manga.json');
    return (fallback.default || fallback) as unknown as NgontinhManga[];
  } catch (e) {
    console.warn('Fallback import ngontinh_manga.json not available yet', e);
    return [];
  }
}

export async function fetchNgontinhHotData(): Promise<HotMangaData | null> {
  try {
    const res = await fetch('/data/ngontinh_hot.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not load /data/ngontinh_hot.json from public', err);
  }

  try {
    const fallback = await import('../../data/ngontinh_hot.json');
    return (fallback.default || fallback) as unknown as HotMangaData;
  } catch (e) {
    return null;
  }
}

export function getNgontinhFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleNgontinhFavorite(slug: string): boolean {
  const current = getNgontinhFavorites();
  const exists = current.includes(slug);
  const updated = exists ? current.filter(s => s !== slug) : [...current, slug];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  return !exists;
}

export function getNgontinhHistory(): Record<string, ReadingProgress> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveNgontinhProgress(progress: ReadingProgress): void {
  const current = getNgontinhHistory();
  current[progress.slug] = {
    ...progress,
    readAt: new Date().toISOString(),
  };
  localStorage.setItem(HISTORY_KEY, JSON.stringify(current));
}

export function getNgontinhProgress(slug: string): ReadingProgress | null {
  const history = getNgontinhHistory();
  return history[slug] || null;
}

export function hasMangaData(manga?: { chapters?: any[]; totalChapters?: number } | null): boolean {
  if (!manga) return false;
  if (!manga.chapters || manga.chapters.length === 0) return false;
  return manga.chapters.some(
    (c) => (c.images && c.images.length > 0) || (c.imageCount && c.imageCount > 0)
  );
}

