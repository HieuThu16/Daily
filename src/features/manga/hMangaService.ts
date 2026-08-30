import type { BLManga as HManga, ReadingProgress, ChapterImage } from '../../types/manga';
import { supabase } from '../../lib/supabase';
import { uploadCoverToSupabase } from '../../lib/mangaCoverCache';
import { apiPost } from '../../lib/apiFetch'

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

        let finalCover = cleanManga.cover || null;
        if (finalCover && !finalCover.includes('supabase.co/storage/v1/object/public/')) {
          const cloudCover = await uploadCoverToSupabase(cleanManga.slug, finalCover);
          if (cloudCover) {
            finalCover = cloudCover;
            cleanManga.cover = cloudCover;
            try {
              const currentList = getCustomHMangaList();
              const mIdx = currentList.findIndex(m => m.slug === cleanManga.slug);
              if (mIdx >= 0) {
                currentList[mIdx].cover = cloudCover;
                localStorage.setItem(CUSTOM_H_MANGA_KEY, JSON.stringify(currentList));
              }
            } catch {}
          }
        }

        const payload = {
          user_id: user.id,
          type: 'STORY',
          name: cleanManga.title,
          author: cleanManga.author || null,
          genre: cleanManga.genres?.join(', ') || null,
          cover_url: finalCover,
          channel: cleanManga.slug,
          description: JSON.stringify(cleanManga),
          is_public: true,
        };

        const { data: existing } = await supabase
          .from('media_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('channel', cleanManga.slug)
          .eq('type', 'STORY')
          .neq('genre', 'H_PROGRESS')
          .neq('genre', 'H_SCREENSHOT')
          .neq('genre', 'H_USER_PREF')
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


/** Chỉ tài khoản này được xoá truyện H khỏi kho chung. RLS trên Supabase chốt lại lần nữa. */
export const H_MANGA_OWNER_EMAIL = 'truongnguyenminhhieu100@gmail.com'

export async function canDeleteHManga(): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data } = await supabase.auth.getUser()
    return (data?.user?.email ?? '').toLowerCase() === H_MANGA_OWNER_EMAIL
  } catch {
    return false
  }
}

/** Slug đã xoá vĩnh viễn — mọi máy đều lọc theo danh sách này. */
export async function fetchDeletedHMangaSlugs(): Promise<Set<string>> {
  if (!supabase) return new Set()
  try {
    const { data } = await supabase.from('h_manga_deleted').select('slug')
    return new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug))
  } catch {
    return new Set()
  }
}

/**
 * Xoá vĩnh viễn một truyện H: ghi vào sổ đen dùng chung, xoá bản ghi đám mây
 * và bản lưu trên máy. Không phải chủ kho thì Supabase trả lỗi ngay.
 */
export async function deleteHMangaForever(manga: { slug: string; title?: string }): Promise<void> {
  if (!supabase) throw new Error('Chưa kết nối Supabase')

  const { data: auth } = await supabase.auth.getUser()
  const email = auth?.user?.email ?? ''
  if (email.toLowerCase() !== H_MANGA_OWNER_EMAIL) {
    throw new Error('Chỉ tài khoản Hieu100 mới được xoá truyện')
  }

  const { error } = await supabase
    .from('h_manga_deleted')
    .upsert({ slug: manga.slug, title: manga.title ?? null, deleted_by: email }, { onConflict: 'slug' })
  if (error) throw new Error(error.message)

  // Truyện tự thêm còn nằm ở media_items — xoá hẳn, không để lại rác.
  try {
    await supabase.from('media_items').delete().eq('channel', manga.slug).in('type', ['STORY', 'MANGA'])
  } catch (err) {
    console.warn('Không xoá được bản ghi media_items:', err)
  }

  try {
    const rest = getCustomHMangaList().filter((m) => m.slug !== manga.slug)
    localStorage.setItem(CUSTOM_H_MANGA_KEY, JSON.stringify(rest))
  } catch (err) {
    console.warn('Không xoá được bản lưu trên máy:', err)
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
          if (row.genre === 'H_PROGRESS' || row.genre === 'H_SCREENSHOT' || row.genre === 'H_USER_PREF') {
            continue;
          }
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
                .eq('type', 'STORY')
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

      // Đồng bộ tiến độ, yêu thích, theo dõi
      void syncHMangaProgressWithSupabase();
      void syncHMangaUserPrefsWithSupabase();
    } catch (err) {
      console.warn('Could not load cloud HManga from Supabase', err);
    }
  }

  // Bỏ hẳn truyện đã xoá vĩnh viễn, kể cả bản đến từ file tĩnh h_manga.json.
  const deleted = await fetchDeletedHMangaSlugs();
  return deleted.size > 0 ? combined.filter((m) => !deleted.has(m.slug)) : combined;
}

