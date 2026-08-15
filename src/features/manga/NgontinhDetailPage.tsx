import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Play, BookOpen, Clock, 
  Search, ArrowUpDown, ChevronRight,
  CheckCircle2, Flame, Bookmark,
  Tag, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import type { NgontinhManga } from '../../types/manga';
import { 
  fetchNgontinhList, fetchNgontinhHotData, 
  getNgontinhFavorites, toggleNgontinhFavorite, 
  getNgontinhHistory 
} from './ngontinhService';
import './ngontinhDetail.css';

const CHAPTERS_PER_PAGE = 50;

export const NgontinhDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [manga, setManga] = useState<NgontinhManga | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, any>>({});
  const [showGenres, setShowGenres] = useState<boolean>(false);
  
  // Chapter filter, sort, and range pagination
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const loadMangaDetail = async () => {
      setLoading(true);
      try {
        const [list, hot] = await Promise.all([
          fetchNgontinhList(),
          fetchNgontinhHotData(),
        ]);

        if (isMounted && slug) {
          const found = list.find((m) => m.slug === slug);
          if (found) {
            // Merge hot ranking if available
            if (hot?.hot) {
              const hotItem = hot.hot.find(h => h.slug === slug);
              if (hotItem) {
                found.isHot = true;
                found.hotRank = hotItem.rank;
              }
            }
            if (hot?.top_day) {
              const td = hot.top_day.find(h => h.slug === slug);
              if (td) found.topDayRank = td.rank;
            }
            if (hot?.top_week) {
              const tw = hot.top_week.find(h => h.slug === slug);
              if (tw) found.topWeekRank = tw.rank;
            }
            if (hot?.top_month) {
              const tm = hot.top_month.find(h => h.slug === slug);
              if (tm) found.topMonthRank = tm.rank;
            }
            setManga(found);
          }
        }
      } catch (err) {
        console.error('Failed to load Ngôn Tình manga detail', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMangaDetail();
    setFavorites(getNgontinhFavorites());
    setHistory(getNgontinhHistory());

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const isFav = slug ? favorites.includes(slug) : false;
  const userProgress = slug ? history[slug] : null;

  const handleToggleFav = () => {
    if (!slug) return;
    toggleNgontinhFavorite(slug);
    setFavorites(getNgontinhFavorites());
  };

  // Range tabs calculation
  const totalChaptersCount = manga?.chapters?.length || 0;
  const totalRanges = Math.ceil(totalChaptersCount / CHAPTERS_PER_PAGE);

  const rangeTabs = useMemo(() => {
    const tabs: { label: string; start: number; end: number }[] = [];
    for (let i = 0; i < totalRanges; i++) {
      const start = i * CHAPTERS_PER_PAGE + 1;
      const end = Math.min((i + 1) * CHAPTERS_PER_PAGE, totalChaptersCount);
      tabs.push({ label: `${start} - ${end}`, start, end });
    }
    return tabs;
  }, [totalRanges, totalChaptersCount]);

  // Filter and sort chapters
  const displayedChapters = useMemo(() => {
    if (!manga || !manga.chapters) return [];
    
    let list = [...manga.chapters];
    
    // Sort
    list.sort((a, b) => {
      const numA = a.number ?? 0;
      const numB = b.number ?? 0;
      return sortAsc ? numA - numB : numB - numA;
    });

    // Search filter
    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase().trim();
      list = list.filter(ch => 
        (ch.name && ch.name.toLowerCase().includes(q)) ||
        (ch.number != null && ch.number.toString().includes(q))
      );
    } else if (rangeTabs.length > 1) {
      // Range filter
      const currentTab = rangeTabs[selectedRangeIndex];
      if (currentTab) {
        list = list.slice(selectedRangeIndex * CHAPTERS_PER_PAGE, (selectedRangeIndex + 1) * CHAPTERS_PER_PAGE);
      }
    }

    return list;
  }, [manga, sortAsc, chapterSearch, rangeTabs, selectedRangeIndex]);

  const firstChapterNum = useMemo(() => {
    if (!manga || !manga.chapters.length) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga]);

  // Navigate to reader router
  const handleStartRead = () => {
    if (!slug) return;
    const targetChapter = userProgress?.chapterNumber ?? firstChapterNum;
    navigate(`/ngontinh/${slug}/read/${targetChapter}`);
  };

  const handleReadChapter = (chNum: number) => {
    if (!slug) return;
    navigate(`/ngontinh/${slug}/read/${chNum}`);
  };

  if (loading) {
    return (
      <div className="ngontinh-detail-page">
        <div className="ngontinh-detail-loading">
          <div className="ngontinh-spinner" />
          <p>Đang tải thông tin truyện...</p>
        </div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="ngontinh-detail-page">
        <div className="ngontinh-detail-empty">
          <Bookmark size={48} className="ngontinh-empty-icon" />
          <h2>Không tìm thấy bộ truyện</h2>
          <p>Truyện có thể đã được cập nhật hoặc không tồn tại.</p>
          <button className="ngontinh-nav-back-btn" onClick={() => navigate('/ngontinh')}>
            <ArrowLeft size={16} /> Quay lại danh sách truyện Ngôn Tình
          </button>
        </div>
      </div>
    );
  }

  // Reading progress percentage
  const readPercent = userProgress && manga.totalChapters
    ? Math.min(Math.round((userProgress.chapterNumber / manga.totalChapters) * 100), 100)
    : 0;

  return (
    <div className="ngontinh-detail-page">
      {/* Top Header Navigation */}
      <div className="ngontinh-detail-top-nav">
        <button className="ngontinh-nav-back-btn" onClick={() => navigate('/ngontinh')}>
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

        <div className="ngontinh-nav-breadcrumbs">
          <Link to="/ngontinh">Truyện Ngôn Tình</Link>
          <ChevronRight size={14} />
          <span className="ngontinh-nav-current-title">{manga.title}</span>
        </div>

        <button 
          className={`ngontinh-nav-fav-btn ${isFav ? 'favorited' : ''}`}
          onClick={handleToggleFav}
          title={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
        >
          <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
          <span>{isFav ? 'Đã thích' : 'Yêu thích'}</span>
        </button>
      </div>

      {/* Hero Showcase Section */}
      <div className="ngontinh-hero-container">
        {/* Blurred dynamic backdrop */}
        {manga.cover && (
          <div 
            className="ngontinh-hero-backdrop" 
            style={{ backgroundImage: `url(${manga.cover})` }} 
          />
        )}
        <div className="ngontinh-hero-backdrop-overlay" />

        <div className="ngontinh-hero-content">
          {/* Poster Box */}
          <div className="ngontinh-poster-wrap">
            {manga.cover ? (
              <img 
                src={manga.cover} 
                alt={manga.title} 
                className="ngontinh-poster-img" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="ngontinh-poster-placeholder">
                <BookOpen size={48} />
              </div>
            )}

            {manga.hotRank != null && (
              <div className={`ngontinh-rank-badge rank-${manga.hotRank <= 3 ? manga.hotRank : 'other'}`}>
                {manga.hotRank === 1 ? '🥇 #1 HOT' : manga.hotRank === 2 ? '🥈 #2 HOT' : manga.hotRank === 3 ? '🥉 #3 HOT' : `#${manga.hotRank} HOT`}
              </div>
            )}
            {!manga.hotRank && manga.isHot && (
              <div className="ngontinh-hot-tag">🔥 HOT</div>
            )}
          </div>

          {/* Details Meta */}
          <div className="ngontinh-hero-meta">
            <h1 className="ngontinh-hero-title">{manga.title}</h1>

            <div className="ngontinh-hero-badges-row">
              <span className="ngontinh-badge-pill highlight">
                <BookOpen size={14} /> {manga.totalChapters || manga.chapters.length} Chapters
              </span>

              {manga.isHot && (
                <span className="ngontinh-badge-pill hot">
                  <Flame size={14} /> Thịnh hành
                </span>
              )}

              {manga.status && (
                <span className="ngontinh-badge-pill">
                  {manga.status}
                </span>
              )}
            </div>

            {/* Reading progress bar */}
            {userProgress && (
              <div className="ngontinh-progress-box">
                <div className="ngontinh-progress-info">
                  <span>Đang đọc: Chapter {userProgress.chapterNumber}</span>
                  <span>{readPercent}%</span>
                </div>
                <div className="ngontinh-progress-bar-bg">
                  <div className="ngontinh-progress-bar-fill" style={{ width: `${readPercent}%` }} />
                </div>
              </div>
            )}

            {/* Genres Collapsible Toggle */}
            {manga.genres && manga.genres.length > 0 && (
              <div className="ngontinh-genres-wrapper">
                <button
                  type="button"
                  className={`ngontinh-btn-toggle-genres ${showGenres ? 'active' : ''}`}
                  onClick={() => setShowGenres(!showGenres)}
                >
                  <Tag size={13} />
                  <span>Thể loại ({manga.genres.length})</span>
                  {showGenres ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {showGenres && (
                  <div className="ngontinh-genres-list">
                    {manga.genres.map((genre) => (
                      <span key={genre} className="ngontinh-genre-tag">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA Read Buttons */}
            <div className="ngontinh-hero-actions">
              <button 
                className="ngontinh-btn-read-hero"
                onClick={handleStartRead}
              >
                <Play size={18} fill="currentColor" />
                <span>{userProgress ? `Đọc tiếp Chapter ${userProgress.chapterNumber}` : 'Bắt đầu đọc Chapter 1'}</span>
              </button>

              <a 
                href={manga.url} 
                target="_blank" 
                rel="noreferrer" 
                className="ngontinh-btn-ext-source"
              >
                <ExternalLink size={16} /> Nguồn NetTruyen
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Description / Synopsis Box */}
      {manga.description && (
        <div className="ngontinh-synopsis-box">
          <div className="ngontinh-synopsis-head">
            <BookOpen size={16} color="#e11d48" /> Tóm tắt nội dung
          </div>
          <p className="ngontinh-synopsis-text">{manga.description}</p>
        </div>
      )}

      {/* Chapters Section */}
      <div className="ngontinh-chapters-section">
        <div className="ngontinh-chapters-toolbar">
          <span className="ngontinh-chapters-count-label">
            Danh sách chương ({manga.chapters.length})
          </span>

          <div className="ngontinh-chapters-filters">
            {/* Search chapter */}
            <div className="ngontinh-ch-search-wrap">
              <Search size={14} className="ngontinh-ch-search-icon" />
              <input
                type="text"
                placeholder="Tìm số chap..."
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                className="ngontinh-ch-search-input"
              />
            </div>

            {/* Sort order toggle */}
            <button 
              className="ngontinh-btn-sort"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? 'Mới nhất trước' : 'Cũ nhất trước'}
            >
              <ArrowUpDown size={14} />
              <span>{sortAsc ? '1 → N' : 'N → 1'}</span>
            </button>
          </div>
        </div>

        {/* Range Tabs if series is long (> 50 chapters) and no search query */}
        {!chapterSearch && rangeTabs.length > 1 && (
          <div className="ngontinh-range-tabs">
            {rangeTabs.map((tab, idx) => (
              <button
                key={tab.label}
                className={`ngontinh-range-btn ${selectedRangeIndex === idx ? 'active' : ''}`}
                onClick={() => setSelectedRangeIndex(idx)}
              >
                Chương {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Chapters Grid */}
        <div className="ngontinh-chapters-grid">
          {displayedChapters.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', gridColumn: '1 / -1' }}>
              Không tìm thấy chương nào
            </div>
          ) : (
            displayedChapters.map((ch) => {
              const chNum = ch.number ?? 1;
              const isCurrentlyReading = userProgress?.chapterNumber === chNum;

              return (
                <button
                  key={ch.url || `ch-${chNum}`}
                  className={`ngontinh-ch-card ${isCurrentlyReading ? 'reading' : ''}`}
                  onClick={() => handleReadChapter(chNum)}
                >
                  <div className="ngontinh-ch-info">
                    <span className="ngontinh-ch-title">
                      {ch.name || `Chapter ${chNum}`}
                    </span>
                    {isCurrentlyReading && (
                      <span className="ngontinh-ch-reading-tag">
                        <CheckCircle2 size={12} /> Đang đọc
                      </span>
                    )}
                  </div>
                  <ChevronRight size={16} className="ngontinh-ch-arrow" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
