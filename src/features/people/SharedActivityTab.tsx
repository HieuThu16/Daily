import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Music, Play, Flame, RefreshCw, ExternalLink,
  Headphones, PlusCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { localDate } from '../../lib/date';
import { useOptionalAudioPlayer } from '../library/AudioPlayerContext';
import { useToast } from '../ToastContext';
import { DatePager } from '../home/DatePager';
import { getMangaReadingLogs } from '../../lib/mangaReadingLog';
import { fetchHMangaList, getCustomHMangaList } from '../manga/hMangaService';
import type { Media, Person } from '../../types';
import { estimatePage } from '../../lib/book/repository';

export interface SharedActivityItem {
  id: string;
  user_id?: string;
  userName: 'Hiếu' | 'Kim Ý' | string;
  type: 'BOOK' | 'BL' | 'H_MANGA' | 'MUSIC';
  actionType: 'READING' | 'ADDED_MUSIC' | 'LISTENED_MUSIC' | 'ADDED_BOOK' | 'ADDED_MANGA';
  title: string;
  subtitle?: string;
  slug?: string;
  cover?: string;
  progressText?: string;
  progressPercent?: number;
  currentChapterOrPage?: number;
  totalChaptersOrPages?: number;
  durationMinutes?: number;
  audioUrl?: string;
  artist?: string;
  logDate: string;
  logTime?: string;
  updatedAt: string;
  rawMedia?: Media;
}

