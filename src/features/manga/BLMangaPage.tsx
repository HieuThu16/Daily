import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Heart, BookOpen, Clock, Play, 
  X, Bookmark, ChevronRight,
  Flame, Trophy, Zap, Calendar, Sparkles, Loader2,
  Layers, Check, FolderOpen,
  ExternalLink,
} from 'lucide-react';
import type { BLManga, HotMangaData } from '../../types/manga';
import { 
  fetchBLMangaList, fetchHotMangaData, 
  getFavorites, toggleFavorite, 
  getReadingHistory, hasMangaData,
  getCustomBLMangaList
} from './mangaService';
import { BLReaderModal } from './BLReaderModal';
import { LocalCbzReader } from './LocalCbzReader';
import { RecentCrawledModal } from './RecentCrawledModal';
import { useScrollRestore } from '../shared';
import './blManga.css';

type MainTab = 'all' | 'ranking' | 'history' | 'favorites';
type RankingType = 'hot' | 'top_day' | 'top_week' | 'top_month';
type SourceFilter = 'all' | 'teamsany' | 'dualeo';

const BATCH_SIZE = 36;

interface CardProps {
  manga: BLManga;
  rank?: number;
  isFav: boolean;
  userProgress?: { chapterNumber: number };
  onToggleFav: (e: React.MouseEvent, slug: string) => void;
  onOpenReader: (manga: BLManga, chapterNum: number) => void;
  onClick: () => void;
}

