import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Heart, BookOpen, Clock, Play, 
  X, Bookmark, ChevronRight,
  Flame, Trophy, Zap, Calendar, Sparkles, Loader2
} from 'lucide-react';
import type { NgontinhManga, HotMangaData } from '../../types/manga';
import { 
  fetchNgontinhList, fetchNgontinhHotData, 
  getNgontinhFavorites, toggleNgontinhFavorite, 
  getNgontinhHistory, hasMangaData 
} from './ngontinhService';
import { NgontinhReaderModal } from './NgontinhReaderModal';
import './ngontinhManga.css';

type MainTab = 'all' | 'ranking' | 'history' | 'favorites';
type RankingType = 'hot' | 'top_day' | 'top_week' | 'top_month';

const BATCH_SIZE = 36;

interface CardProps {
  manga: NgontinhManga;
  rank?: number;
  isFav: boolean;
  userProgress?: { chapterNumber: number };
  onToggleFav: (e: React.MouseEvent, slug: string) => void;
  onOpenReader: (manga: NgontinhManga, chapterNum: number) => void;
  onClick: () => void;
}

const NgontinhCardItem: React.FC<CardProps> = React.memo(({
  manga,
  rank,
  isFav,
  userProgress,
  onToggleFav,
  onOpenReader,
  onClick,
}) => {
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const sortedChs = useMemo(() => {
    return [...(manga.chapters || [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  }, [manga.chapters]);
  const firstCh = sortedChs[0]?.number ?? 1;

  return (
    <div className="ngontinh-manga-card" onClick={onClick}>
      {/* Cover Wrap */}
      <div className="ngontinh-cover-wrap">
        {!imgLoaded && !imgError && <div className="ngontinh-cover-skeleton" />}

        {manga.cover && !imgError ? (
          <img
            src={manga.cover}
            alt={manga.title}
            className={`ngontinh-cover-img ${imgLoaded ? 'loaded' : 'loading'}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setImgLoaded(true);
            }}
          />
        ) : (
          <div className="ngontinh-cover-placeholder">
            <BookOpen size={32} />
          </div>
        )}

        {/* Ranking Badge */}
        {rank != null && (
          <div className={`ngontinh-rank-badge rank-${rank <= 3 ? rank : 'other'}`}>
            {rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`}
          </div>
        )}

        {/* Hot Tag */}
        {rank == null && manga.isHot && (
          <div className="ngontinh-hot-tag">🔥 HOT</div>
        )}

        {/* Favorite Button */}
        <button
          className={`ngontinh-card-fav-btn ${isFav ? 'favorited' : ''}`}
          onClick={(e) => onToggleFav(e, manga.slug)}
          title={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
        >
          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        {/* Total Chapters Badge / No Data Badge */}
        {hasMangaData(manga) ? (
          <div className="ngontinh-card-chapter-badge">
            {manga.totalChapters || manga.chapters.length} Ch
          </div>
        ) : (
          <div className="ngontinh-card-nodata-badge">
            Chưa có dữ liệu
          </div>
        )}

        {/* Reading Status Badge */}
        {userProgress && (
          <div className="ngontinh-reading-ribbon">
            Đang đọc #{userProgress.chapterNumber}
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="ngontinh-card-details">
        <h3 className="ngontinh-card-title" title={manga.title}>
          {manga.title}
        </h3>

        <div className="ngontinh-card-actions">
          {hasMangaData(manga) ? (
            <button
              className="ngontinh-btn-read-primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReader(manga, userProgress?.chapterNumber ?? firstCh);
              }}
            >
              <Play size={13} fill="currentColor" />
              {userProgress ? `Đọc tiếp #${userProgress.chapterNumber}` : 'Đọc ngay'}
            </button>
          ) : (
            <span className="ngontinh-nodata-label">Chưa có dữ liệu</span>
          )}
        </div>
      </div>
    </div>
  );
});

export const NgontinhMangaPage: React.FC = () => {
  const navigate = useNavigate();
  const [mangaList, setMangaList] = useState<NgontinhManga[]>([]);
  const [hotData, setHotData] = useState<HotMangaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<MainTab>('all');
  const [rankingType, setRankingType] = useState<RankingType>('hot');
  
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, any>>({});
  
  // Progressive batching count
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Quick Reader modal state
  const [readingState, setReadingState] = useState<{ manga: NgontinhManga; chapterNum: number } | null>(null);

  const loadData = async () => {
    try {
      const [list, hot] = await Promise.all([
        fetchNgontinhList(),
        fetchNgontinhHotData(),
      ]);

      if (list && list.length > 0) {
        setMangaList(list);
      }
      if (hot) {
        setHotData(hot);
      }
    } catch (err) {
      console.error('Failed to load Ngôn Tình comics list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setFavorites(getNgontinhFavorites());
    setHistory(getNgontinhHistory());

    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, []);

  // Reset pagination on tab/search change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [activeTab, rankingType, searchQuery]);

  const handleToggleFav = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    toggleNgontinhFavorite(slug);
    setFavorites(getNgontinhFavorites());
  };

  // Map slug to full manga details
  const mangaMap = useMemo(() => {
    return new Map(mangaList.map(m => [m.slug, m]));
  }, [mangaList]);

  // Filtered and Sorted list according to tab
  const filteredList = useMemo(() => {
    let result: { manga: NgontinhManga; rank?: number; rankType?: string }[] = [];

    if (activeTab === 'ranking') {
      if (rankingType === 'hot') {
        if (hotData?.hot && hotData.hot.length > 0) {
          result = hotData.hot.map(h => ({
            manga: mangaMap.get(h.slug) || {
              slug: h.slug,
              title: h.title,
              cover: h.cover,
              description: '',
              genres: ['Ngôn Tình'],
              url: h.url,
              chapters: [],
              totalChapters: 0,
              isHot: true,
              hotRank: h.rank,
            },
            rank: h.rank,
            rankType: 'HOT',
          }));
        } else {
          result = mangaList
            .filter(m => m.isHot || (m.hotRank != null))
            .sort((a, b) => (a.hotRank ?? 999) - (b.hotRank ?? 999))
            .map(m => ({ manga: m, rank: m.hotRank ?? undefined, rankType: 'HOT' }));
        }
      } else if (rankingType === 'top_day') {
        if (hotData?.top_day && hotData.top_day.length > 0) {
          result = hotData.top_day.map(h => ({
            manga: mangaMap.get(h.slug) || {
              slug: h.slug,
              title: h.title,
              cover: h.cover,
              description: '',
              genres: ['Ngôn Tình'],
              url: h.url,
              chapters: [],
              totalChapters: 0,
              topDayRank: h.rank,
            },
            rank: h.rank,
            rankType: 'TOP_DAY',
          }));
        } else {
          result = mangaList
            .filter(m => m.topDayRank != null)
            .sort((a, b) => (a.topDayRank ?? 999) - (b.topDayRank ?? 999))
            .map(m => ({ manga: m, rank: m.topDayRank ?? undefined, rankType: 'TOP_DAY' }));
        }
      } else if (rankingType === 'top_week') {
        if (hotData?.top_week && hotData.top_week.length > 0) {
          result = hotData.top_week.map(h => ({
            manga: mangaMap.get(h.slug) || {
              slug: h.slug,
              title: h.title,
              cover: h.cover,
              description: '',
              genres: ['Ngôn Tình'],
              url: h.url,
              chapters: [],
              totalChapters: 0,
              topWeekRank: h.rank,
            },
            rank: h.rank,
            rankType: 'TOP_WEEK',
          }));
        } else {
          result = mangaList
            .filter(m => m.topWeekRank != null)
            .sort((a, b) => (a.topWeekRank ?? 999) - (b.topWeekRank ?? 999))
            .map(m => ({ manga: m, rank: m.topWeekRank ?? undefined, rankType: 'TOP_WEEK' }));
        }
      } else if (rankingType === 'top_month') {
        if (hotData?.top_month && hotData.top_month.length > 0) {
          result = hotData.top_month.map(h => ({
            manga: mangaMap.get(h.slug) || {
              slug: h.slug,
              title: h.title,
              cover: h.cover,
              description: '',
              genres: ['Ngôn Tình'],
              url: h.url,
              chapters: [],
              totalChapters: 0,
              topMonthRank: h.rank,
            },
            rank: h.rank,
            rankType: 'TOP_MONTH',
          }));
        } else {
          result = mangaList
            .filter(m => m.topMonthRank != null)
            .sort((a, b) => (a.topMonthRank ?? 999) - (b.topMonthRank ?? 999))
            .map(m => ({ manga: m, rank: m.topMonthRank ?? undefined, rankType: 'TOP_MONTH' }));
        }
      }
    } else if (activeTab === 'favorites') {
      result = mangaList
        .filter(m => favorites.includes(m.slug))
        .map(m => ({ manga: m }));
    } else if (activeTab === 'history') {
      result = mangaList
        .filter(m => history[m.slug])
        .map(m => ({ manga: m }));
    } else {
      // 'all'
      result = mangaList.map(m => ({ manga: m }));
    }

    // Search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => item.manga.title.toLowerCase().includes(q));
    }

    return result;
  }, [mangaList, mangaMap, hotData, activeTab, rankingType, favorites, history, searchQuery]);

  // Paginated visible list
  const visibleItems = useMemo(() => {
    return filteredList.slice(0, visibleCount);
  }, [filteredList, visibleCount]);

  // Infinite Scroll Intersection Observer
  useEffect(() => {
    if (!sentinelRef.current || visibleCount >= filteredList.length) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredList.length));
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, filteredList.length]);

  const openReader = (manga: NgontinhManga, chapterNum: number) => {
    setReadingState({ manga, chapterNum });
    setHistory(getNgontinhHistory());
  };

  // Top 6 Spotlight items
  const spotlightItems = useMemo(() => {
    if (hotData?.hot && hotData.hot.length > 0) {
      return hotData.hot.slice(0, 6).map(h => mangaMap.get(h.slug) || {
        slug: h.slug,
        title: h.title,
        cover: h.cover,
        description: '',
        genres: ['Ngôn Tình'],
        url: h.url,
        chapters: [],
        totalChapters: 0,
        hotRank: h.rank,
      });
    }
    return mangaList.filter(m => m.hotRank != null || m.isHot).slice(0, 6);
  }, [hotData, mangaMap, mangaList]);

  return (
    <div className="ngontinh-page-container">
      {/* Top Header & Main Navigation Bar */}
      <div className="ngontinh-top-nav-bar">
        <div className="ngontinh-nav-tabs">
          <button
            className={`ngontinh-nav-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <BookOpen size={16} /> Tất cả <span className="ngontinh-count-pill">{mangaList.length}</span>
          </button>
          
          <button
            className={`ngontinh-nav-tab-btn ${activeTab === 'ranking' ? 'active' : ''}`}
            onClick={() => setActiveTab('ranking')}
            style={activeTab === 'ranking' ? { color: '#e11d48' } : {}}
          >
            <Flame size={16} color={activeTab === 'ranking' ? '#e11d48' : 'currentColor'} /> Bảng Xếp Hạng
          </button>

          <button
            className={`ngontinh-nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} /> Đang đọc <span className="ngontinh-count-pill">{Object.keys(history).length}</span>
          </button>

          <button
            className={`ngontinh-nav-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <Heart size={16} /> Yêu thích <span className="ngontinh-count-pill">{favorites.length}</span>
          </button>
        </div>

        <div className="ngontinh-search-wrapper">
          <Search size={16} className="ngontinh-search-icon" />
          <input
            type="text"
            placeholder={`Tìm kiếm trong ${mangaList.length || 'kho'} bộ truyện Ngôn Tình...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ngontinh-search-input"
          />
          {searchQuery && (
            <button className="ngontinh-search-clear" onClick={() => setSearchQuery('')}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Sub-chips for Ranking when Bảng Xếp Hạng is selected */}
      {activeTab === 'ranking' && (
        <div className="ngontinh-ranking-subtabs">
          <button
            className={`ngontinh-ranking-chip ${rankingType === 'hot' ? 'active' : ''}`}
            onClick={() => setRankingType('hot')}
          >
            <Flame size={14} /> Hot Nhất ({hotData?.hot?.length ?? 0})
          </button>
          <button
            className={`ngontinh-ranking-chip ${rankingType === 'top_day' ? 'active' : ''}`}
            onClick={() => setRankingType('top_day')}
          >
            <Zap size={14} /> Top Hôm Nay ({hotData?.top_day?.length ?? 0})
          </button>
          <button
            className={`ngontinh-ranking-chip ${rankingType === 'top_week' ? 'active' : ''}`}
            onClick={() => setRankingType('top_week')}
          >
            <Calendar size={14} /> Top Tuần Này ({hotData?.top_week?.length ?? 0})
          </button>
          <button
            className={`ngontinh-ranking-chip ${rankingType === 'top_month' ? 'active' : ''}`}
            onClick={() => setRankingType('top_month')}
          >
            <Trophy size={14} /> Top Tháng Này ({hotData?.top_month?.length ?? 0})
          </button>
        </div>
      )}

      {/* Top 6 Hot Spotlight Carousel */}
      {activeTab === 'all' && !searchQuery && spotlightItems.length > 0 && (
        <div className="ngontinh-spotlight-section">
          <div className="ngontinh-spotlight-head">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#e11d48" /> Thịnh hành nhất tuần qua
            </span>
            <button 
              className="ngontinh-spotlight-more"
              onClick={() => {
                setActiveTab('ranking');
                setRankingType('hot');
              }}
            >
              Xem bảng xếp hạng <ChevronRight size={14} />
            </button>
          </div>
          <div className="ngontinh-spotlight-list">
            {spotlightItems.map((manga, idx) => (
              <div
                key={`spotlight-${manga.slug}`}
                className="ngontinh-spotlight-card"
                onClick={() => navigate(`/ngontinh/${manga.slug}`)}
              >
                <div className={`ngontinh-rank-badge rank-${idx + 1 <= 3 ? idx + 1 : 'other'}`}>
                  {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                </div>
                {manga.cover ? (
                  <img 
                    src={manga.cover} 
                    alt={manga.title} 
                    className="ngontinh-spotlight-cover" 
                    loading="lazy" 
                    decoding="async" 
                  />
                ) : (
                  <div className="ngontinh-cover-placeholder" style={{ height: 200 }}>
                    <BookOpen size={24} />
                  </div>
                )}
                <div className="ngontinh-spotlight-info">
                  <span className="ngontinh-spotlight-title">{manga.title}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {manga.totalChapters || manga.chapters.length} chapters
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manga Grid View with Progressive Batching */}
      {loading && mangaList.length === 0 ? (
        <div className="ngontinh-loading-box">
          <div className="ngontinh-spinner" />
          <p>Đang tải danh sách truyện Ngôn Tình...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="ngontinh-empty-state">
          <Bookmark size={40} className="ngontinh-empty-icon" />
          <h3>Không tìm thấy truyện phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác hoặc chuyển sang tab khác.</p>
        </div>
      ) : (
        <>
          <div className="ngontinh-manga-grid">
            {visibleItems.map(({ manga, rank }) => {
              const isFav = favorites.includes(manga.slug);
              const userProgress = history[manga.slug];

              return (
                <NgontinhCardItem
                  key={manga.slug}
                  manga={manga}
                  rank={rank}
                  isFav={isFav}
                  userProgress={userProgress}
                  onToggleFav={handleToggleFav}
                  onOpenReader={openReader}
                  onClick={() => navigate(`/ngontinh/${manga.slug}`)}
                />
              );
            })}
          </div>

          {/* Load More & Infinite Scroll Sentinel */}
          {visibleCount < filteredList.length && (
            <div className="ngontinh-pagination-footer">
              <div ref={sentinelRef} style={{ height: 10 }} />
              <button
                className="ngontinh-btn-load-more"
                onClick={() => setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredList.length))}
              >
                <Loader2 size={16} className="ngontinh-spin-icon" />
                <span>
                  Hiển thị thêm (+{Math.min(BATCH_SIZE, filteredList.length - visibleCount)}) · Còn lại {filteredList.length - visibleCount} truyện
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Quick Webtoon Reader Modal */}
      {readingState && (
        <NgontinhReaderModal
          manga={readingState.manga}
          initialChapterNum={readingState.chapterNum}
          onClose={() => {
            setReadingState(null);
            setHistory(getNgontinhHistory());
          }}
        />
      )}
    </div>
  );
};
