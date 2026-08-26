import type { NgontinhManga, ReadingProgress, HotMangaData } from '../../types/manga';
import { fetchMangadexChapterImages, isMangadexManga } from './mangadexService';
import { ngontinhShardPath } from './ngontinhShards';

const FAVORITES_KEY = 'daily_ngontinh_favorites';
const HISTORY_KEY = 'daily_ngontinh_history';

/**
 * Danh sách truyện cho lưới bìa — chỉ tải file chỉ mục (~7MB).
 *
 * Trước đây hàm này tải 4 file ngontinh_manga_*.json (112MB) rồi tuần tự thêm
 * extra_manga.json (41MB) và school_life_list.json (16MB) = 169MB, chỉ để vẽ
 * lưới bìa. 98% dung lượng là url ảnh từng trang của từng chương — thứ mà
 * reader vốn đã tự gọi lại từ otruyenapi.
 *
 * Mục lục chương KHÔNG còn nằm ở đây; gọi `fetchNgontinhChapters(slug)` khi mở
 * truyện. Chạy `npm run build:ngontinh` để sinh lại chỉ mục.
 */
export async function fetchNgontinhList(): Promise<NgontinhManga[]> {
  try {
    const res = await fetch('/data/ngontinh_index.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((m: any) => ({ ...m, chapters: m.chapters ?? [] }));
      }
    }
  } catch (err) {
    console.warn('Không tải được /data/ngontinh_index.json', err);
  }

  // Chưa chạy build:ngontinh thì quay về cách cũ để app vẫn có dữ liệu.
  return fetchNgontinhListLegacy();
}

/** Đường cũ: tải các file gốc. Nặng, chỉ dùng khi chưa có chỉ mục. */
async function fetchNgontinhListLegacy(): Promise<NgontinhManga[]> {
  try {
    const parts = await Promise.all(
      ['1', '2', '3', '4'].map((n) =>
        fetch(`/data/ngontinh_manga_${n}.json`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ),
    );
    const list = [
      ...parts.flat().filter(Boolean),
      ...(await fetchExtraList()),
      ...(await fetchOtruyenGenreList('/data/school_life_list.json')),
    ];
    if (list.length > 0) return dedupeBySlug(list);
  } catch (err) {
    console.warn('Could not load split ngontinh data', err);
  }
  return [];
}

/** Nhớ mảnh đã tải để đọc nhiều chương trong cùng truyện khỏi tải lại. */
const chapterShardCache = new Map<string, Record<string, any[]>>();

/**
 * Mục lục chương của một truyện, tải đúng mảnh chứa nó (~0.7MB).
 * Không có mảnh (chưa build) thì trả rỗng — reader tự gọi otruyenapi.
 */
export async function fetchNgontinhChapters(slug: string): Promise<any[]> {
  if (!slug) return [];
  const path = ngontinhShardPath(slug);
  const cached = chapterShardCache.get(path);
  if (cached) return cached[slug] ?? [];

  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    const map = await res.json();
    chapterShardCache.set(path, map);
    return map?.[slug] ?? [];
  } catch (err) {
    console.warn(`Không tải được mục lục chương ${path}`, err);
    return [];
  }
}

/** Truyện kèm mục lục chương — dùng cho trang chi tiết và trang đọc. */
export async function fetchNgontinhBySlug(slug: string): Promise<NgontinhManga | null> {
  const [list, chapters] = await Promise.all([fetchNgontinhList(), fetchNgontinhChapters(slug)]);
  const found = list.find((m) => m.slug === slug);
  if (!found) return null;
  // Đường cũ đã kèm sẵn chương thì giữ nguyên, khỏi ghi đè bằng mảng rỗng.
  return chapters.length > 0 ? { ...found, chapters } : found;
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

import { syncMangaInteraction } from '../../lib/mangaCloudSync';

export function toggleNgontinhFollow(slug: string): boolean {
  const current = getNgontinhFollows();
  const exists = current.includes(slug);
  const updated = exists ? current.filter(s => s !== slug) : [...current, slug];
  localStorage.setItem(FOLLOW_KEY, JSON.stringify(updated));
  void syncMangaInteraction({
    manga_type: 'NGONTINH',
    slug,
    is_following: !exists,
  });
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
  void syncMangaInteraction({
    manga_type: 'NGONTINH',
    slug,
    is_favorite: !exists,
  });
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

  const readAt = new Date().toISOString();
  current[progress.slug] = {
    ...(existing || { slug: progress.slug, chapterNumber: 1, chapterName: 'Chương 1' }),
    ...progress,
    scrollRatio,
    readAt,
  } as ReadingProgress;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(current));

  void syncMangaInteraction({
    manga_type: 'NGONTINH',
    slug: progress.slug,
    last_chapter: progress.chapterNumber,
    last_chapter_name: progress.chapterName,
    last_read_at: readAt,
  });
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


