import type { NgontinhManga, ReadingProgress, HotMangaData } from '../../types/manga';
import { fetchMangadexChapterImages, isMangadexManga } from './mangadexService';

const FAVORITES_KEY = 'daily_ngontinh_favorites';
const HISTORY_KEY = 'daily_ngontinh_history';

export async function fetchNgontinhList(): Promise<NgontinhManga[]> {
  try {
    const [res1, res2, res3, res4] = await Promise.all([
      fetch('/data/ngontinh_manga_1.json'),
      fetch('/data/ngontinh_manga_2.json'),
      fetch('/data/ngontinh_manga_3.json'),
      fetch('/data/ngontinh_manga_4.json'),
    ]);
    const [d1, d2, d3, d4] = await Promise.all([
      res1.ok ? res1.json().catch(() => []) : [],
      res2.ok ? res2.json().catch(() => []) : [],
      res3.ok ? res3.json().catch(() => []) : [],
      res4.ok ? res4.json().catch(() => []) : [],
    ]);
    const list = [
      ...(Array.isArray(d1) ? d1 : []),
      ...(Array.isArray(d2) ? d2 : []),
      ...(Array.isArray(d3) ? d3 : []),
      ...(Array.isArray(d4) ? d4 : []),
      ...(await fetchExtraList()),
      ...(await fetchOtruyenGenreList('/data/school_life_list.json')),
    ];
    if (list.length > 0) {
      return dedupeBySlug(list);
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

// Các bộ crawl thêm (romance, shoujo, slice of life, shounen ai, đam mỹ) đã gộp và
// bỏ URL ảnh trong public/data/extra_manga.json (npm run split:extra). Đã lọc trùng slug
// với ngôn tình từ lúc gộp, ảnh reader tự tải theo slug khi mở chương.
async function fetchExtraList(): Promise<NgontinhManga[]> {
  try {
    const res = await fetch('/data/extra_manga.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn('Could not load /data/extra_manga.json', err);
  }
  return [];
}

function dedupeBySlug(list: NgontinhManga[]): NgontinhManga[] {
  const seen = new Map<string, NgontinhManga>();
  for (const item of list) if (!seen.has(item.slug)) seen.set(item.slug, item);
  return [...seen.values()];
}

// Danh sách quét theo thể loại từ otruyen (npm run crawl:genre): chỉ có mục lục
// chương, ảnh từng trang tải khi mở chương qua fetchNgontinhChapterImages.
export async function fetchOtruyenGenreList(url: string): Promise<NgontinhManga[]> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn(`Could not load ${url}`, err);
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

export function saveNgontinhProgress(progress: Partial<ReadingProgress> & { slug: string }): void {
  const current = getNgontinhHistory();
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

export function getNgontinhProgress(slug: string): ReadingProgress | null {
  const history = getNgontinhHistory();
  return history[slug] || null;
}

export function hasMangaData(manga?: { chapters?: any[]; totalChapters?: number; source?: string } | null): boolean {
  if (!manga) return false;
  // Truyện MangaDex chưa cào sẵn chương, chương và ảnh tải khi mở truyện.
  if (isMangadexManga(manga)) return true;
  // Truyện otruyen chỉ lưu mục lục, ảnh tải theo chương khi mở.
  if (manga.source === 'otruyen') return (manga.chapters?.length ?? 0) > 0;
  if (!manga.chapters || manga.chapters.length === 0) return false;
  return manga.chapters.some(
    (c) => (c.images && c.images.length > 0) || (c.imageCount && c.imageCount > 0)
  );
}

const otruyenChapterCache = new Map<string, any[]>();

export async function fetchNgontinhChapterImages(
  manga: NgontinhManga | string,
  chapterNum: number
): Promise<any[]> {
  if (typeof manga !== 'string' && isMangadexManga(manga)) {
    const chapter = manga.chapters?.find((c) => c.number === chapterNum);
    return chapter?.chapterId ? fetchMangadexChapterImages(chapter.chapterId) : [];
  }

  const slug = typeof manga === 'string' ? manga : manga.slug;
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


