import type { BLManga as HManga, ReadingProgress, MangaChapter, ChapterImage } from '../../types/manga';

const FAVORITES_KEY = 'daily_h_favorites';
const HISTORY_KEY = 'daily_h_history';
const FOLLOWS_KEY = 'daily_h_follows';
const CUSTOM_H_MANGA_KEY = 'daily_custom_h_manga';

export type { HManga };

export function getChapterImageUrl(img?: ChapterImage): string {
  if (!img) return '';
  return typeof img === 'string' ? img : img.url || '';
}

export function getCustomHMangaList(): HManga[] {
  try {
    const saved = localStorage.getItem(CUSTOM_H_MANGA_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveCustomHManga(manga: HManga): void {
  const current = getCustomHMangaList();
  const idx = current.findIndex(m => m.slug === manga.slug);
  let updated: HManga[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = manga;
  } else {
    updated = [manga, ...current];
  }
  try {
    localStorage.setItem(CUSTOM_H_MANGA_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save custom manga to localStorage', e);
  }
}

export async function fetchHMangaList(): Promise<HManga[]> {
  const customList = getCustomHMangaList();
  try {
    const res = await fetch('/data/h_manga.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const seen = new Set<string>();
        const combined: HManga[] = [];
        for (const item of customList) {
          seen.add(item.slug);
          combined.push(item);
        }
        for (const item of data) {
          if (!seen.has(item.slug)) {
            seen.add(item.slug);
            combined.push(item);
          }
        }
        return combined;
      }
    }
  } catch (err) {
    console.warn('Could not load /data/h_manga.json', err);
  }
  return customList;
}

export async function crawlAndSaveStory(url: string, onProgress?: (msg: string) => void): Promise<HManga> {
  onProgress?.('Đang gửi yêu cầu cào truyện đến server...');
  const res = await fetch('/api/crawl-truyenh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
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

  onProgress?.('Đang lưu truyện vào bộ nhớ ứng dụng...');
  saveCustomHManga(data.manga);
  return data.manga;
}

export function getHMangaFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function toggleHMangaFavorite(slug: string): boolean {
  const current = getHMangaFavorites();
  let updated: string[];
  let isFav = false;
  if (current.includes(slug)) {
    updated = current.filter(s => s !== slug);
  } else {
    updated = [...current, slug];
    isFav = true;
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch {}
  return isFav;
}

export function getHMangaFollows(): string[] {
  try {
    const saved = localStorage.getItem(FOLLOWS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function toggleHMangaFollow(slug: string): boolean {
  const current = getHMangaFollows();
  let updated: string[];
  let isFollowed = false;
  if (current.includes(slug)) {
    updated = current.filter(s => s !== slug);
  } else {
    updated = [...current, slug];
    isFollowed = true;
  }
  try {
    localStorage.setItem(FOLLOWS_KEY, JSON.stringify(updated));
  } catch {}
  return isFollowed;
}

export function getHMangaHistory(): Record<string, ReadingProgress> {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function getHMangaProgress(slug: string): ReadingProgress | undefined {
  const history = getHMangaHistory();
  return history[slug];
}

export function saveHMangaProgress(slug: string, progress: Partial<ReadingProgress>): void {
  const history = getHMangaHistory();
  const existing = history[slug] || { slug, chapterNumber: 1, chapterName: 'Chapter 1', readAt: new Date().toISOString() };
  history[slug] = {
    ...existing,
    ...progress,
    readAt: new Date().toISOString(),
  } as ReadingProgress;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}
