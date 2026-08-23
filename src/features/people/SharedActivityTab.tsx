import React, { useEffect, useState, useMemo } from 'react';
import { 
  BookOpen, Music, Play, Pause, Heart, Sparkles, Clock, 
  Calendar, ChevronRight, User, RefreshCw, Bookmark, Flame,
  CheckCircle2, BookMarked, Layers, Volume2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { localDate } from '../../lib/date';
import { useOptionalAudioPlayer } from '../library/AudioPlayerContext';
import { useToast } from '../ToastContext';
import type { Media } from '../../types';

export interface SharedActivityItem {
  id: string;
  user_id?: string;
  userName: 'Hiếu' | 'Kim Ý' | string;
  type: 'BOOK' | 'NGONTINH' | 'BL' | 'H_MANGA' | 'MUSIC';
  title: string;
  subtitle?: string;
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

export function SharedActivityTab() {
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
      const items: SharedActivityItem[] = [];

      // 1. Fetch Media Items (Sách, Truyện, Nhạc)
      if (supabase) {
        const { data: mediaRows } = await supabase
          .from('media_items')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(100);

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

            // B. Truyện H / Ngôn Tình / BL
            if (m.type === 'STORY' || m.type === 'MANGA') {
              let storyType: 'NGONTINH' | 'BL' | 'H_MANGA' = 'NGONTINH';
              if (m.genre === 'H_PROGRESS' || m.genre?.includes('H_') || m.source === 'sayhentai' || m.source === 'metruyen18') {
                storyType = 'H_MANGA';
              } else if (m.genre === 'BL' || m.source === 'bl') {
                storyType = 'BL';
              }

              const current = m.current_chapter || 1;
              const total = m.total_chapters;
              const pct = total ? Math.min(100, Math.round((current / total) * 100)) : undefined;

              items.push({
                id: `manga-${m.id}`,
                user_id: m.user_id,
                userName,
                type: storyType,
                title: m.name || m.title || 'Truyện tranh',
                subtitle: m.channel ? `Slug: ${m.channel}` : m.author || '',
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

            // C. Nhạc MP3
            if (m.type === 'MUSIC' && (m.url?.endsWith('.mp3') || m.url?.includes('audio') || m.url?.includes('supabase') || m.url?.includes('mp3') || m.status === 'COMPLETED')) {
              items.push({
                id: `music-${m.id}`,
                user_id: m.user_id,
                userName,
                type: 'MUSIC',
                title: m.name || 'Bài hát',
                subtitle: m.artist || 'Nghệ sĩ',
                cover: m.cover_url || m.cover || '',
                progressText: m.log_time ? `Đã nghe lúc ${m.log_time}` : 'Vừa nghe gần đây',
                audioUrl: m.url,
                artist: m.artist,
                logDate: rowDate,
                updatedAt: m.updated_at || m.created_at || '',
                rawMedia: m
              });
            }
          }
        }
      }

      // 2. Bổ sung dữ liệu cục bộ (LocalStorage Reading Progress của máy hiện tại)
      try {
        const hHistory = JSON.parse(localStorage.getItem('daily_hmanga_history_v1') || '{}');
        for (const slug of Object.keys(hHistory)) {
          const prog = hHistory[slug];
          if (prog && !items.some(it => it.id === `manga-local-${slug}`)) {
            const isMeHieu = isHieu(currentUserEmail);
            items.push({
              id: `manga-local-${slug}`,
              userName: isMeHieu ? 'Hiếu' : 'Kim Ý',
              type: 'H_MANGA',
              title: prog.chapterName ? `${slug} (${prog.chapterName})` : slug,
              progressText: `Đang đọc Chapter ${prog.chapterNumber || 1}`,
              currentChapterOrPage: prog.chapterNumber || 1,
              logDate: prog.readAt ? prog.readAt.split('T')[0] : localDate(),
              updatedAt: prog.readAt || new Date().toISOString(),
            });
          }
        }
      } catch {}

      setActivities(items);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu xem chung:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchActivities();

    // Realtime subscription lắng nghe thay đổi tiến độ đọc / nghe
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

  // Phân loại hoạt động
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      if (activePartnerFilter === 'HIEU' && act.userName !== 'Hiếu') return false;
      if (activePartnerFilter === 'KIM_Y' && act.userName !== 'Kim Ý') return false;
      return true;
    });
  }, [activities, activePartnerFilter]);

  const hieuActivities = useMemo(() => activities.filter(a => a.userName === 'Hiếu'), [activities]);
  const kimYActivities = useMemo(() => activities.filter(a => a.userName === 'Kim Ý'), [activities]);

  const handlePlayMusic = (act: SharedActivityItem) => {
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


  const getTypeBadge = (type: SharedActivityItem['type']) => {
    switch (type) {
      case 'BOOK':
        return { label: 'Sách', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', icon: BookOpen };
      case 'NGONTINH':
        return { label: 'Ngôn Tình', bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', icon: Heart };
      case 'BL':
        return { label: 'Truyện BL', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', icon: BookMarked };
      case 'H_MANGA':
        return { label: 'Truyện 18+', bg: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', icon: Flame };
      case 'MUSIC':
        return { label: 'Nhạc MP3', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: Music };
    }
  };

  return (
    <div className="shared-activity-tab" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner Giới thiệu Đồng Hành Đôi Lứa */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4c1d95, #831843)',
          borderRadius: '20px',
          padding: '20px',
          color: '#ffffff',
          boxShadow: '0 12px 30px rgba(131, 24, 67, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Sparkles size={24} color="#fbcfe8" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fdf2f8' }}>
              Xem chung · Đồng hành cùng nhau
            </h2>
            <span style={{ fontSize: '0.84rem', color: '#fce7f3', opacity: 0.9 }}>
              Theo dõi tiến độ đọc sách, truyện tranh & cùng thưởng thức những bài nhạc MP3 của nhau mỗi ngày
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchActivities()}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: '12px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#fff',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} /> {loading ? 'Đang nạp…' : 'Làm mới'}
        </button>
      </div>

      {/* Filter Tabs Chọn người xem */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: `Tất cả (${activities.length})` },
          { key: 'HIEU', label: `Hoạt động của Hiếu (${hieuActivities.length})` },
          { key: 'KIM_Y', label: `Hoạt động của Kim Ý (${kimYActivities.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActivePartnerFilter(tab.key as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              border: activePartnerFilter === tab.key ? '2px solid #ec4899' : '1px solid var(--border)',
              background: activePartnerFilter === tab.key ? 'rgba(236, 72, 153, 0.15)' : 'var(--card-bg)',
              color: activePartnerFilter === tab.key ? '#ec4899' : 'var(--text-main)',
              fontWeight: 800,
              fontSize: '0.86rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid 2 Cột Hiển thị Song Song Hiếu & Kim Ý */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* CỘT 1: HIẾU */}
        {(activePartnerFilter === 'ALL' || activePartnerFilter === 'HIEU') && (
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                  H
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Hiếu đang đọc & nghe</h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Cập nhật liên tục</span>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                {hieuActivities.length} mục
              </span>
            </div>

            {hieuActivities.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '0.88rem' }}>
                Chưa có hoạt động đọc hoặc nghe nhạc nào gần đây.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {hieuActivities.map((act) => {
                  const badge = getTypeBadge(act.type);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={act.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '14px',
                        background: 'var(--card-sub-bg, rgba(255, 255, 255, 0.04))',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: badge.bg,
                            color: badge.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={20} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px', background: badge.bg, color: badge.color }}>
                              {badge.label}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {act.logDate}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {act.title}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                            {act.progressText}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      {act.type === 'MUSIC' && act.audioUrl && (
                        <button
                          type="button"
                          onClick={() => handlePlayMusic(act)}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)',
                            flexShrink: 0,
                          }}
                          title="Bấm để nghe bài hát này"
                        >
                          <Play size={16} fill="#fff" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CỘT 2: KIM Ý */}
        {(activePartnerFilter === 'ALL' || activePartnerFilter === 'KIM_Y') && (
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ec4899', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                  Y
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Kim Ý đang đọc & nghe</h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Cập nhật liên tục</span>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
                {kimYActivities.length} mục
              </span>
            </div>

            {kimYActivities.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '0.88rem' }}>
                Chưa có hoạt động đọc hoặc nghe nhạc nào gần đây từ Kim Ý.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {kimYActivities.map((act) => {
                  const badge = getTypeBadge(act.type);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={act.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '14px',
                        background: 'var(--card-sub-bg, rgba(255, 255, 255, 0.04))',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: badge.bg,
                            color: badge.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={20} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px', background: badge.bg, color: badge.color }}>
                              {badge.label}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {act.logDate}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {act.title}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                            {act.progressText}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      {act.type === 'MUSIC' && act.audioUrl && (
                        <button
                          type="button"
                          onClick={() => handlePlayMusic(act)}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)',
                            flexShrink: 0,
                          }}
                          title="Bấm để nghe bài hát này"
                        >
                          <Play size={16} fill="#fff" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
