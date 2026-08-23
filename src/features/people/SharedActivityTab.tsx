import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Music, Play, Heart, Sparkles, Clock, 
  Calendar, ChevronLeft, ChevronRight, RefreshCw, Flame,
  BookMarked, Volume2, ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { localDate } from '../../lib/date';
import { useOptionalAudioPlayer } from '../library/AudioPlayerContext';
import { useToast } from '../ToastContext';
import type { Media, Person } from '../../types';

export interface SharedActivityItem {
  id: string;
  user_id?: string;
  userName: 'Hiếu' | 'Kim Ý' | string;
  type: 'BOOK' | 'BL' | 'H_MANGA' | 'MUSIC';
  title: string;
  subtitle?: string;
  slug?: string;
  cover?: string;
  progressText: string;
  progressPercent?: number;
  currentChapterOrPage?: number;
  totalChaptersOrPages?: number;
  audioUrl?: string;
  artist?: string;
  logDate: string;
  updatedAt: string;
  rawMedia?: any;
}

interface SharedActivityTabProps {
  partnerPerson?: Person;
}

export function SharedActivityTab({ partnerPerson }: SharedActivityTabProps) {
  const navigate = useNavigate();
  const player = useOptionalAudioPlayer();
  const { showToast } = useToast();

  const todayStr = localDate();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [timeFilter, setTimeFilter] = useState<'TODAY' | '1_HOUR' | 'ALL'>('TODAY');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activities, setActivities] = useState<SharedActivityItem[]>([]);
  const [activePartnerFilter, setActivePartnerFilter] = useState<'ALL' | 'HIEU' | 'KIM_Y'>('ALL');

  // Lấy email user hiện tại
  useEffect(() => {
    if (supabase?.auth) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) setCurrentUserEmail(data.user.email.toLowerCase());
      }).catch(() => null);
    }
  }, []);

  const isHieu = (emailOrName?: string) => {
    const s = (emailOrName || '').toLowerCase();
    return s.includes('hieu') || s.includes('truongnguyenminhhieu');
  };

  const isKimY = (emailOrName?: string) => {
    const s = (emailOrName || '').toLowerCase();
    return s.includes('kimy') || s.includes('nguyenkimy') || s.includes('ý');
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const items: SharedActivityItem[] = [];

      // 1. Fetch Media Items (Sách, Truyện H, BL, Nhạc MP3)
      if (supabase) {
        const { data: mediaRows } = await supabase
          .from('media_items')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(150);

        if (mediaRows) {
          for (const m of mediaRows) {
            const rowDate = m.log_date || (m.updated_at ? m.updated_at.split('T')[0] : '');
            
            // Xác định tên người đọc/nghe
            let userName = 'Hiếu';
            if (m.user_id && isKimY(m.user_id)) {
              userName = 'Kim Ý';
            } else if (m.artist && isKimY(m.artist)) {
              userName = 'Kim Ý';
            }

            // A. Sách
            if (m.type === 'BOOK') {
              const current = m.current_page || m.current_chapter || 1;
              const total = m.total_pages || m.total_chapters || 100;
              const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : undefined;
              items.push({
                id: `book-${m.id}`,
                user_id: m.user_id,
                userName,
                type: 'BOOK',
                title: m.name || 'Sách',
                subtitle: m.author || m.description || '',
                cover: m.cover_url || m.cover || '',
                progressText: `Trang ${current}${total ? ` / ${total}` : ''} (${pct || 0}%)`,
                progressPercent: pct,
                currentChapterOrPage: current,
                totalChaptersOrPages: total,
                logDate: rowDate,
                updatedAt: m.updated_at || m.created_at || '',
                rawMedia: m
              });
            }

            // B. Truyện H (Tuyệt đối là Truyện H, không để Ngôn tình) / Truyện BL
            if (m.type === 'STORY' || m.type === 'MANGA') {
              const isBL = m.genre === 'BL' || m.source === 'bl';
              const storyType: 'H_MANGA' | 'BL' = isBL ? 'BL' : 'H_MANGA';

              const current = m.current_chapter || 1;
              const total = m.total_chapters;
              const pct = total ? Math.min(100, Math.round((current / total) * 100)) : undefined;
              const slug = m.channel || m.slug || '';

              items.push({
                id: `manga-${m.id}`,
                user_id: m.user_id,
                userName,
                type: storyType,
                title: m.name || m.title || 'Truyện tranh',
                subtitle: m.channel ? `Bộ: ${m.channel}` : m.author || '',
                slug: slug,
                cover: m.cover_url || m.cover || '',
                progressText: `Chapter ${current}${total ? ` / ${total}` : ''}${pct ? ` (${pct}%)` : ''}`,
                progressPercent: pct,
                currentChapterOrPage: current,
                totalChaptersOrPages: total,
                logDate: rowDate,
                updatedAt: m.updated_at || m.created_at || '',
                rawMedia: m
              });
            }

            // C. Nhạc MP3 (Chỉ lấy bài có link MP3/audio để nghe được)
            if (m.type === 'MUSIC' && (m.url?.endsWith('.mp3') || m.url?.includes('audio') || m.url?.includes('supabase') || m.url?.includes('mp3') || m.audio_url || m.status === 'COMPLETED')) {
              items.push({
                id: `music-${m.id}`,
                user_id: m.user_id,
                userName,
                type: 'MUSIC',
                title: m.name || 'Bài hát',
                subtitle: m.artist || 'Nghệ sĩ',
                cover: m.cover_url || m.cover || '',
                progressText: m.log_time ? `Đã nghe lúc ${m.log_time}` : 'Vừa nghe gần đây',
                audioUrl: m.audio_url || m.url,
                artist: m.artist,
                logDate: rowDate,
                updatedAt: m.updated_at || m.created_at || '',
                rawMedia: m
              });
            }
          }
        }
      }

      // 2. Bổ sung dữ liệu lịch sử đọc Truyện H cục bộ nếu có
      try {
        const hHistory = JSON.parse(localStorage.getItem('daily_hmanga_history_v1') || '{}');
        for (const slug of Object.keys(hHistory)) {
          const prog = hHistory[slug];
          if (prog && !items.some(it => it.slug === slug || it.id === `manga-local-${slug}`)) {
            const isMeHieu = isHieu(currentUserEmail);
            const rDate = prog.readAt ? prog.readAt.split('T')[0] : localDate();
            items.push({
              id: `manga-local-${slug}`,
              userName: isMeHieu ? 'Hiếu' : 'Kim Ý',
              type: 'H_MANGA',
              title: prog.mangaTitle || prog.chapterName || slug,
              subtitle: `Đọc chapter ${prog.chapterNumber || 1}`,
              slug: slug,
              cover: prog.coverUrl || '',
              progressText: `Chapter ${prog.chapterNumber || 1}`,
              currentChapterOrPage: prog.chapterNumber || 1,
              logDate: rDate,
              updatedAt: prog.readAt || new Date().toISOString(),
            });
          }
        }
      } catch {}

      // Sắp xếp mới nhất lên đầu
      items.sort((a, b) => new Date(b.updatedAt || b.logDate).getTime() - new Date(a.updatedAt || a.logDate).getTime());
      setActivities(items);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu xem chung:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchActivities();

    if (supabase) {
      const sb = supabase;
      const channel = sb
        .channel('shared-activity-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media_items' }, () => {
          void fetchActivities();
        })
        .subscribe();

      return () => {
        void sb.removeChannel(channel);
      };
    }
  }, [currentUserEmail]);

  // Bộ lọc theo ngày và thời gian
  const filteredActivities = useMemo(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    return activities.filter(act => {
      // Lọc người
      if (activePartnerFilter === 'HIEU' && act.userName !== 'Hiếu') return false;
      if (activePartnerFilter === 'KIM_Y' && act.userName !== 'Kim Ý') return false;

      // Lọc theo mốc thời gian 1 giờ qua
      if (timeFilter === '1_HOUR') {
        const itemTime = new Date(act.updatedAt || act.logDate).getTime();
        return itemTime >= oneHourAgo;
      }

      // Lọc theo ngày (mặc định hôm nay từ 0h tới hiện tại)
      if (timeFilter === 'TODAY') {
        return act.logDate === selectedDate;
      }

      // ALL
      return true;
    });
  }, [activities, activePartnerFilter, selectedDate, timeFilter]);

  const hieuCount = useMemo(() => activities.filter(a => a.userName === 'Hiếu' && a.logDate === selectedDate).length, [activities, selectedDate]);
  const kimYCount = useMemo(() => activities.filter(a => a.userName === 'Kim Ý' && a.logDate === selectedDate).length, [activities, selectedDate]);

  // Đổi ngày
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
    setTimeFilter('TODAY');
  };

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
    if (player) {
      player.playTrack(track);
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

  const isToday = selectedDate === todayStr;

  return (
    <div className="shared-activity-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Thẻ Header Trạng thái Xem chung */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(244, 63, 94, 0.1))',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          borderRadius: '16px',
          padding: '16px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>💖</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
              Xem chung tiến độ {partnerPerson ? `với ${partnerPerson.name}` : '(Hiếu ❤️ Kim Ý)'}
            </strong>
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
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Cập nhật
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Cùng xem tiến độ đọc Sách, Truyện H, BL và bài nhạc MP3 đã nghe trong ngày. Bấm vào truyện để đọc ngay!
        </p>

        {/* Thanh đếm số hoạt động trong ngày */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <div style={{ flex: 1, background: 'var(--card-bg)', padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Hiếu:</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{hieuCount} hoạt động</strong>
          </div>
          <div style={{ flex: 1, background: 'var(--card-bg)', padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Kim Ý:</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{kimYCount} hoạt động</strong>
          </div>
        </div>
      </div>

      {/* THANH ĐIỀU HƯỚNG THỜI GIAN (0h - Hiện tại, Đổi ngày, 1h trước) */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Nút lùi/tiến ngày */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleShiftDate(-1)}
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronLeft size={15} /> Hôm qua
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--primary)" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setTimeFilter('TODAY');
                }
              }}
              style={{
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-main)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            />
            {isToday && (
              <span style={{ fontSize: '0.72rem', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                Hôm nay
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleShiftDate(1)}
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Ngày mai <ChevronRight size={15} />
          </button>
        </div>

        {/* Các nút lọc nhanh: 1h trước, Hôm nay, Tất cả */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayStr);
              setTimeFilter('TODAY');
            }}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '10px',
              border: 'none',
              background: timeFilter === 'TODAY' && selectedDate === todayStr ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
              color: timeFilter === 'TODAY' && selectedDate === todayStr ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Clock size={13} /> Hôm nay (0h - nay)
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayStr);
              setTimeFilter('1_HOUR');
            }}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '10px',
              border: 'none',
              background: timeFilter === '1_HOUR' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255, 255, 255, 0.05)',
              color: timeFilter === '1_HOUR' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Sparkles size={13} /> 1 giờ qua
          </button>

          <button
            type="button"
            onClick={() => setTimeFilter('ALL')}
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              border: 'none',
              background: timeFilter === 'ALL' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
              color: timeFilter === 'ALL' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Tất cả
          </button>
        </div>

        {/* Lọc theo người */}
        <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={() => setActivePartnerFilter('ALL')}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'ALL' ? 'var(--text-main)' : 'transparent',
              color: activePartnerFilter === 'ALL' ? 'var(--card-bg)' : 'var(--text-muted)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cả hai ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setActivePartnerFilter('HIEU')}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'HIEU' ? '#0284c7' : 'transparent',
              color: activePartnerFilter === 'HIEU' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Chỉ Hiếu
          </button>
          <button
            type="button"
            onClick={() => setActivePartnerFilter('KIM_Y')}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              border: 'none',
              background: activePartnerFilter === 'KIM_Y' ? '#f43f5e' : 'transparent',
              color: activePartnerFilter === 'KIM_Y' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Chỉ Kim Ý
          </button>
        </div>
      </div>

      {/* DANH SÁCH HOẠT ĐỘNG */}
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
            Chưa có hoạt động nào {timeFilter === '1_HOUR' ? 'trong 1 giờ qua' : `trong ngày ${selectedDate}`}
          </strong>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>
            Khi Hiếu hoặc Kim Ý đọc Sách, Truyện H, BL hoặc nghe nhạc MP3, tiến độ sẽ tự động hiển thị tại đây!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredActivities.map((act) => {
            const isMe = isHieu(currentUserEmail) ? act.userName === 'Hiếu' : act.userName === 'Kim Ý';
            const isStory = act.type === 'H_MANGA' || act.type === 'BL';
            const isH = act.type === 'H_MANGA';
            const timeFormatted = formatTimeAgo(act.updatedAt);

            return (
              <div
                key={act.id}
                onClick={() => handleItemClick(act)}
                style={{
                  background: 'var(--card-bg)',
                  border: isH ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '12px',
                  display: 'flex',
                  gap: '12px',
                  cursor: isStory || act.type === 'BOOK' ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className="shared-activity-card"
              >
                {/* Ảnh bìa */}
                <div
                  style={{
                    width: '64px',
                    height: '84px',
                    borderRadius: '10px',
                    background: 'var(--border)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {act.cover ? (
                    <img
                      src={act.cover}
                      alt={act.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>
                      {act.type === 'BOOK' && <BookOpen size={24} />}
                      {act.type === 'MUSIC' && <Music size={24} />}
                      {isStory && <Flame size={24} color="#f43f5e" />}
                    </div>
                  )}
                </div>

                {/* Nội dung thông tin */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Hàng badge: Người + Loại nội dung + Giờ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {/* Badge Người */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: act.userName === 'Hiếu' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: act.userName === 'Hiếu' ? '#0284c7' : '#f43f5e'
                        }}
                      >
                        {act.userName}
                      </span>

                      {/* Badge Thể loại: Đúng chuẩn Truyện H, không để Ngôn tình */}
                      {isH && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #e11d48, #be123c)',
                            color: '#ffffff'
                          }}
                        >
                          🔞 Truyện H
                        </span>
                      )}

                      {act.type === 'BL' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: 'rgba(236, 72, 153, 0.15)',
                            color: '#ec4899'
                          }}
                        >
                          🌸 Truyện BL
                        </span>
                      )}

                      {act.type === 'BOOK' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#8b5cf6'
                          }}
                        >
                          📚 Sách
                        </span>
                      )}

                      {act.type === 'MUSIC' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981'
                          }}
                        >
                          🎵 MP3
                        </span>
                      )}

                      {/* Thời gian */}
                      {timeFormatted && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {timeFormatted}
                        </span>
                      )}
                    </div>

                    {/* Tiêu đề tác phẩm */}
                    <div
                      style={{
                        fontSize: '0.92rem',
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
                          fontSize: '0.76rem',
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

                  {/* Thanh tiến độ hoặc Nút nghe nhạc */}
                  <div style={{ marginTop: '6px' }}>
                    {act.type === 'MUSIC' ? (
                      <button
                        type="button"
                        onClick={(e) => handlePlayMusic(e, act)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <Play size={12} fill="#ffffff" /> Nghe bài này
                      </button>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '3px' }}>
                          <span style={{ color: isH ? '#f43f5e' : 'var(--primary)', fontWeight: 700 }}>
                            {act.progressText}
                          </span>
                          {isStory && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              Nhấn để đọc <ExternalLink size={10} />
                            </span>
                          )}
                        </div>

                        {act.progressPercent !== undefined && (
                          <div style={{ width: '100%', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
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
