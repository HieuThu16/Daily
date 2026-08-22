import type { BLManga as HManga, ReadingProgress, MangaChapter, ChapterImage } from '../../types/manga';
import { supabase } from '../../lib/supabase';

const FAVORITES_KEY = 'daily_h_favorites';
const HISTORY_KEY = 'daily_h_history';
const FOLLOWS_KEY = 'daily_h_follows';
const CUSTOM_H_MANGA_KEY = 'daily_custom_h_manga';

export type { HManga };

export function getChapterImageUrl(img?: ChapterImage): string {
  if (!img) return '';
  return typeof img === 'string' ? img : img.url || '';
}

export function isValidHMangaCover(url?: string | null): boolean {
  if (!url) return false;
  if (url.includes('011111111111') || url.includes('images-story/011111111111')) return false;
  return true;
}

export function sanitizeHManga(manga: HManga): HManga {
  if (!manga) return manga;
  if (!isValidHMangaCover(manga.cover)) {
    const ch1 = getChapterImageUrl(manga.chapters?.[0]?.images?.[0]);
    return { ...manga, cover: ch1 || manga.cover || '' };
  }
  return manga;
}

export function getCustomHMangaList(): HManga[] {
  try {
    const saved = localStorage.getItem(CUSTOM_H_MANGA_KEY);
    const list: HManga[] = saved ? JSON.parse(saved) : [];
    return list.map(sanitizeHManga);
  } catch {
    return [];
  }
}

export function saveCustomHManga(manga: HManga): void {
  const cleanManga = sanitizeHManga(manga);
  const current = getCustomHMangaList();
  const idx = current.findIndex(m => m.slug === cleanManga.slug);
  let updated: HManga[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = cleanManga;
  } else {
    updated = [cleanManga, ...current];
  }
  try {
    localStorage.setItem(CUSTOM_H_MANGA_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save custom manga to localStorage', e);
  }

  // Đồng bộ lên Supabase để dùng chung cho mọi thiết bị (điện thoại & máy tính)
  if (supabase) {
    void (async () => {
      try {
        const user = (await supabase.auth.getUser())?.data?.user;
        if (!user) return;
        const payload = {
          user_id: user.id,
          type: 'STORY',
          name: cleanManga.title,
          author: cleanManga.author || null,
          genre: cleanManga.genres?.join(', ') || null,
          cover_url: cleanManga.cover || null,
          channel: cleanManga.slug,
          description: JSON.stringify(cleanManga),
          is_public: true,
        };

        const { data: existing } = await supabase
          .from('media_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('channel', cleanManga.slug)
          .in('type', ['STORY', 'MANGA'])
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase.from('media_items').update(payload).eq('id', existing[0].id);
        } else {
          await supabase.from('media_items').insert(payload);
        }
      } catch (err) {
        console.warn('Could not sync custom HManga to Supabase', err);
      }
    })();
  }
}

export async function fetchHMangaList(): Promise<HManga[]> {
  const customList = getCustomHMangaList();
  const seen = new Set<string>();
  const combined: HManga[] = [];

  for (const item of customList) {
    seen.add(item.slug);
    combined.push(sanitizeHManga(item));
  }

  // 1. Tải truyện từ file h_manga.json
  try {
    const res = await fetch('/data/h_manga.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          if (!seen.has(item.slug)) {
            seen.add(item.slug);
            combined.push(sanitizeHManga(item));
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not load /data/h_manga.json', err);
  }

  // 2. Tải và đồng bộ từ tài khoản Supabase (cho điện thoại & mọi thiết bị)
  if (supabase) {
    try {
      const { data: rows } = await supabase
        .from('media_items')
        .select('*')
        .in('type', ['STORY', 'MANGA'])
        .is('deleted_at', null);

      if (rows && rows.length > 0) {
        let hasNewFromCloud = false;
        const currentCustom = getCustomHMangaList();

        for (const row of rows) {
          if (row.description && row.description.startsWith('{')) {
            try {
              const mangaObj = JSON.parse(row.description) as HManga;
              if (mangaObj?.slug) {
                const clean = sanitizeHManga(mangaObj);
                if (!seen.has(clean.slug)) {
                  seen.add(clean.slug);
                  combined.unshift(clean);
                }
                if (!currentCustom.some(m => m.slug === clean.slug)) {
                  currentCustom.push(clean);
                  hasNewFromCloud = true;
                }
              }
            } catch {}
          }
        }

        if (hasNewFromCloud) {
          try {
            localStorage.setItem(CUSTOM_H_MANGA_KEY, JSON.stringify(currentCustom));
          } catch {}
        }
      }

      // Tự động đẩy truyện local chưa có trên Supabase lên Cloud
      const user = (await supabase.auth.getUser())?.data?.user;
      if (user && customList.length > 0) {
        void (async () => {
          for (const manga of customList) {
            try {
              const { data: existing } = await supabase
                .from('media_items')
                .select('id')
                .eq('user_id', user.id)
                .eq('channel', manga.slug)
                .in('type', ['STORY', 'MANGA'])
                .limit(1);

              if (!existing || existing.length === 0) {
                await supabase.from('media_items').insert({
                  user_id: user.id,
                  type: 'STORY',
                  name: manga.title,
                  author: manga.author || null,
                  genre: manga.genres?.join(', ') || null,
                  cover_url: manga.cover || null,
                  channel: manga.slug,
                  description: JSON.stringify(manga),
                  is_public: true,
                });
              }
            } catch {}
          }
        })();
      }
    } catch (err) {
      console.warn('Could not load cloud HManga from Supabase', err);
    }
  }

  return combined;
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
  const existing = history[slug];
  const isChangingChapter = existing && progress.chapterNumber != null && progress.chapterNumber !== existing.chapterNumber;
  const scrollRatio = progress.scrollRatio !== undefined 
    ? progress.scrollRatio 
    : (isChangingChapter ? 0 : (existing?.scrollRatio ?? 0));

  history[slug] = {
    ...(existing || { slug, chapterNumber: 1, chapterName: 'Chapter 1' }),
    ...progress,
    scrollRatio,
    readAt: new Date().toISOString(),
  } as ReadingProgress;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}
