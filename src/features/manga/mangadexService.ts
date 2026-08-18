// Đọc truyện MangaDex trực tiếp bằng API công khai, không cào sẵn:
// danh sách chương lấy khi mở truyện, ảnh lấy khi mở chương.
// Ưu tiên bản tiếng Việt, không có thì tiếng Anh, không nữa thì bản bất kỳ.
import type { MangaChapter, MangaImage, NgontinhManga } from '../../types/manga';

const API = 'https://api.mangadex.org';
const LANG_ORDER = ['vi', 'en'];
const PAGE_SIZE = 100;

export function isMangadexManga(manga?: { source?: string } | null): boolean {
  return manga?.source === 'mangadex';
}

const chapterCache = new Map<string, MangaChapter[]>();
const imageCache = new Map<string, MangaImage[]>();

async function fetchFeedPage(mangaId: string, offset: number): Promise<any[]> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
    'order[chapter]': 'asc',
    'includes[]': 'scanlation_group',
  });
  for (const rating of ['safe', 'suggestive', 'erotica', 'pornographic']) {
    params.append('contentRating[]', rating);
  }
  const res = await fetch(`${API}/manga/${mangaId}/feed?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

/** Danh sách chương của một bộ MangaDex, đã lọc theo ngôn ngữ và bỏ chương trùng số. */
export async function fetchMangadexChapters(mangaId: string): Promise<MangaChapter[]> {
  const cached = chapterCache.get(mangaId);
  if (cached) return cached;

  let raw: any[] = [];
  try {
    // Feed tối đa 500 chương (5 trang) — quá số đó thì hiếm và không đáng tải thêm.
    for (let page = 0; page < 5; page++) {
      const batch = await fetchFeedPage(mangaId, page * PAGE_SIZE);
      raw = raw.concat(batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch (err) {
    console.warn('Could not load MangaDex feed', err);
    return [];
  }

  const readable = raw.filter(
    (c) => !c?.attributes?.externalUrl && !c?.attributes?.isUnavailable
  );
  const langs = new Set(readable.map((c) => c.attributes.translatedLanguage));
  const lang = LANG_ORDER.find((l) => langs.has(l)) ?? [...langs][0];

  const byNumber = new Map<number, MangaChapter>();
  for (const c of readable) {
    if (c.attributes.translatedLanguage !== lang) continue;
    const number = parseFloat(c.attributes.chapter ?? '');
    if (Number.isNaN(number) || byNumber.has(number)) continue;
    byNumber.set(number, {
      number,
      name: c.attributes.title ? `Chapter ${number}: ${c.attributes.title}` : `Chapter ${number}`,
      url: `https://mangadex.org/chapter/${c.id}`,
      chapterId: c.id,
      imageCount: c.attributes.pages ?? 0,
    });
  }

  const chapters = [...byNumber.values()].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  chapterCache.set(mangaId, chapters);
  return chapters;
}

/** Bổ sung danh sách chương vào một bộ MangaDex đang thiếu chương. */
export async function hydrateMangadexManga(manga: NgontinhManga): Promise<NgontinhManga> {
  if (!isMangadexManga(manga) || manga.chapters?.length || !manga.id) return manga;
  const chapters = await fetchMangadexChapters(manga.id);
  if (chapters.length === 0) return manga;
  return { ...manga, chapters, totalChapters: chapters.length };
}

/** URL ảnh của một chương MangaDex. */
export async function fetchMangadexChapterImages(chapterId: string): Promise<MangaImage[]> {
  const cached = imageCache.get(chapterId);
  if (cached) return cached;

  try {
    const res = await fetch(`${API}/at-home/server/${chapterId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const base = data?.baseUrl;
    const hash = data?.chapter?.hash;
    const files: string[] = data?.chapter?.data ?? [];
    if (!base || !hash || files.length === 0) return [];
    const images = files.map((file, idx) => ({
      url: `${base}/data/${hash}/${file}`,
      alt: `Trang ${idx + 1}`,
      index: idx + 1,
    }));
    imageCache.set(chapterId, images);
    return images;
  } catch (err) {
    console.warn('Could not load MangaDex chapter images', err);
    return [];
  }
}
