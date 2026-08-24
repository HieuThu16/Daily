import React, { useState, useMemo } from 'react';
import { X, Clock, Zap, BookOpen, ChevronRight, Calendar } from 'lucide-react';
import type { BLManga } from '../../types/manga';
import type { HManga } from './hMangaService';
import { getChapterImageUrl, isValidHMangaCover } from './hMangaService';
import { Z } from '../../lib/zLayers'

interface StoryItem {
  slug: string;
  title: string;
  cover?: string | null;
  chapters?: any[];
  totalChapters?: number;
  updatedAt?: string;
  source?: string;
  sourceName?: string;
  description?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: (StoryItem | HManga | BLManga)[];
  onSelectStory: (story: StoryItem) => void;
  accentColor?: string;
}

type TimeFilter = '1h' | 'today' | 'all';

export const RecentCrawledModal: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  items,
  onSelectStory,
  accentColor = '#a855f7',
}) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('1h');

  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.updatedAt) {
        return timeFilter === 'all';
      }
      const updatedTime = new Date(item.updatedAt).getTime();
      if (isNaN(updatedTime)) return timeFilter === 'all';

      const diff = now - updatedTime;
      if (timeFilter === '1h') return diff <= ONE_HOUR;
      if (timeFilter === 'today') return diff <= ONE_DAY;
      return true;
    }).sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [items, timeFilter, now]);

  if (!isOpen) return null;

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Vừa xong';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Gần đây';

    const diffSec = Math.floor((now - date.getTime()) / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: Z.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          backgroundColor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `${accentColor}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f4f4f5' }}>
                {title}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
                Danh sách các truyện vừa được cào hoặc cập nhật chapter mới
              </p>
            </div>
          </div>
          <button
            aria-label="Đóng"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d4d4d8',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Time Filter Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: '#121214',
          }}
        >
          <button
            onClick={() => setTimeFilter('1h')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: '1px solid',
              borderColor: timeFilter === '1h' ? accentColor : 'rgba(255, 255, 255, 0.1)',
              background: timeFilter === '1h' ? `${accentColor}22` : 'transparent',
              color: timeFilter === '1h' ? accentColor : '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={14} />
            <span>Trong 1h trước</span>
          </button>

          <button
            onClick={() => setTimeFilter('today')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: '1px solid',
              borderColor: timeFilter === 'today' ? accentColor : 'rgba(255, 255, 255, 0.1)',
              background: timeFilter === 'today' ? `${accentColor}22` : 'transparent',
              color: timeFilter === 'today' ? accentColor : '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={14} />
            <span>Hôm nay (24h)</span>
          </button>

          <button
            onClick={() => setTimeFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: '1px solid',
              borderColor: timeFilter === 'all' ? accentColor : 'rgba(255, 255, 255, 0.1)',
              background: timeFilter === 'all' ? `${accentColor}22` : 'transparent',
              color: timeFilter === 'all' ? accentColor : '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BookOpen size={14} />
            <span>Tất cả đã cào ({items.length})</span>
          </button>
        </div>

        {/* Story List Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#71717a',
              }}
            >
              <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#a1a1aa' }}>
                {timeFilter === '1h'
                  ? 'Chưa có truyện nào được cào trong 1 giờ qua.'
                  : 'Không có truyện nào trong danh mục này.'}
              </p>
              {timeFilter === '1h' && (
                <button
                  onClick={() => setTimeFilter('all')}
                  style={{
                    marginTop: '12px',
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: `${accentColor}33`,
                    color: accentColor,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Xem toàn bộ danh sách đã cào
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((story) => {
              const coverImg = isValidHMangaCover(story.cover)
                ? story.cover
                : getChapterImageUrl(story.chapters?.[0]?.images?.[0]) || story.cover || '';
              const chapterCount = story.chapters?.length || story.totalChapters || 0;

              return (
                <div
                  key={story.slug}
                  onClick={() => {
                    onSelectStory(story);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.borderColor = `${accentColor}55`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  {/* Cover */}
                  <div
                    style={{
                      width: '48px',
                      height: '64px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      backgroundColor: '#27272a',
                      flexShrink: 0,
                    }}
                  >
                    {coverImg ? (
                      <img
                        src={coverImg}
                        alt={story.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#52525b',
                        }}
                      >
                        <BookOpen size={20} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4
                      style={{
                        margin: '0 0 4px',
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        color: '#f4f4f5',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {story.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: `${accentColor}22`,
                          color: accentColor,
                          fontWeight: 600,
                        }}
                      >
                        {chapterCount} chương
                      </span>
                      {story.sourceName && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#71717a',
                          }}
                        >
                          {story.sourceName}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#a1a1aa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Clock size={11} />
                        {formatRelativeTime(story.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={18} style={{ color: '#52525b', flexShrink: 0 }} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
