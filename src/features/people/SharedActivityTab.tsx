import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Music, Play, Flame, RefreshCw, ExternalLink,
  Headphones, PlusCircle, Sparkles, Clock, Compass, Heart
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
  userName: 'Hiếu' | 'Kim Ý';
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
  audioUrl?: string | null;
  artist?: string | null;
  logDate: string;
  logTime?: string;
  updatedAt: string;
  rawMedia?: any;
}

// Mốc thời gian đặt lại Xem chung (chỉ lấy các hoạt động ghi nhận mới bắt đầu từ bây giờ)
const RESET_CUTOFF_MS = new Date('2026-08-23T22:30:00+07:00').getTime();

interface Props {
  partnerPerson?: Person;
}

export function SharedActivityTab({ partnerPerson }: Props) {
  const navigate = useNavigate();
  const audioContext = useOptionalAudioPlayer();
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(() => localDate());
  const [activePartnerFilter, setActivePartnerFilter] = useState<'ALL' | 'HIEU' | 'KIM_Y'>('ALL');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'BOOK' | 'MANGA' | 'MUSIC'>('ALL');
  const [activities, setActivities] = useState<SharedActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  const isHieu = useCallback((s?: string | null) => {
    const str = (s || '').toLowerCase();
    return str.includes('hieu') || str.includes('truongnguyenminhhieu');
  }, []);

  const isKimY = useCallback((s?: string | null) => {
    const str = (s || '').toLowerCase();
    return str.includes('kimy') || str.includes('nguyenkimy') || str.includes('ý');
  }, []);

  // Lấy thông tin user hiện tại
  useEffect(() => {
    if (supabase?.auth) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setCurrentUserId(data.user.id);
          if (data.user.email) setCurrentUserEmail(data.user.email.toLowerCase());
        }
      }).catch(() => null);
    }
  }, []);

  // Tải dữ liệu hoạt động
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const itemsMap = new Map<string, SharedActivityItem>();

      // 1. Tải dữ liệu từ Supabase
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
            .or('status.eq.COMPLETED,status.eq.IN_PROGRESS')
            .order('updated_at', { ascending: false })
            .limit(150),
          supabase
            .from('book_documents')
            .select('id, media_item_id, percent, last_chapter_idx, page_count, est_pages, last_char_offset, total_chars, updated_at'),
          supabase
            .from('manga_reading_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(150),
          supabase
            .from('manga_interactions')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(100),
          supabase
            .from('profiles')
            .select('id, email, name')
        ]);

        const profileMap = new Map<string, string>();
        if (profileRows) {
          for (const p of profileRows as any[]) {
            if (p.id) {
              const name = isKimY(p.email || p.name) ? 'Kim Ý' : 'Hiếu';
              profileMap.set(p.id, name);
            }
          }
        }

        const resolveUserName = (userId?: string | null, channelOrDesc?: string | null, artistOrAuthor?: string | null): 'Hiếu' | 'Kim Ý' => {
          if (channelOrDesc && isKimY(channelOrDesc)) return 'Kim Ý';
          if (channelOrDesc && isHieu(channelOrDesc)) return 'Hiếu';
          if (userId && profileMap.has(userId)) return profileMap.get(userId) as any;
          if (userId && isKimY(userId)) return 'Kim Ý';
          if (userId && isHieu(userId)) return 'Hiếu';
          if (artistOrAuthor && isKimY(artistOrAuthor)) return 'Kim Ý';
          if (artistOrAuthor && isHieu(artistOrAuthor)) return 'Hiếu';
          if (currentUserId && userId === currentUserId) {
            return isKimY(currentUserEmail) ? 'Kim Ý' : 'Hiếu';
          }
          if (currentUserId && userId && userId !== currentUserId) {
            return isKimY(currentUserEmail) ? 'Hiếu' : 'Kim Ý';
          }
          return isKimY(currentUserEmail) ? 'Kim Ý' : 'Hiếu';
        };

        const bookDocMap = new Map<string, any>();
        if (bookDocs) {
          for (const d of bookDocs) {
            if (d.media_item_id) bookDocMap.set(d.media_item_id, d);
          }
        }

        // Tải ảnh bìa manga
        const mangaCoverMap = new Map<string, { cover?: string; title?: string }>();
        try {
          const [hList, customList] = await Promise.all([fetchHMangaList(), getCustomHMangaList()]);
          for (const m of [...hList, ...customList]) {
            if (m.slug) mangaCoverMap.set(m.slug, { cover: m.cover ?? undefined, title: m.title ?? undefined });
          }
        } catch {}

        // A. Xử lý media_items (Sách, Truyện, Nhạc)
        if (mediaRows) {
          for (const m of mediaRows) {
            const rowDate = m.log_date || (m.updated_at ? m.updated_at.split('T')[0] : localDate());
            const logTime = m.log_time || (m.updated_at ? m.updated_at.split('T')[1]?.slice(0, 5) : '');
            const userName = resolveUserName(m.user_id, m.channel || m.description, m.artist || m.author);
            const updatedAtIso = m.updated_at || m.created_at || `${rowDate}T${logTime || '00:00'}:00`;

            // 1. SÁCH (BOOK)
            if (m.type === 'BOOK') {
              const doc = bookDocMap.get(m.id);
              let current = m.current_page || m.current_chapter || 0;
              let total = m.total_pages || m.total_chapters || (doc?.page_count || doc?.est_pages || 0);
              let pct = doc?.percent !== undefined && doc?.percent !== null ? Math.round(doc.percent) : undefined;

              if (doc) {
                if (doc.last_char_offset && doc.total_chars > 0) {
                  current = estimatePage(doc.last_char_offset, doc.total_chars, doc.page_count);
                } else if (doc.last_chapter_idx !== undefined && doc.last_chapter_idx !== null) {
                  current = doc.last_chapter_idx + 1;
                }
                if (doc.percent) pct = Math.round(doc.percent);
              }

              const key = `${userName}::BOOK::${m.id || m.name}`;
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
                updatedAt: updatedAtIso,
                rawMedia: m
              });
            }

            // 2. TRUYỆN H / BL / NGÔN TÌNH (STORY / MANGA)
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

              const key = `${userName}::${storyType}::${slug || m.name}`;
              itemsMap.set(key, {
                id: `manga-${m.id}`,
                user_id: m.user_id,
                userName,
                type: storyType,
                actionType: 'READING',
                title: m.name || m.title || (slug && mangaCoverMap.get(slug)?.title) || 'Truyện tranh',
                subtitle: `Chapter ${current}`,
                slug: slug,
                cover: coverUrl,
                progressText: `Chapter ${current}${logTime ? ` · ${logTime}` : ''}`,
                progressPercent: pct,
                currentChapterOrPage: current,
                totalChaptersOrPages: total || undefined,
                logDate: rowDate,
                logTime: logTime,
                updatedAt: updatedAtIso,
                rawMedia: m
              });
            }

            // 3. NHẠC MP3 (MUSIC)
            if (m.type === 'MUSIC') {
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
                updatedAt: updatedAtIso,
                rawMedia: m
              });
            }
          }
        }

        // B. Xử lý manga_reading_logs
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
      }

      // 2. Chuyển map thành danh sách và lọc theo mốc thời gian bắt đầu lưu mới (Hiếu & Ý)
      const list = Array.from(itemsMap.values()).filter((it) => {
        const isCouple = it.userName === 'Hiếu' || it.userName === 'Kim Ý';
        const itemTime = new Date(it.updatedAt).getTime();
        return isCouple && (isNaN(itemTime) || itemTime >= RESET_CUTOFF_MS);
      });

      // Sắp xếp theo thời gian mới nhất lên đầu
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setActivities(list);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu xem chung:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserEmail, currentUserId, isHieu, isKimY]);

  useEffect(() => {
    void fetchActivities();

    // Lắng nghe Realtime từ Supabase
    if (supabase) {
      const sb = supabase;
      const channel = sb
        .channel('shared-activity-realtime-channel-v2')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media_items' }, () => {
          void fetchActivities();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'book_documents' }, () => {
          void fetchActivities();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manga_reading_logs' }, () => {
          void fetchActivities();
        })
        .subscribe();

      const handleLocalEvent = () => void fetchActivities();
      window.addEventListener('daily_music_listening_updated', handleLocalEvent);
      window.addEventListener('daily_manga_reading_updated', handleLocalEvent);

      return () => {
        void sb.removeChannel(channel);
        window.removeEventListener('daily_music_listening_updated', handleLocalEvent);
        window.removeEventListener('daily_manga_reading_updated', handleLocalEvent);
      };
    }
  }, [fetchActivities]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActivities();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Lọc theo bộ lọc
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // 1. Lọc theo ngày (nếu hoạt động thuộc ngày được chọn)
      if (act.logDate && act.logDate !== selectedDate) return false;

      // 2. Lọc theo người
      if (activePartnerFilter === 'HIEU' && act.userName !== 'Hiếu') return false;
      if (activePartnerFilter === 'KIM_Y' && act.userName !== 'Kim Ý') return false;

      // 3. Lọc theo loại nội dung
      if (activeTypeFilter === 'BOOK' && act.type !== 'BOOK') return false;
      if (activeTypeFilter === 'MANGA' && act.type !== 'BL' && act.type !== 'H_MANGA') return false;
      if (activeTypeFilter === 'MUSIC' && act.type !== 'MUSIC') return false;

      return true;
    });
  }, [activities, selectedDate, activePartnerFilter, activeTypeFilter]);

  // Điều hướng khi bấm vào thẻ
  const handleItemClick = (act: SharedActivityItem) => {
    if (act.type === 'BOOK') {
      navigate('/books');
    } else if (act.type === 'BL') {
      navigate('/bl');
    } else if (act.type === 'H_MANGA') {
      navigate('/truyenh');
    } else if (act.type === 'MUSIC') {
      navigate('/music');
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

  return (
    <div className="shared-activity-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* THANH ĐIỀU HƯỚNG LỊCH */}
      <DatePager
        dateKey={selectedDate}
        week={[]}
        mode="day"
        onChange={setSelectedDate}
      />

      {/* THANH BỘ LỌC NGƯỜI & NÚT LÀM MỚI */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActivePartnerFilter('ALL')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'ALL' ? 'linear-gradient(135deg, #ec4899, #be123c)' : 'var(--card-bg)',
              color: activePartnerFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cả hai ({activities.length})
          </button>

          <button
            type="button"
            onClick={() => setActivePartnerFilter('HIEU')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'HIEU' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'var(--card-bg)',
              color: activePartnerFilter === 'HIEU' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} />
            Hiếu
          </button>

          <button
            type="button"
            onClick={() => setActivePartnerFilter('KIM_Y')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'KIM_Y' ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 'var(--card-bg)',
              color: activePartnerFilter === 'KIM_Y' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fda4af' }} />
            Kim Ý
          </button>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            fontSize: '0.76rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <RefreshCw size={13} className={isRefreshing || loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* BỘ LỌC THỂ LOẠI (TẤT CẢ / SÁCH / TRUYỆN / NHẠC) */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { key: 'ALL', label: 'Tất cả' },
          { key: 'BOOK', label: '📖 Sách' },
          { key: 'MANGA', label: '🔞 Truyện tranh' },
          { key: 'MUSIC', label: '🎵 Âm nhạc' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTypeFilter(tab.key as any)}
            style={{
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: activeTypeFilter === tab.key ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: activeTypeFilter === tab.key ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* DANH SÁCH HOẠT ĐỘNG */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#ec4899' }} />
          Đang cập nhật tiến độ xem chung…
        </div>
      ) : filteredActivities.length === 0 ? (
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px dashed var(--border)',
            borderRadius: '16px',
            padding: '36px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
            <Sparkles size={24} />
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Chưa có hoạt động mới nào
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
            Khi Hiếu hoặc Kim Ý đọc sách, đọc truyện tranh hay nghe nhạc từ thời điểm này, tiến độ và thời gian sẽ xuất hiện ngay tại đây!
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredActivities.map((act) => {
            const isMeHieu = act.userName === 'Hiếu';
            const userColor = isMeHieu ? '#0284c7' : '#f43f5e';
            const tagBadge = (() => {
              if (act.type === 'BOOK') return { label: 'SÁCH', bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' };
              if (act.type === 'H_MANGA') return { label: 'TRUYỆN H', bg: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' };
              if (act.type === 'BL') return { label: 'TRUYỆN BL', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' };
              return { label: 'NHẠC MP3', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
            })();

            return (
              <div
                key={act.id}
                onClick={() => handleItemClick(act)}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                {/* BÌA ẢNH */}
                <div
                  style={{
                    width: '56px',
                    height: '76px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'var(--bg-secondary, #334155)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {act.cover ? (
                    <img
                      src={act.cover}
                      alt={act.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : act.type === 'MUSIC' ? (
                    <Music size={26} color="#10b981" />
                  ) : (
                    <BookOpen size={26} color="#6366f1" />
                  )}

                  {/* NÚT PHÁT NHANH ĐỐI VỚI NHẠC */}
                  {act.type === 'MUSIC' && act.audioUrl && (
                    <button
                      type="button"
                      onClick={(e) => handlePlayMusic(e, act)}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                      title="Phát bài hát này"
                    >
                      <Play size={20} fill="#ffffff" />
                    </button>
                  )}
                </div>

                {/* NỘI DUNG CHI TIẾT */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  
                  {/* DÒNG HEADER: TAG THỂ LOẠI + AVATAR NGƯỜI ĐỌC */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: tagBadge.bg,
                          color: tagBadge.color,
                        }}
                      >
                        {tagBadge.label}
                      </span>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: userColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: userColor }} />
                        {act.userName}
                      </span>
                    </div>

                    {act.logTime && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} /> {act.logTime}
                      </span>
                    )}
                  </div>

                  {/* TIÊU ĐỀ TÁC PHẨM */}
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={act.title}
                  >
                    {act.title}
                  </div>

                  {/* TIẾN ĐỘ CHI TIẾT */}
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{act.progressText || act.subtitle || 'Đang cập nhật'}</span>
                  </div>

                  {/* THANH TIẾN ĐỘ (NẾU CÓ %) */}
                  {act.progressPercent !== undefined && act.progressPercent > 0 && (
                    <div
                      style={{
                        width: '100%',
                        height: '4px',
                        borderRadius: '2px',
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        marginTop: '2px',
                      }}
                    >
                      <div
                        style={{
                          width: `${act.progressPercent}%`,
                          height: '100%',
                          background: isMeHieu ? 'linear-gradient(90deg, #0284c7, #38bdf8)' : 'linear-gradient(90deg, #f43f5e, #fda4af)',
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