export function SharedActivityTab({ onTabChange, partnerPerson }: { onTabChange?: (tab: string) => void; partnerPerson?: Person }) {
  const navigate = useNavigate();
  const audioContext = useOptionalAudioPlayer();
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(localDate());
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activities, setActivities] = useState<SharedActivityItem[]>([]);
  const [activePartnerFilter, setActivePartnerFilter] = useState<'ALL' | 'HIEU' | 'KIM_Y'>('ALL');

  // Lấy user auth hiện tại
  useEffect(() => {
    if (supabase?.auth) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) setCurrentUserEmail(data.user.email.toLowerCase());
        if (data?.user?.id) setCurrentUserId(data.user.id);
      }).catch(() => null);
    }
  }, []);

  const isHieu = useCallback((emailOrName?: string) => {
    const s = (emailOrName || '').toLowerCase();
    return s.includes('hieu') || s.includes('truongnguyenminhhieu');
  }, []);

  const isKimY = useCallback((emailOrName?: string) => {
    const s = (emailOrName || '').toLowerCase();
    return s.includes('kimy') || s.includes('nguyenkimy') || s.includes('ý');
  }, []);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      // 0. Tạo từ điển bìa truyện H & Manga từ danh sách truyện sẵn có
      const mangaCoverMap = new Map<string, { cover: string; title: string }>();
      try {
        const customManga = getCustomHMangaList();
        for (const m of customManga) {
          if (m.slug) mangaCoverMap.set(m.slug, { cover: m.cover || '', title: m.title || m.slug });
        }
        const hList = await fetchHMangaList();
        for (const m of hList) {
          if (m.slug && !mangaCoverMap.has(m.slug)) {
            mangaCoverMap.set(m.slug, { cover: m.cover || '', title: m.title || m.slug });
          }
        }
      } catch {}

      const itemsMap = new Map<string, SharedActivityItem>();

      // 1. Fetch đồng thời từ Supabase: media_items, book_documents, manga_reading_logs, manga_interactions, profiles
      if (supabase) {
        const [
          { data: mediaRows },
          { data: bookDocs },
          { data: mangaLogs },
          { data: mangaInteractions },
          { data: profileRows }
        ] = await Promise.all([
          supabase
            .from('media_items')
            .select('*')
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })
            .limit(200),
          supabase
            .from('book_documents')
            .select('media_item_id, percent, page_count, est_pages, last_char_offset, total_chars, last_chapter_idx'),
          Promise.resolve(
            supabase
              .from('manga_reading_logs')
              .select('*')
              .order('readAt', { ascending: false })
              .limit(200),
          ).catch(() => ({ data: null })),
          Promise.resolve(
            supabase
              .from('manga_interactions')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(200),
          ).catch(() => ({ data: null })),
          Promise.resolve(
            supabase
              .from('profiles')
              .select('id, name, email'),
          ).catch(() => ({ data: null }))
        ]);

        const profileMap = new Map<string, string>();
        if (profileRows) {
          for (const p of profileRows as any[]) {
            if (p.id) {
              const name = isKimY(p.email || p.name) ? 'Kim Ý' : (isHieu(p.email || p.name) ? 'Hiếu' : p.name || 'Hiếu');
              profileMap.set(p.id, name);
            }
          }
        }

        const resolveUserName = (userId?: string | null, fallbackArtistOrAuthor?: string | null) => {
          if (userId && profileMap.has(userId)) return profileMap.get(userId)!;
          if (userId && isKimY(userId)) return 'Kim Ý';
          if (userId && isHieu(userId)) return 'Hiếu';
          if (fallbackArtistOrAuthor && isKimY(fallbackArtistOrAuthor)) return 'Kim Ý';
          if (fallbackArtistOrAuthor && isHieu(fallbackArtistOrAuthor)) return 'Hiếu';
          if (currentUserId && userId === currentUserId) {
            return isKimY(currentUserEmail) ? 'Kim Ý' : 'Hiếu';
          }
          if (partnerPerson?.name && isKimY(partnerPerson.name)) {
            if (userId && userId === partnerPerson.id) return 'Kim Ý';
          }
          return 'Hiếu';
        };

        const bookDocMap = new Map<string, any>();
        if (bookDocs) {
          for (const d of bookDocs) {
            if (d.media_item_id) bookDocMap.set(d.media_item_id, d);
          }
        }

        // Xử lý media_items
        if (mediaRows) {
          for (const m of mediaRows) {
            const rowDate = m.log_date || (m.updated_at ? m.updated_at.split('T')[0] : '');
            const logTime = m.log_time || (m.updated_at ? m.updated_at.split('T')[1]?.slice(0, 5) : '');
            const userName = resolveUserName(m.user_id, m.artist || m.author);

            // A. Sách (BOOK)
            if (m.type === 'BOOK') {
              const doc = bookDocMap.get(m.id);
              let current = m.current_page || m.current_chapter || 0;
              let total = m.total_pages || m.total_chapters || (doc?.page_count || doc?.est_pages || 0);
              let pct = doc?.percent !== undefined && doc?.percent !== null ? Math.round(doc.percent) : undefined;

              if (doc) {
                if (doc.last_char_offset && doc.total_chars > 0) {
                  current = estimatePage(doc.last_char_offset, doc.total_chars, doc.page_count);
                }
                if (!total) {
                  total = doc.page_count || doc.est_pages || 0;
                }
                if (pct === undefined && total > 0 && current > 0) {
                  pct = Math.min(100, Math.round((current / total) * 100));
                }
              } else if (pct === undefined && total > 0 && current > 0) {
                pct = Math.min(100, Math.round((current / total) * 100));
              }

              // Bất kỳ tiến độ nào của sách (dù chương 1 hay trang 1 hay %) đều hiển thị ngay
              const isReadingBook = current > 0 || (pct !== undefined && pct > 0) || m.status === 'IN_PROGRESS' || m.status === 'COMPLETED' || Boolean(m.log_date);
              if (isReadingBook) {
                const key = `${userName}::BOOK::${m.name || m.id}`;
                itemsMap.set(key, {
                  id: `book-${m.id}`,
                  user_id: m.user_id,
                  userName,
                  type: 'BOOK',
                  actionType: 'READING',
                  title: m.name || 'Sách',
                  subtitle: m.author || m.description || '',
                  cover: m.cover_url || m.cover || '',
                  progressText: current > 0 
                    ? `Trang ${current}${total ? ` / ${total}` : ''}${pct !== undefined ? ` (${pct}%)` : ''}${logTime ? ` · ${logTime}` : ''}`
                    : (pct !== undefined ? `${pct}%${logTime ? ` · ${logTime}` : ''}` : (logTime ? `Đang đọc lúc ${logTime}` : 'Đang đọc')),
                  progressPercent: pct,
                  currentChapterOrPage: current,
                  totalChaptersOrPages: total || undefined,
                  logDate: rowDate,
                  logTime: logTime,
                  updatedAt: m.updated_at || m.created_at || '',
                  rawMedia: m
                });
              }
            }

            // B. Truyện H / BL / Ngôn tình (STORY / MANGA)
            if (m.type === 'STORY' || m.type === 'MANGA') {
              const isBL = m.genre === 'BL' || m.source === 'bl';
              const storyType: 'H_MANGA' | 'BL' = isBL ? 'BL' : 'H_MANGA';
              const current = m.current_chapter || 1;
              const total = m.total_chapters;
              const pct = total ? Math.min(100, Math.round((current / total) * 100)) : undefined;
              const slug = m.channel || m.slug || m.name || '';

              let coverUrl = m.cover_url || m.cover || '';
              if (!coverUrl && slug && mangaCoverMap.has(slug)) {
                coverUrl = mangaCoverMap.get(slug)?.cover || '';
              }

              // Chỉ cần đọc (dù chapter 1 hay chapter bất kỳ) là hiển thị ngay bên Xem chung
              const key = `${userName}::${storyType}::${slug || m.name}`;
              itemsMap.set(key, {
                id: `manga-${m.id}`,
                user_id: m.user_id,
                userName,
                type: storyType,
                actionType: 'READING',
                title: m.name || m.title || (slug && mangaCoverMap.get(slug)?.title) || 'Truyện tranh',
                subtitle: m.channel ? `Bộ: ${m.channel}` : m.author || '',
                slug: slug,
                cover: coverUrl,
                progressText: `Chapter ${current}${total ? ` / ${total}` : ''}${pct ? ` (${pct}%)` : ''}${logTime ? ` · ${logTime}` : ''}`,
                progressPercent: pct,
                currentChapterOrPage: current,
                totalChaptersOrPages: total,
                logDate: rowDate,
                logTime: logTime,
                updatedAt: m.updated_at || m.created_at || '',
                rawMedia: m
              });
            }

            // C. Nhạc MP3: Phân biệt rõ "Mới thêm nhạc" vs "Vừa nghe nhạc trên web"
            if (m.type === 'MUSIC') {
              // Nếu có log_time -> Vừa nghe nhạc trên web
              // Nếu không có log_time -> Mới thêm nhạc vào kho
              const actionType: 'ADDED_MUSIC' | 'LISTENED_MUSIC' = m.log_time ? 'LISTENED_MUSIC' : 'ADDED_MUSIC';
              const key = `${userName}::MUSIC::${m.name || m.id}`;
              itemsMap.set(key, {
                id: `music-${m.id}`,
                user_id: m.user_id,
                userName,
                type: 'MUSIC',
                actionType: actionType,
                title: m.name || 'Bài hát',
                subtitle: m.artist || 'Nghệ sĩ',
                cover: m.cover_url || m.cover || '',
                progressText: actionType === 'ADDED_MUSIC' 
                  ? 'Vừa thêm vào kho nhạc' 
                  : (m.log_time ? `Nghe lúc ${m.log_time}` : 'Vừa nghe trên web'),
                audioUrl: m.audio_url || m.url,
                artist: m.artist,
                logDate: rowDate,
                logTime: logTime,
                updatedAt: m.updated_at || m.created_at || '',
                rawMedia: m
              });
            }
          }
        }

        // Xử lý manga_reading_logs từ Supabase
        if (mangaLogs && Array.isArray(mangaLogs)) {
          for (const log of mangaLogs as any[]) {
            const isH = log.manga_type === 'H_MANGA';
            const storyType: 'H_MANGA' | 'BL' = isH ? 'H_MANGA' : 'BL';
            const userName = resolveUserName(log.user_id);
            const key = `${userName}::${storyType}::${log.manga_slug}`;
            const coverUrl = mangaCoverMap.get(log.manga_slug)?.cover || '';
            const logIso = log.readAt || log.created_at || `${log.log_date}T${log.log_time || '00:00'}:00`;
            const existing = itemsMap.get(key);

            if (!existing || new Date(logIso).getTime() > new Date(existing.updatedAt).getTime()) {
              itemsMap.set(key, {
                id: `manga-log-remote-${log.id}`,
                user_id: log.user_id,
                userName,
                type: storyType,
                actionType: 'READING',
                title: log.manga_title || (mangaCoverMap.get(log.manga_slug)?.title) || log.manga_slug,
                subtitle: log.chapter_name || `Chapter ${log.chapter_number}`,
                slug: log.manga_slug,
                cover: coverUrl || existing?.cover || '',
                progressText: `Chapter ${log.chapter_number}${log.log_time ? ` · ${log.log_time}` : ''}`,
                currentChapterOrPage: log.chapter_number,
                durationMinutes: log.duration_minutes,
                logDate: log.log_date,
                logTime: log.log_time,
                updatedAt: logIso,
              });
            }
          }
        }

        // Xử lý manga_interactions từ Supabase
        if (mangaInteractions && Array.isArray(mangaInteractions)) {
          for (const inter of mangaInteractions as any[]) {
            if (!inter.last_chapter) continue;
            const isH = inter.manga_type === 'H_MANGA';
            const storyType: 'H_MANGA' | 'BL' = isH ? 'H_MANGA' : 'BL';
            const userName = resolveUserName(inter.user_id);
            const key = `${userName}::${storyType}::${inter.slug}`;
            const coverUrl = inter.cover_url || mangaCoverMap.get(inter.slug)?.cover || '';
            const interIso = inter.last_read_at || inter.updated_at || '';
            const interDate = interIso.split('T')[0] || localDate();
            const interTime = interIso.split('T')[1]?.slice(0, 5) || '';
            const existing = itemsMap.get(key);

            if (!existing || (interIso && new Date(interIso).getTime() > new Date(existing.updatedAt).getTime())) {
              itemsMap.set(key, {
                id: `manga-inter-${inter.id || inter.slug}`,
                user_id: inter.user_id,
                userName,
                type: storyType,
                actionType: 'READING',
                title: inter.title || (mangaCoverMap.get(inter.slug)?.title) || inter.slug,
                subtitle: inter.last_chapter_name || `Chapter ${inter.last_chapter}`,
                slug: inter.slug,
                cover: coverUrl || existing?.cover || '',
                progressText: `Chapter ${inter.last_chapter}${interTime ? ` · ${interTime}` : ''}`,
                currentChapterOrPage: inter.last_chapter,
                logDate: interDate,
                logTime: interTime,
                updatedAt: interIso,
              });
            }
          }
        }
      }

      // 2. Bổ sung từ Manga Reading Logs nội bộ (LocalStorage)
      try {
        const localMangaLogs = getMangaReadingLogs();
        for (const log of localMangaLogs) {
          const isH = log.mangaType === 'H_MANGA';
          const storyType: 'H_MANGA' | 'BL' = isH ? 'H_MANGA' : 'BL';
          const isMeHieu = isHieu(currentUserEmail);
          const userName = isMeHieu ? 'Hiếu' : 'Kim Ý';
          const key = `${userName}::${storyType}::${log.mangaSlug}`;
          const coverUrl = mangaCoverMap.get(log.mangaSlug)?.cover || '';
          const existing = itemsMap.get(key);

          // Không cần điều kiện > 5 phút: Bất cứ chapter nào đọc đều ghi nhận ngay
          if (!existing || new Date(log.readAt).getTime() > new Date(existing.updatedAt).getTime()) {
            itemsMap.set(key, {
              id: `manga-log-local-${log.id}`,
              userName,
              type: storyType,
              actionType: 'READING',
              title: log.mangaTitle || (mangaCoverMap.get(log.mangaSlug)?.title) || log.mangaSlug,
              subtitle: log.chapterName || `Chapter ${log.chapterNumber}`,
              slug: log.mangaSlug,
              cover: coverUrl || existing?.cover || '',
              progressText: `Chapter ${log.chapterNumber}${log.log_time ? ` · ${log.log_time}` : ''}`,
              currentChapterOrPage: log.chapterNumber,
              durationMinutes: log.durationMinutes,
              logDate: log.log_date,
              logTime: log.log_time,
              updatedAt: log.readAt,
            });
          }
        }
      } catch {}

      // 3. Sắp xếp toàn bộ hoạt động theo thời gian mới nhất lên đầu, chỉ lấy từ 15h hôm nay trở đi
      const CUTOFF_TIME_MS = new Date('2026-08-23T15:00:00+07:00').getTime();
      const list = Array.from(itemsMap.values()).filter((it) => {
        const itemTime = new Date(it.updatedAt || it.logDate).getTime();
        return isNaN(itemTime) || itemTime >= CUTOFF_TIME_MS;
      });
      list.sort((a, b) => new Date(b.updatedAt || b.logDate).getTime() - new Date(a.updatedAt || a.logDate).getTime());
      setActivities(list);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu xem chung:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserEmail, currentUserId, isHieu, isKimY, partnerPerson]);

  useEffect(() => {
    void fetchActivities();

    // Lắng nghe Realtime từ Supabase trên tất cả bảng liên quan
    if (supabase) {
      const sb = supabase;
      const channel = sb
        .channel('shared-activity-realtime-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media_items' }, () => {
          void fetchActivities();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'book_documents' }, () => {
          void fetchActivities();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manga_reading_logs' }, () => {
          void fetchActivities();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manga_interactions' }, () => {
          void fetchActivities();
        })
        .subscribe();

      // Lắng nghe các sự kiện client nội bộ để cập nhật tức thì
      const handleLocalEvent = () => void fetchActivities();
      window.addEventListener('daily_music_listening_updated', handleLocalEvent);
      window.addEventListener('daily_manga_reading_updated', handleLocalEvent);
      window.addEventListener('daily_h_history_updated', handleLocalEvent);
      window.addEventListener('daily_book_progress_updated', handleLocalEvent);
      window.addEventListener('storage', handleLocalEvent);

      return () => {
        void sb.removeChannel(channel);
        window.removeEventListener('daily_music_listening_updated', handleLocalEvent);
        window.removeEventListener('daily_manga_reading_updated', handleLocalEvent);
        window.removeEventListener('daily_h_history_updated', handleLocalEvent);
        window.removeEventListener('daily_book_progress_updated', handleLocalEvent);
        window.removeEventListener('storage', handleLocalEvent);
      };
    }
  }, [fetchActivities]);

  // Lọc hoạt động theo ngày được chọn
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // 1. Khớp ngày đang chọn
      const matchesDate = act.logDate === selectedDate || act.updatedAt?.startsWith(selectedDate);
      if (!matchesDate) return false;

      // 2. Lọc theo người
      if (activePartnerFilter === 'HIEU' && act.userName !== 'Hiếu') return false;
      if (activePartnerFilter === 'KIM_Y' && act.userName !== 'Kim Ý') return false;

      return true;
    });
  }, [activities, activePartnerFilter, selectedDate]);

  // Mở truyện hoặc sách
  const handleItemClick = (act: SharedActivityItem) => {
    if (act.type === 'H_MANGA') {
      const slug = act.slug || act.title;
      if (act.currentChapterOrPage) {
        navigate(`/truyenh/${slug}/read/${act.currentChapterOrPage}`);
      } else {
        navigate(`/truyenh/${slug}`);
      }
    } else if (act.type === 'BL') {
      const slug = act.slug || act.title;
      navigate(`/bl/${slug}`);
    } else if (act.type === 'BOOK') {
      navigate('/books');
    }
  };

  // Phát nhạc MP3
  const handlePlayMusic = (e: React.MouseEvent, act: SharedActivityItem) => {
    e.stopPropagation();
    if (!act.audioUrl) {
      showToast('⚠️ Không tìm thấy file âm thanh để phát.', 'delete');
      return;
    }
    const track: Media = {
      id: act.id,
      name: act.title,
      description: null,
      artist: act.artist || 'Nghệ sĩ',
      audio_url: act.audioUrl,
      type: 'MUSIC',
      cover_url: act.cover ?? null,
      status: 'COMPLETED',
      is_favorite: false,
    };
    if (audioContext) {
      audioContext.playTrack(track);
      showToast(`▶️ Đang phát: ${act.title}`);
    }
  };

  const formatTimeAgo = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  };

  return (
    <div className="shared-activity-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* THANH ĐIỀU HƯỚNG LỊCH */}
      <DatePager
        dateKey={selectedDate}
        week={[]}
        mode="day"
        onChange={setSelectedDate}
      />

      {/* Lọc theo người (Hiếu / Kim Ý / Cả hai) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActivePartnerFilter('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'ALL' ? 'var(--primary)' : 'var(--card-bg)',
              color: activePartnerFilter === 'ALL' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activePartnerFilter === 'ALL' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
            }}
          >
            Tất cả ({filteredActivities.length})
          </button>
          <button
            type="button"
            onClick={() => setActivePartnerFilter('HIEU')}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'HIEU' ? '#0284c7' : 'var(--card-bg)',
              color: activePartnerFilter === 'HIEU' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Hiếu
          </button>
          <button
            type="button"
            onClick={() => setActivePartnerFilter('KIM_Y')}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'KIM_Y' ? '#f43f5e' : 'var(--card-bg)',
              color: activePartnerFilter === 'KIM_Y' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Kim Ý
          </button>
        </div>

        <button
          type="button"
          onClick={() => void fetchActivities()}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            fontWeight: 700
          }}
          title="Làm mới"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* DANH SÁCH TIẾN ĐỘ ĐỌC / NGHE TRONG NGÀY */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <p>Đang tải tiến độ xem chung…</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px dashed var(--border)',
            borderRadius: '16px',
            padding: '36px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}
        >
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📖</span>
          <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>
            Không có hoạt động nào trong ngày này
          </strong>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>
            Tiến độ đọc truyện, đọc sách hoặc nghe nhạc sẽ cập nhật tự động tại đây.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredActivities.map((act) => {
            const isStory = act.type === 'H_MANGA' || act.type === 'BL';
            const isH = act.type === 'H_MANGA';
            const timeFormatted = act.logTime || formatTimeAgo(act.updatedAt);

            return (
              <div
                key={act.id}
                onClick={() => handleItemClick(act)}
                style={{
                  background: 'var(--card-bg)',
                  border: isH ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  gap: '12px',
                  cursor: isStory || act.type === 'BOOK' ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
                className="shared-activity-card"
              >
                {/* Ảnh bìa: Nhỏ gọn (60x80px) */}
                <div
                  style={{
                    width: '60px',
                    height: '80px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                  }}
                >
                  {act.cover ? (
                    <img
                      src={act.cover}
                      alt={act.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {act.type === 'BOOK' && <BookOpen size={24} color="#8b5cf6" />}
                      {act.type === 'MUSIC' && <Music size={24} color="#10b981" />}
                      {isStory && <Flame size={24} color="#f43f5e" />}
                    </div>
                  )}
                </div>

                {/* Nội dung thông tin */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Hàng badge hành động */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {/* Badge Người */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: act.userName === 'Hiếu' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: act.userName === 'Hiếu' ? '#0284c7' : '#f43f5e'
                        }}
                      >
                        {act.userName}
                      </span>

                      {/* Phân biệt rõ: MỚI THÊM NHẠC vs VỪA NGHE NHẠC TRÊN WEB */}
                      {act.type === 'MUSIC' && act.actionType === 'ADDED_MUSIC' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <PlusCircle size={10} /> Mới thêm nhạc
                        </span>
                      )}

                      {act.type === 'MUSIC' && act.actionType === 'LISTENED_MUSIC' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Headphones size={10} /> Mới nghe trên web
                        </span>
                      )}

                      {/* Đang đọc truyện H */}
                      {isH && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #e11d48, #be123c)',
                            color: '#ffffff'
                          }}
                        >
                          🔞 Truyện H
                        </span>
                      )}

                      {/* Đang đọc BL */}
                      {act.type === 'BL' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'rgba(236, 72, 153, 0.15)',
                            color: '#ec4899'
                          }}
                        >
                          🌸 Truyện BL
                        </span>
                      )}

                      {/* Đang đọc Sách */}
                      {act.type === 'BOOK' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#8b5cf6'
                          }}
                        >
                          📚 Đang đọc Sách
                        </span>
                      )}

                      {/* Thời gian thực hiện */}
                      {timeFormatted && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {timeFormatted}
                        </span>
                      )}
                    </div>

                    {/* Tiêu đề tác phẩm */}
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={act.title}
                    >
                      {act.title}
                    </div>

                    {/* Phụ đề */}
                    {act.subtitle && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '1px'
                        }}
                      >
                        {act.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Tiến độ hoặc Nút nghe nhạc */}
                  <div style={{ marginTop: '5px' }}>
                    {act.type === 'MUSIC' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '0.74rem', color: act.actionType === 'ADDED_MUSIC' ? '#0284c7' : '#10b981', fontWeight: 700 }}>
                          {act.actionType === 'ADDED_MUSIC' 
                            ? `${act.userName} vừa thêm vào kho` 
                            : `${act.userName} vừa nghe trên web${act.logTime ? ` (${act.logTime})` : ''}`}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handlePlayMusic(e, act)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <Play size={11} fill="#ffffff" /> Nghe bài này
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '2px' }}>
                          <span style={{ color: isH ? '#f43f5e' : 'var(--primary)', fontWeight: 700 }}>
                            {act.progressText}
                          </span>
                          {isStory && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              Nhấn để đọc <ExternalLink size={9} />
                            </span>
                          )}
                        </div>

                        {act.progressPercent !== undefined && (
                          <div style={{ width: '100%', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${act.progressPercent}%`,
                                height: '100%',
                                background: isH ? 'linear-gradient(90deg, #f43f5e, #be123c)' : 'var(--primary)',
                                borderRadius: '2px'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