const BLMangaCardItem: React.FC<CardProps> = React.memo(({
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

  const isSanyTeam = manga.source === 'teamsany' || manga.sourceName === 'Sany Team';

  return (
    <div className="bl-manga-card" onClick={onClick}>
      {/* Cover Wrap */}
      <div className="bl-cover-wrap">
        {!imgLoaded && !imgError && <div className="bl-cover-skeleton" />}

        {manga.cover && !imgError ? (
          <img
            src={manga.cover}
            alt={manga.title}
            className={`bl-cover-img ${imgLoaded ? 'loaded' : 'loading'}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setImgLoaded(true);
            }}
          />
        ) : (
          <div className="bl-cover-placeholder">
            <BookOpen size={32} />
          </div>
        )}

        {/* Ranking Badge */}
        {rank != null && (
          <div className={`bl-rank-badge rank-${rank <= 3 ? rank : 'other'}`}>
            {rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`}
          </div>
        )}

        {/* Hot Tag */}
        {rank == null && manga.isHot && (
          <div className="bl-hot-tag">🔥 HOT</div>
        )}

        {/* Source Badge */}
        {isSanyTeam && (
          <div className="bl-sany-source-tag" title="Truyện từ nhóm Sany Team">
            ✨ Sany Team
          </div>
        )}

        {/* Favorite Button */}
        <button
          className={`bl-card-fav-btn ${isFav ? 'favorited' : ''}`}
          onClick={(e) => onToggleFav(e, manga.slug)}
          title={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
        >
          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        {/* Total Chapters Badge / No Data Badge */}
        {hasMangaData(manga) ? (
          <div className="bl-card-chapter-badge">
            {manga.totalChapters || manga.chapters.length} Ch
          </div>
        ) : (
          <div className="bl-card-nodata-badge">
            Chưa có dữ liệu
          </div>
        )}

        {/* Reading Status Badge */}
        {userProgress && (
          <div className="bl-reading-ribbon">
            Đang đọc #{userProgress.chapterNumber}
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="bl-card-details">
        <h3 className="bl-card-title" title={manga.title}>
          {manga.title}
        </h3>

        {manga.author && (
          <div className="bl-card-author" title={manga.author}>
            {manga.author}
          </div>
        )}

        <div className="bl-card-actions">
          {hasMangaData(manga) ? (
            <button
              className="bl-btn-read-primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReader(manga, userProgress?.chapterNumber ?? firstCh);
              }}
            >
              <Play size={13} fill="currentColor" />
              {userProgress ? `Đọc tiếp #${userProgress.chapterNumber}` : 'Đọc ngay'}
            </button>
          ) : manga.url ? (
            <a
              className="bl-nodata-label bl-btn-external"
              href={manga.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={13} />
              Đọc ở nguồn gốc
            </a>
          ) : (
            <span className="bl-nodata-label">Chưa có dữ liệu</span>
          )}
        </div>
      </div>
    </div>
  );
});

export const BLMangaPage: React.FC = () => {
  const navigate = useNavigate();
  const [mangaList, setMangaList] = useState<BLManga[]>([]);
  const [hotData, setHotData] = useState<HotMangaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<MainTab>('all');
  const [rankingType, setRankingType] = useState<RankingType>('hot');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, any>>({});
  
  // Progressive batching count
  // Số thẻ đã mở giữ theo phiên: quay lại từ trang chi tiết không phải cuộn lại từ đầu.
  const [localReaderOpen, setLocalReaderOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(
    () => Number(sessionStorage.getItem('daily_count_bl-list') ?? BATCH_SIZE) || BATCH_SIZE,
  );

  useEffect(() => {
    sessionStorage.setItem('daily_count_bl-list', String(visibleCount));
  }, [visibleCount]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Quick Reader modal state
  const [readingState, setReadingState] = useState<{ manga: BLManga; chapterNum: number } | null>(null);
  const [showRecentModal, setShowRecentModal] = useState<boolean>(false);

  const recentCrawledStories = useMemo(() => {
    const customList = getCustomBLMangaList();
    const map = new Map<string, BLManga>();
    for (const m of customList) map.set(m.slug, m);
    for (const m of mangaList) {
      if (m.updatedAt && !map.has(m.slug)) map.set(m.slug, m);
    }
    return Array.from(map.values());
  }, [mangaList]);

  const loadData = async () => {
    try {
      const [list, hot] = await Promise.all([
        fetchBLMangaList(),
        fetchHotMangaData(),
      ]);

      if (list && list.length > 0) {
        setMangaList(list);
      }
      if (hot) {
        setHotData(hot);
      }
    } catch (err) {
      console.error('Failed to load BL manga list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setFavorites(getFavorites());
    setHistory(getReadingHistory());

    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, []);

  useScrollRestore('bl-list', mangaList.length > 0);

  // Reset pagination on tab/search/source change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [activeTab, rankingType, searchQuery, sourceFilter]);

  const handleToggleFav = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    toggleFavorite(slug);
    setFavorites(getFavorites());
  };

  // Map slug to full manga details
  const mangaMap = useMemo(() => {
    return new Map(mangaList.map(m => [m.slug, m]));
  }, [mangaList]);

  // Counts by source
  const sanyCount = useMemo(() => {
    return mangaList.filter(m => m.source === 'teamsany' || m.sourceName === 'Sany Team').length;
  }, [mangaList]);

  const dualeoCount = useMemo(() => {
    return mangaList.filter(m => m.source !== 'teamsany' && m.sourceName !== 'Sany Team').length;
  }, [mangaList]);

  // Filtered and Sorted list according to tab and source
  const filteredList = useMemo(() => {
    let result: { manga: BLManga; rank?: number; rankType?: string }[] = [];

    if (activeTab === 'ranking') {
      if (rankingType === 'hot') {
        if (hotData?.hot && hotData.hot.length > 0) {
          result = hotData.hot.map(h => ({
            manga: mangaMap.get(h.slug) || {
              slug: h.slug,
              title: h.title,
              cover: h.cover,
              description: '',
              genres: ['BoyLove'],
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
              genres: ['BoyLove'],
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
              genres: ['BoyLove'],
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
              genres: ['BoyLove'],
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

    // Source Filter
    if (sourceFilter === 'teamsany') {
      result = result.filter(item => item.manga.source === 'teamsany' || item.manga.sourceName === 'Sany Team');
    } else if (sourceFilter === 'dualeo') {
      result = result.filter(item => item.manga.source !== 'teamsany' && item.manga.sourceName !== 'Sany Team');
    }

    // Search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        const titleMatch = item.manga.title.toLowerCase().includes(q);
        const authorMatch = item.manga.author ? item.manga.author.toLowerCase().includes(q) : false;
        const genreMatch = item.manga.genres ? item.manga.genres.some(g => g.toLowerCase().includes(q)) : false;
        return titleMatch || authorMatch || genreMatch;
      });
    }

    return result;
  }, [mangaList, mangaMap, hotData, activeTab, rankingType, sourceFilter, favorites, history, searchQuery]);

  // Paginated visible list for performance
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

  const openReader = (manga: BLManga, chapterNum: number) => {
    setReadingState({ manga, chapterNum });
    setHistory(getReadingHistory());
  };

  /** Truyện đang đọc dở gần nhất — thẻ "Đọc tiếp" ở đầu trang. */
  const continueReading = useMemo(() => {
    const entries = Object.values(history) as Array<{ slug: string; chapterNumber: number; chapterName?: string; readAt?: string }>
    const latest = entries
      .filter((h) => h?.slug && mangaMap.has(h.slug))
      .sort((a, b) => (b.readAt ?? '').localeCompare(a.readAt ?? ''))[0]
    return latest ? { progress: latest, manga: mangaMap.get(latest.slug)! } : null;
  }, [history, mangaMap]);

  // Top 6 Spotlight items
  const spotlightItems = useMemo(() => {
    if (hotData?.hot && hotData.hot.length > 0) {
      return hotData.hot.slice(0, 6).map(h => mangaMap.get(h.slug) || {
        slug: h.slug,
        title: h.title,
        cover: h.cover,
        description: '',
        genres: ['BoyLove'],
        url: h.url,
        chapters: [],
        totalChapters: 0,
        hotRank: h.rank,
      });
    }
    return mangaList.filter(m => m.hotRank != null || m.isHot).slice(0, 6);
  }, [hotData, mangaMap, mangaList]);

  if (localReaderOpen) return <LocalCbzReader onClose={() => setLocalReaderOpen(false)} />;

  return (
    <div className="bl-page-container">
      <RecentCrawledModal
        isOpen={showRecentModal}
        onClose={() => setShowRecentModal(false)}
        title="Truyện Boylove đã cào gần đây"
        items={recentCrawledStories}
        onSelectStory={(story) => navigate(`/bl/${story.slug}`)}
        accentColor="#3b82f6"
      />

      {continueReading && (
        <button
          type="button"
          className="continue-reading"
          onClick={() => openReader(continueReading.manga, continueReading.progress.chapterNumber)}
        >
          {continueReading.manga.cover && (
            <img className="continue-reading-cover" src={continueReading.manga.cover} alt="" loading="lazy" />
          )}
          <span className="continue-reading-body">
            <span className="continue-reading-label">▶ Đọc tiếp</span>
            <span className="continue-reading-title">{continueReading.manga.title}</span>
            <span className="continue-reading-sub">
              {continueReading.progress.chapterName || `Chương ${continueReading.progress.chapterNumber}`}
            </span>
          </span>
        </button>
      )}
      {/* Top Header & Main Navigation Bar */}
      <div className="bl-top-nav-bar">
        <div className="bl-nav-tabs">
          <button
            className={`bl-nav-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <BookOpen size={16} /> Tất cả <span className="bl-count-pill">{mangaList.length}</span>
          </button>

          <button className="bl-nav-tab-btn" onClick={() => setLocalReaderOpen(true)} title="Mở file .cbz trên máy">
            <FolderOpen size={16} /> Đọc file CBZ
          </button>
          
          <button
            className={`bl-nav-tab-btn ${activeTab === 'ranking' ? 'active' : ''}`}
            onClick={() => setActiveTab('ranking')}
            style={activeTab === 'ranking' ? { color: '#ef4444' } : {}}
          >
            <Flame size={16} color={activeTab === 'ranking' ? '#ef4444' : 'currentColor'} /> Bảng Xếp Hạng
          </button>

          <button
            className={`bl-nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} /> Đang đọc <span className="bl-count-pill">{Object.keys(history).length}</span>
          </button>

          <button
            className={`bl-nav-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <Heart size={16} /> Yêu thích <span className="bl-count-pill">{favorites.length}</span>
          </button>

          {/* Button Vừa cào gần đây */}
          <button
            type="button"
            className="bl-nav-tab-btn"
            onClick={() => setShowRecentModal(true)}
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontWeight: 600,
            }}
            title="Xem danh sách truyện đã cào gần đây (trong 1h trước hoặc tất cả)"
          >
            <Zap size={15} /> Vừa cào gần đây
            {recentCrawledStories.length > 0 && (
              <span className="bl-count-pill" style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)', color: '#dbeafe' }}>
                {recentCrawledStories.length}
              </span>
            )}
          </button>
        </div>

        <div className="bl-search-wrapper">
          <Search size={16} className="bl-search-icon" />
          <input
            type="text"
            placeholder={`Tìm kiếm trong ${mangaList.length || 'kho'} bộ truyện BL...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bl-search-input"
          />
          {searchQuery && (
            <button className="bl-search-clear" onClick={() => setSearchQuery('')}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Source Filter Tabs: All, Sany Team, DuaLeo */}
      <div className="bl-source-filter-bar">
        <span className="bl-source-filter-label">
          <Layers size={14} /> Nguồn:
        </span>
        <button
          className={`bl-source-pill ${sourceFilter === 'all' ? 'active' : ''}`}
          onClick={() => setSourceFilter('all')}
        >
          Tất cả ({mangaList.length})
        </button>
        <button
          className={`bl-source-pill is-sany ${sourceFilter === 'teamsany' ? 'active' : ''}`}
          onClick={() => setSourceFilter('teamsany')}
        >
          ✨ Sany Team ({sanyCount})
        </button>
        <button
          className={`bl-source-pill ${sourceFilter === 'dualeo' ? 'active' : ''}`}
          onClick={() => setSourceFilter('dualeo')}
        >
          Dưa Leo ({dualeoCount})
        </button>
      </div>

      {/* Sub-chips for Ranking when Bảng Xếp Hạng is selected */}
      {activeTab === 'ranking' && (
        <div className="bl-ranking-subtabs">
          <button
            className={`bl-ranking-chip ${rankingType === 'hot' ? 'active' : ''}`}
            onClick={() => setRankingType('hot')}
          >
            <Flame size={14} /> Hot Nhất ({hotData?.hot?.length ?? 38})
          </button>
          <button
            className={`bl-ranking-chip ${rankingType === 'top_day' ? 'active' : ''}`}
            onClick={() => setRankingType('top_day')}
          >
            <Zap size={14} /> Top Hôm Nay ({hotData?.top_day?.length ?? 36})
          </button>
          <button
            className={`bl-ranking-chip ${rankingType === 'top_week' ? 'active' : ''}`}
            onClick={() => setRankingType('top_week')}
          >
            <Calendar size={14} /> Top Tuần Này ({hotData?.top_week?.length ?? 36})
          </button>
          <button
            className={`bl-ranking-chip ${rankingType === 'top_month' ? 'active' : ''}`}
            onClick={() => setRankingType('top_month')}
          >
            <Trophy size={14} /> Top Tháng Này ({hotData?.top_month?.length ?? 37})
          </button>
        </div>
      )}

      {/* Top 6 Hot Spotlight Carousel */}
      {activeTab === 'all' && !searchQuery && sourceFilter === 'all' && spotlightItems.length > 0 && (
        <div className="bl-spotlight-section">
          <div className="bl-spotlight-head">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#f59e0b" /> Thịnh hành nhất tuần qua
            </span>
            <button 
              className="bl-spotlight-more"
              onClick={() => {
                setActiveTab('ranking');
                setRankingType('hot');
              }}
            >
              Xem bảng xếp hạng <ChevronRight size={14} />
            </button>
          </div>
          <div className="bl-spotlight-list">
            {spotlightItems.map((manga, idx) => (
              <div
                key={`spotlight-${manga.slug}`}
                className="bl-spotlight-card"
                onClick={() => navigate(`/bl/${manga.slug}`)}
              >
                <div className={`bl-rank-badge rank-${idx + 1 <= 3 ? idx + 1 : 'other'}`}>
                  {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                </div>
                {manga.cover ? (
                  <img 
                    src={manga.cover} 
                    alt={manga.title} 
                    className="bl-spotlight-cover" 
                    loading="lazy" 
                    decoding="async" 
                  />
                ) : (
                  <div className="bl-cover-placeholder" style={{ height: 200 }}>
                    <BookOpen size={24} />
                  </div>
                )}
                <div className="bl-spotlight-info">
                  <span className="bl-spotlight-title">{manga.title}</span>
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
        <div className="bl-loading-box">
          <div className="bl-spinner" />
          <p>Đang tải danh sách truyện BL...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bl-empty-state">
          <Bookmark size={40} className="bl-empty-icon" />
          <h3>Không tìm thấy truyện phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác hoặc chuyển sang nguồn khác.</p>
        </div>
      ) : (
        <>
          <div className="bl-manga-grid">
            {visibleItems.map(({ manga, rank }) => {
              const isFav = favorites.includes(manga.slug);
              const userProgress = history[manga.slug];

              return (
                <BLMangaCardItem
                  key={manga.slug}
                  manga={manga}
                  rank={rank}
                  isFav={isFav}
                  userProgress={userProgress}
                  onToggleFav={handleToggleFav}
                  onOpenReader={openReader}
                  onClick={() => navigate(`/bl/${manga.slug}`)}
                />
              );
            })}
          </div>

          {/* Load More & Infinite Scroll Sentinel */}
          {visibleCount < filteredList.length && (
            <div className="bl-pagination-footer">
              <div ref={sentinelRef} style={{ height: 10 }} />
              <button
                className="bl-btn-load-more"
                onClick={() => setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredList.length))}
              >
                <Loader2 size={16} className="bl-spin-icon" />
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
        <BLReaderModal
          manga={readingState.manga}
          initialChapterNum={readingState.chapterNum}
          onClose={() => {
            setReadingState(null);
            setHistory(getReadingHistory());
          }}
        />
      )}
    </div>
  );
};