export async function crawlAndSaveStory(url: string, onProgress?: (msg: string) => void): Promise<HManga> {
  onProgress?.('Đang gửi yêu cầu cào truyện đến server...');
  const data = await apiPost('/api/crawl-truyenh', { url }, 'Không cào được truyện');
  if (!data?.success || !data?.manga) {
    throw new Error(data?.error || 'Không nhận được dữ liệu truyện từ server');
  }

  onProgress?.('Đang lưu truyện vào bộ nhớ ứng dụng...');
  saveCustomHManga(data.manga);
  return data.manga;
}

export async function syncHMangaChapters(
  manga: HManga,
  onProgress?: (msg: string) => void
): Promise<{ updated: boolean; manga: HManga; addedCount: number }> {
  const storyUrl = manga.url || (manga.slug ? `https://vietmanhwa.com/manhwa-18/${manga.slug}` : '');
  if (!storyUrl) return { updated: false, manga, addedCount: 0 };

  onProgress?.('Đang kiểm tra chapter mới từ link gốc...');
  const data = await apiPost(
    '/api/crawl-truyenh',
    { url: storyUrl, existingChapters: manga.chapters },
    'Không kiểm tra được chapter mới',
  );
  if (!data?.success || !data?.manga) {
    throw new Error(data?.error || 'Không nhận được dữ liệu truyện từ server');
  }

  const freshManga: HManga = data.manga;
  const cleanCover = (isValidHMangaCover(freshManga.cover) ? freshManga.cover : manga.cover) 
    || getChapterImageUrl(freshManga.chapters?.[0]?.images?.[0]) 
    || manga.cover 
    || '';
  const mergedManga: HManga = {
    ...manga,
    ...freshManga,
    cover: cleanCover,
    title: freshManga.title || manga.title,
    author: (freshManga.author && freshManga.author !== 'Đang cập nhật') ? freshManga.author : manga.author,
  };
  const oldCount = Array.isArray(manga.chapters) ? manga.chapters.length : 0;
  const newCount = Array.isArray(mergedManga.chapters) ? mergedManga.chapters.length : 0;

  if (newCount > oldCount) {
    onProgress?.(`Đã tìm thấy ${newCount - oldCount} chapter mới! Đang lưu...`);
    saveCustomHManga(mergedManga);
    return { updated: true, manga: mergedManga, addedCount: newCount - oldCount };
  }

  saveCustomHManga(mergedManga);
  return { updated: false, manga: mergedManga, addedCount: 0 };
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

  if (supabase) {
    void syncUserPrefToSupabase('favorites', updated);
  }
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

  if (supabase) {
    void syncUserPrefToSupabase('follows', updated);
  }
  return isFollowed;
}

async function syncUserPrefToSupabase(kind: 'favorites' | 'follows', items: string[]) {
  if (!supabase) return;
  try {
    const user = (await supabase.auth.getUser())?.data?.user;
    if (!user) return;
    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'STORY')
      .eq('genre', 'H_USER_PREF')
      .eq('channel', kind)
      .limit(1);

    const payload = {
      user_id: user.id,
      type: 'STORY',
      genre: 'H_USER_PREF',
      channel: kind,
      name: `H Manga ${kind}`,
      description: JSON.stringify(items),
      is_public: false,
    };

    if (existing && existing.length > 0) {
      await supabase.from('media_items').update(payload).eq('id', existing[0].id);
    } else {
      await supabase.from('media_items').insert(payload);
    }
  } catch (err) {
    console.warn(`Could not sync ${kind} to Supabase`, err);
  }
}

export async function syncHMangaUserPrefsWithSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: rows } = await supabase
      .from('media_items')
      .select('*')
      .eq('type', 'STORY')
      .eq('genre', 'H_USER_PREF')
      .is('deleted_at', null);

    if (rows && rows.length > 0) {
      for (const row of rows) {
        if (row.channel === 'favorites' && row.description) {
          try {
            const list = JSON.parse(row.description) as string[];
            if (Array.isArray(list)) {
              const local = getHMangaFavorites();
              const merged = Array.from(new Set([...local, ...list]));
              localStorage.setItem(FAVORITES_KEY, JSON.stringify(merged));
            }
          } catch {}
        } else if (row.channel === 'follows' && row.description) {
          try {
            const list = JSON.parse(row.description) as string[];
            if (Array.isArray(list)) {
              const local = getHMangaFollows();
              const merged = Array.from(new Set([...local, ...list]));
              localStorage.setItem(FOLLOWS_KEY, JSON.stringify(merged));
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('Could not sync H user prefs from Supabase', err);
  }
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

// Map timer debounce cho việc đồng bộ tiến độ lên Supabase
const progressSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function syncProgressToSupabase(slug: string, progress: ReadingProgress): Promise<void> {
  if (!supabase) return;
  try {
    const user = (await supabase.auth.getUser())?.data?.user;
    if (!user) return;

    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'STORY')
      .eq('genre', 'H_PROGRESS')
      .eq('channel', slug)
      .limit(1);

    const payload = {
      user_id: user.id,
      type: 'STORY',
      genre: 'H_PROGRESS',
      name: progress.chapterName || `Đang đọc ${slug}`,
      channel: slug,
      current_chapter: progress.chapterNumber,
      description: JSON.stringify(progress),
      status: 'IN_PROGRESS',
      is_public: false,
    };

    if (existing && existing.length > 0) {
      await supabase.from('media_items').update(payload).eq('id', existing[0].id);
    } else {
      await supabase.from('media_items').insert(payload);
    }
  } catch (err) {
    console.warn('Could not sync H progress to Supabase', err);
  }
}

export function saveHMangaProgress(slug: string, progress: Partial<ReadingProgress>): void {
  const history = getHMangaHistory();
  const existing = history[slug];
  const isChangingChapter = existing && progress.chapterNumber != null && progress.chapterNumber !== existing.chapterNumber;
  const scrollRatio = progress.scrollRatio !== undefined 
    ? progress.scrollRatio 
    : (isChangingChapter ? 0 : (existing?.scrollRatio ?? 0));

  const updatedProgress: ReadingProgress = {
    ...(existing || { slug, chapterNumber: 1, chapterName: 'Chapter 1' }),
    ...progress,
    scrollRatio,
    readAt: new Date().toISOString(),
  } as ReadingProgress;

  history[slug] = updatedProgress;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    window.dispatchEvent(new CustomEvent('daily_h_history_updated', { detail: history }));
  } catch {}

  // Debounce đẩy lên Supabase để tránh gửi liên tục khi cuộn màn hình
  if (supabase) {
    const prevTimer = progressSyncTimers.get(slug);
    if (prevTimer) clearTimeout(prevTimer);

    const timer = setTimeout(() => {
      progressSyncTimers.delete(slug);
      void syncProgressToSupabase(slug, updatedProgress);
    }, 1000);

    progressSyncTimers.set(slug, timer);
  }
}

export async function syncHMangaProgressWithSupabase(): Promise<Record<string, ReadingProgress>> {
  const localHistory = getHMangaHistory();
  if (!supabase) return localHistory;

  try {
    const { data: rows, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('type', 'STORY')
      .eq('genre', 'H_PROGRESS')
      .is('deleted_at', null);

    if (error) {
      console.warn('Could not fetch H progress from Supabase', error);
      return localHistory;
    }

    let changed = false;

    if (rows && rows.length > 0) {
      for (const row of rows) {
        if (row.channel && row.description && row.description.startsWith('{')) {
          try {
            const cloudProg = JSON.parse(row.description) as ReadingProgress;
            const localProg = localHistory[row.channel];
            if (!localProg || (cloudProg.readAt && (!localProg.readAt || new Date(cloudProg.readAt).getTime() > new Date(localProg.readAt).getTime()))) {
              localHistory[row.channel] = cloudProg;
              changed = true;
            }
          } catch {}
        }
      }
    }

    if (changed) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory));
        window.dispatchEvent(new CustomEvent('daily_h_history_updated', { detail: localHistory }));
      } catch {}
    }

    // Tự động đẩy các tiến độ local chưa có trên Supabase lên Cloud
    const user = (await supabase.auth.getUser())?.data?.user;
    if (user) {
      const cloudSlugs = new Set((rows || []).map(r => r.channel).filter(Boolean));
      for (const slug of Object.keys(localHistory)) {
        if (!cloudSlugs.has(slug)) {
          void syncProgressToSupabase(slug, localHistory[slug]);
        }
      }
    }

    return localHistory;
  } catch (err) {
    console.warn('Could not sync H progress with Supabase', err);
    return localHistory;
  }
}
