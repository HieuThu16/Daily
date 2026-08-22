import { supabase } from '../../lib/supabase';

export interface HMangaScreenshot {
  id: string;
  mangaSlug: string;
  mangaTitle: string;
  chapterNumber: number;
  chapterName: string;
  pageIndex?: number;
  scrollRatio?: number;
  imageData: string; // Data URL or storage URL
  createdAt: string;
}

const STORAGE_KEY = 'daily_h_manga_screenshots';

export function getHMangaScreenshots(): HMangaScreenshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Failed to load H screenshots from localStorage', e);
    return [];
  }
}

export async function syncHMangaScreenshotsWithSupabase(): Promise<HMangaScreenshot[]> {
  const localList = getHMangaScreenshots();
  if (!supabase) return localList;

  try {
    const { data: rows, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('type', 'STORY')
      .eq('genre', 'H_SCREENSHOT')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch screenshots from Supabase', error);
      return localList;
    }

    const map = new Map<string, HMangaScreenshot>();
    for (const item of localList) {
      map.set(item.id, item);
    }

    if (rows && rows.length > 0) {
      for (const row of rows) {
        if (row.description && row.description.startsWith('{')) {
          try {
            const shotObj = JSON.parse(row.description) as HMangaScreenshot;
            if (shotObj?.id) {
              map.set(shotObj.id, shotObj);
            }
          } catch {}
        }
      }
    }

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, 100)));
    } catch {}

    // Tự động đẩy các ảnh chụp chỉ có ở local lên Supabase
    const user = (await supabase.auth.getUser())?.data?.user;
    if (user && localList.length > 0) {
      const cloudIds = new Set(
        (rows || [])
          .map((r) => {
            try {
              return JSON.parse(r.description || '{}').id;
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      );

      for (const shot of localList) {
        if (!cloudIds.has(shot.id)) {
          void supabase.from('media_items').insert({
            user_id: user.id,
            type: 'STORY',
            genre: 'H_SCREENSHOT',
            name: `${shot.mangaTitle} - ${shot.chapterName}`,
            channel: shot.mangaSlug,
            cover_url: shot.imageData.startsWith('http') ? shot.imageData : null,
            description: JSON.stringify(shot),
            is_public: false,
          });
        }
      }
    }

    return merged;
  } catch (err) {
    console.warn('Could not sync screenshots with Supabase', err);
    return localList;
  }
}

export async function saveHMangaScreenshot(
  screenshot: Omit<HMangaScreenshot, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<HMangaScreenshot> {
  const newShot: HMangaScreenshot = {
    ...screenshot,
    id: screenshot.id || `shot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: screenshot.createdAt || new Date().toISOString(),
  };

  const list = getHMangaScreenshots();
  const updated = [newShot, ...list.filter(s => s.id !== newShot.id)];

  // Giới hạn lưu tối đa 100 ảnh chụp gần nhất trong local
  const trimmed = updated.slice(0, 100);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('LocalStorage full, trimming screenshots further', e);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(0, 30)));
    } catch {}
  }

  // Đồng bộ lên Supabase media_items để lưu trữ vĩnh viễn trên cloud
  if (supabase) {
    void (async () => {
      try {
        const user = (await supabase.auth.getUser())?.data?.user;
        if (!user) return;

        await supabase.from('media_items').insert({
          user_id: user.id,
          type: 'STORY',
          genre: 'H_SCREENSHOT',
          name: `${newShot.mangaTitle} - ${newShot.chapterName}`,
          channel: newShot.mangaSlug,
          cover_url: newShot.imageData.startsWith('http') ? newShot.imageData : null,
          description: JSON.stringify(newShot),
          is_public: false,
        });
      } catch (err) {
        console.warn('Could not sync screenshot to Supabase', err);
      }
    })();
  }

  return newShot;
}

export async function deleteHMangaScreenshot(id: string): Promise<void> {
  const list = getHMangaScreenshots();
  const updated = list.filter(s => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  if (supabase) {
    void (async () => {
      try {
        const user = (await supabase.auth.getUser())?.data?.user;
        if (!user) return;
        // Xóa trên Supabase media_items
        await supabase
          .from('media_items')
          .delete()
          .eq('user_id', user.id)
          .eq('type', 'STORY')
          .eq('genre', 'H_SCREENSHOT')
          .ilike('description', `%"id":"${id}"%`);
      } catch (err) {
        console.warn('Could not delete screenshot from Supabase', err);
      }
    })();
  }
}
