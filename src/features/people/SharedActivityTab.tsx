import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Music, Play, Flame, RefreshCw, ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { localDate } from '../../lib/date';
import { useOptionalAudioPlayer } from '../library/AudioPlayerContext';
import { useToast } from '../ToastContext';
import { DatePager } from '../home/DatePager';
import { getMangaReadingLogs } from '../../lib/mangaReadingLog';
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
  durationMinutes?: number;
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

  const [selectedDate, setSelectedDate] = useState<string>(localDate());
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
      const itemsMap = new Map<string, SharedActivityItem>();

      // 1. Fetch Media Items từ Supabase
      if (supabase) {
        const { data: mediaRows } = await supabase
          .from('media_items')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(200);

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

            // A. Sách: Chỉ tính khi có tiến độ thực tế (trang > 1 hoặc tiến độ > 5% hoặc hoàn thành)
            if (m.type === 'BOOK') {
              const current = m.current_page || m.current_chapter || 0;
              const total = m.total_pages || m.total_chapters || 100;
              const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : undefined;

              // Điều kiện: Chỉ tính nếu đã đọc trang > 1 hoặc pct >= 5% hoặc status = COMPLETED/IN_PROGRESS
              const isActuallyReading = current > 1 || (pct && pct >= 5) || m.status === 'COMPLETED' || m.status === 'IN_PROGRESS';
              if (isActuallyReading) {
                const key = `${userName}::BOOK::${m.name || m.id}`;
                itemsMap.set(key, {
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
            }

            // B. Truyện H / BL: Chỉ tính khi đã đọc thực tế (> 5 phút hoặc chapter > 1 hoặc pct >= 5%)
            if (m.type === 'STORY' || m.type === 'MANGA') {
              const isBL = m.genre === 'BL' || m.source === 'bl';
              const storyType: 'H_MANGA' | 'BL' = isBL ? 'BL' : 'H_MANGA';

              const current = m.current_chapter || 1;
              const total = m.total_chapters;
              const pct = total ? Math.min(100, Math.round((current / total) * 100)) : undefined;
              const slug = m.channel || m.slug || m.name || '';

              // Điều kiện: Không tính nếu chỉ bấm vào 1 giây (phải có chapter > 1 hoặc pct >= 5% hoặc in_progress)
              const isActuallyReading = current > 1 || (pct && pct >= 5) || m.status === 'IN_PROGRESS' || m.status === 'COMPLETED';
              if (isActuallyReading) {
                const key = `${userName}::${storyType}::${slug}`;
                itemsMap.set(key, {
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
            }

            // C. Nhạc MP3: Có file âm thanh
            if (m.type === 'MUSIC' && (m.url?.endsWith('.mp3') || m.url?.includes('audio') || m.url?.includes('supabase') || m.url?.includes('mp3') || m.audio_url || m.status === 'COMPLETED')) {
              const key = `${userName}::MUSIC::${m.name || m.id}`;
              itemsMap.set(key, {
                id: `music-${m.id}`,
                user_id: m.user_id,
                userName,
                type: 'MUSIC',
                title: m.name || 'Bài hát',
                subtitle: m.artist || 'Nghệ sĩ',
                cover: m.cover_url || m.cover || '',
                progressText: m.log_time ? `Đã nghe lúc ${m.log_time}` : 'Đã nghe trong ngày',
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

      // 2. Bổ sung từ Manga Reading Logs (Có theo dõi thời gian đọc thực tế > 5 phút)
      try {
        const localMangaLogs = getMangaReadingLogs();
        for (const log of localMangaLogs) {
          const isH = log.mangaType === 'H_MANGA';
          const storyType: 'H_MANGA' | 'BL' = isH ? 'H_MANGA' : 'BL';
          const isMeHieu = isHieu(currentUserEmail);
          const userName = isMeHieu ? 'Hiếu' : 'Kim Ý';
          const key = `${userName}::${storyType}::${log.mangaSlug}`;

          // Chỉ tính nếu đọc >= 5 phút hoặc chapter > 1
          const duration = log.durationMinutes || 0;
          if (duration >= 5 || log.chapterNumber > 1) {
            const existing = itemsMap.get(key);
            if (!existing || new Date(log.readAt).getTime() > new Date(existing.updatedAt).getTime()) {
              itemsMap.set(key, {
                id: `manga-log-${log.id}`,
                userName,
                type: storyType,
                title: log.mangaTitle || log.mangaSlug,
                subtitle: `Đã đọc ${duration > 0 ? `${duration} phút` : ''} · ${log.chapterName || `Chapter ${log.chapterNumber}`}`,
                slug: log.mangaSlug,
                progressText: `Chapter ${log.chapterNumber}${duration > 0 ? ` (${duration} phút)` : ''}`,
                currentChapterOrPage: log.chapterNumber,
                durationMinutes: duration,
                logDate: log.log_date,
                updatedAt: log.readAt,
              });
            }
          }
        }
      } catch {}

      // 3. Chuyển map thành mảng và sắp xếp mới nhất lên đầu
      const list = Array.from(itemsMap.values());
      list.sort((a, b) => new Date(b.updatedAt || b.logDate).getTime() - new Date(a.updatedAt || a.logDate).getTime());
      setActivities(list);
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

  // Lọc hoạt động theo đúng ngày được chọn (giống logic Home)
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // 1. Phải khớp ngày đang chọn
      if (act.logDate !== selectedDate) return false;

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

  return (
    <div className="shared-activity-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* THANH ĐIỀU HƯỚNG LỊCH CHUẨN (GIỐNG HỆT LOGIC TRANG HOME) */}
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
            Không có hoạt động đọc hoặc nghe nhạc trong ngày này
          </strong>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>
            Tiến độ chỉ hiển thị khi đã đọc thực sự (trên 5 phút hoặc qua các chapter).
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredActivities.map((act) => {
            const isStory = act.type === 'H_MANGA' || act.type === 'BL';
            const isH = act.type === 'H_MANGA';
            const timeFormatted = formatTimeAgo(act.updatedAt);

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
                {/* Ảnh bìa */}
                <div
                  style={{
                    width: '60px',
                    height: '78px',
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
                      {act.type === 'BOOK' && <BookOpen size={22} />}
                      {act.type === 'MUSIC' && <Music size={22} />}
                      {isStory && <Flame size={22} color="#f43f5e" />}
                    </div>
                  )}
                </div>

                {/* Nội dung thông tin */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Hàng badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
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
                          📚 Sách
                        </span>
                      )}

                      {act.type === 'MUSIC' && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981'
                          }}
                        >
                          🎵 MP3
                        </span>
                      )}

                      {timeFormatted && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {timeFormatted}
                        </span>
                      )}
                    </div>

                    {/* Tiêu đề */}
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

                  {/* Tiến độ / Nút nghe */}
                  <div style={{ marginTop: '5px' }}>
                    {act.type === 'MUSIC' ? (
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
                          gap: '5px'
                        }}
                      >
                        <Play size={11} fill="#ffffff" /> Nghe bài này
                      </button>
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
