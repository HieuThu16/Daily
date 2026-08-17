import type { NgontinhManga, ReadingProgress, HotMangaData } from '../../types/manga';

const FAVORITES_KEY = 'daily_ngontinh_favorites';
const HISTORY_KEY = 'daily_ngontinh_history';

export async function fetchNgontinhList(): Promise<NgontinhManga[]> {
  try {
    const [res1, res2] = await Promise.all([
      fetch('/data/ngontinh_manga_1.json'),
      fetch('/data/ngontinh_manga_2.json'),
    ]);
    if (res1.ok && res2.ok) {
      const [d1, d2] = await Promise.all([res1.json(), res2.json()]);
      const list1 = Array.isArray(d1) ? d1 : [];
      const list2 = Array.isArray(d2) ? d2 : [];
      if (list1.length > 0 || list2.length > 0) {
        return [...list1, ...list2];
      }
    }
  } catch (err) {
    console.warn('Could not load split ngontinh data', err);
  }

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

  return [];
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

  return null;
}

const FOLLOW_KEY = 'daily_ngontinh_following';

export function getNgontinhFollows(): string[] {
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleNgontinhFollow(slug: string): boolean {
  const current = getNgontinhFollows();
  const exists = current.includes(slug);
  const updated = exists ? current.filter(s => s !== slug) : [...current, slug];
  localStorage.setItem(FOLLOW_KEY, JSON.stringify(updated));
  return !exists;
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

const otruyenChapterCache = new Map<string, any[]>();

export async function fetchNgontinhChapterImages(slug: string, chapterNum: number): Promise<any[]> {
  const cacheKey = `${slug}:${chapterNum}`;
  if (otruyenChapterCache.has(cacheKey)) {
    return otruyenChapterCache.get(cacheKey) || [];
  }

  try {
    const res = await fetch(`https://otruyenapi.com/v1/api/truyen-tranh/${slug}`);
    if (!res.ok) return [];
    const data = await res.json();
    const serverData = data?.data?.item?.chapters?.[0]?.server_data || [];
    const chMatch = serverData.find((c: any) => parseFloat(c.chapter_name) === chapterNum);
    if (!chMatch?.chapter_api_data) return [];

    const chRes = await fetch(chMatch.chapter_api_data);
    if (!chRes.ok) return [];
    const chData = await chRes.json();
    const domain = chData?.data?.domain_cdn || '';
    const chPath = chData?.data?.item?.chapter_path || '';
    const imgs = chData?.data?.item?.chapter_image || [];
    const result = imgs.map((img: any, idx: number) => ({
      url: `${domain}/${chPath}/${img.image_file}`,
      alt: `Trang ${idx + 1}`,
      index: idx + 1,
    }));
    otruyenChapterCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('Could not dynamically fetch chapter images from OTruyen', err);
    return [];
  }
}


