import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Play, BookOpen, Clock, 
  Search, ArrowUpDown, ChevronRight, Share2, 
  CheckCircle2, Sparkles, Flame, Trophy, Zap, Bookmark,
  Tag, ChevronDown, ChevronUp
} from 'lucide-react';
import type { BLManga, MangaChapter } from '../../types/manga';
import { 
  fetchBLMangaList, fetchHotMangaData, 
  getFavorites, toggleFavorite, 
  getReadingHistory 
} from './mangaService';
import { BLReaderModal } from './BLReaderModal';
import './blMangaDetail.css';

export const BLMangaDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [manga, setManga] = useState<BLManga | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, any>>({});
  const [showGenres, setShowGenres] = useState<boolean>(false);
  
  // Chapter filter and sort
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  
  // Reader Modal state
  const [readingChapterNum, setReadingChapterNum] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadMangaDetail = async () => {
      setLoading(true);
      try {
        const [list, hot] = await Promise.all([
          fetchBLMangaList(),
          fetchHotMangaData(),
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
        console.error('Failed to load manga detail', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMangaDetail();
    setFavorites(getFavorites());
    setHistory(getReadingHistory());

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const isFav = slug ? favorites.includes(slug) : false;
  const userProgress = slug ? history[slug] : null;

  const handleToggleFav = () => {
    if (!slug) return;
    toggleFavorite(slug);
    setFavorites(getFavorites());
  };

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
        (ch.title && ch.title.toLowerCase().includes(q)) || 
        (ch.name && ch.name.toLowerCase().includes(q)) ||
        (ch.number != null && ch.number.toString().includes(q))
      );
    }

    return list;
  }, [manga, sortAsc, chapterSearch]);

  const firstChapterNum = useMemo(() => {
    if (!manga || !manga.chapters.length) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga]);

  const handleStartRead = () => {
    const targetChapter = userProgress?.chapterNumber ?? firstChapterNum;
    setReadingChapterNum(targetChapter);
  };

  if (loading) {
    return (
      <div className="bl-detail-page">
        <div className="bl-detail-loading">
          <div className="bl-spinner" />
          <p>Đang tải thông tin truyện...</p>
        </div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="bl-detail-page">
        <div className="bl-detail-empty">
          <Bookmark size={48} className="bl-empty-icon" />
          <h2>Không tìm thấy bộ truyện</h2>
          <p>Truyện có thể đã được cập nhật hoặc không tồn tại.</p>
          <button className="bl-btn-back-home" onClick={() => navigate('/bl')}>
            <ArrowLeft size={16} /> Quay lại danh sách truyện BL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bl-detail-page">
      {/* Top Header Navigation */}
      <div className="bl-detail-top-nav">
        <button className="bl-nav-back-btn" onClick={() => navigate('/bl')}>
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

        <div className="bl-nav-breadcrumbs">
          <Link to="/bl">Truyện BL</Link>
          <ChevronRight size={14} />
          <span className="bl-nav-current-title">{manga.title}</span>
        </div>

        <button 
          className={`bl-nav-fav-btn ${isFav ? 'favorited' : ''}`}
          onClick={handleToggleFav}
          title={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
        >
          <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
          <span>{isFav ? 'Đã thích' : 'Yêu thích'}</span>
        </button>
      </div>

      {/* Hero Showcase Section */}
      <div className="bl-hero-container">
        {/* Blurred dynamic backdrop */}
        {manga.cover && (
          <div 
            className="bl-hero-backdrop" 
            style={{ backgroundImage: `url(${manga.cover})` }} 
          />
        )}
        <div className="bl-hero-backdrop-overlay" />

        <div className="bl-hero-content">
          {/* Poster Box */}
          <div className="bl-poster-wrap">
            {manga.cover ? (
              <img 
                src={manga.cover} 
                alt={manga.title} 
                className="bl-poster-img" 
              />
            ) : (
              <div className="bl-poster-placeholder">
                <BookOpen size={48} />
              </div>
            )}

            {manga.hotRank != null && (
              <div className={`bl-rank-badge rank-${manga.hotRank <= 3 ? manga.hotRank : 'other'}`}>
                {manga.hotRank === 1 ? '🥇 #1 HOT' : manga.hotRank === 2 ? '🥈 #2 HOT' : manga.hotRank === 3 ? '🥉 #3 HOT' : `#${manga.hotRank} HOT`}
              </div>
            )}
            {!manga.hotRank && manga.isHot && (
              <div className="bl-hot-tag">🔥 HOT</div>
            )}
          </div>

          {/* Details Meta */}
          <div className="bl-hero-meta">
            <h1 className="bl-hero-title">{manga.title}</h1>

            <div className="bl-hero-badges-row">
              <span className="bl-badge-pill highlight">
                <BookOpen size={14} /> {manga.totalChapters || manga.chapters.length} Chapters
              </span>

              {userProgress && (
                <span className="bl-badge-pill reading">
                  <Clock size={14} /> Đang đọc: Chapter {userProgress.chapterNumber}
                </span>
              )}

              {manga.isHot && (
                <span className="bl-badge-pill hot">
                  <Flame size={14} /> Thịnh hành
                </span>
              )}
            </div>

            {/* Genres Collapsible Toggle */}
            {manga.genres && manga.genres.length > 0 && (
              <div className="bl-genres-wrapper">
                <button
                  type="button"
                  className={`bl-btn-toggle-genres ${showGenres ? 'active' : ''}`}
                  onClick={() => setShowGenres(!showGenres)}
                >
                  <Tag size={13} />
                  <span>{showGenres ? 'Ẩn thể loại' : `Xem thể loại (${manga.genres.length})`}</span>
                  {showGenres ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {showGenres && (
                  <div className="bl-genres-list">
                    {manga.genres.map((g, idx) => (
                      <span key={idx} className="bl-genre-tag">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="bl-hero-actions">
              {manga.chapters && manga.chapters.length > 0 ? (
                <button className="bl-btn-read-main" onClick={handleStartRead}>
                  <Play size={18} fill="currentColor" />
                  <span>
                    {userProgress 
                      ? `Đọc tiếp Chapter ${userProgress.chapterNumber}` 
                      : `Bắt đầu đọc Chapter ${firstChapterNum}`}
                  </span>
                </button>
              ) : (
                <span className="bl-nodata-detail-badge">Chưa có dữ liệu chapter</span>
              )}

              <button 
                className={`bl-btn-fav-large ${isFav ? 'favorited' : ''}`}
                onClick={handleToggleFav}
              >
                <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
                <span>{isFav ? 'Đã yêu thích' : 'Thêm vào yêu thích'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body: Chapter List */}
      <div className="bl-detail-body">
        {/* Chapters Section */}
        <section className="bl-section-card">
          <div className="bl-chapters-header">
            <div className="bl-chapters-title-group">
              <h3 className="bl-section-heading" style={{ margin: 0 }}>
                Danh sách Chapter
              </h3>
              <span className="bl-chapters-count-badge">
                {manga.chapters.length} chapters
              </span>
            </div>

            {/* Chapter Toolbar: Search & Sort */}
            <div className="bl-chapters-toolbar">
              <div className="bl-ch-search">
                <Search size={14} />
                <input 
                  type="text" 
                  placeholder="Tìm số chapter..."
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                />
              </div>

              <button 
                className="bl-sort-btn"
                onClick={() => setSortAsc(!sortAsc)}
                title={sortAsc ? 'Đổi sang Mới nhất trước' : 'Đổi sang Cũ nhất trước'}
              >
                <ArrowUpDown size={14} />
                <span>{sortAsc ? 'Cũ nhất trước' : 'Mới nhất trước'}</span>
              </button>
            </div>
          </div>

          {/* Chapters Grid */}
          <div className="bl-chapters-grid">
            {displayedChapters.length === 0 ? (
              <div className="bl-no-chapters">
                <p>Không tìm thấy chapter phù hợp.</p>
              </div>
            ) : (
              displayedChapters.map((ch, idx) => {
                const chNum = ch.number ?? idx + 1;
                const isCurrentlyReading = userProgress?.chapterNumber === chNum;

                return (
                  <button
                    key={ch.url || `ch-${chNum}`}
                    className={`bl-ch-card ${isCurrentlyReading ? 'reading' : ''}`}
                    onClick={() => setReadingChapterNum(chNum)}
                  >
                    <div className="bl-ch-info">
                      <span className="bl-ch-title">
                        {ch.name || ch.title || `Chapter ${chNum}`}
                      </span>
                      {isCurrentlyReading && (
                        <span className="bl-ch-reading-tag">
                          <CheckCircle2 size={12} /> Đang đọc
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} className="bl-ch-arrow" />
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Reader Modal */}
      {readingChapterNum != null && (
        <BLReaderModal
          manga={manga}
          initialChapterNum={readingChapterNum}
          onClose={() => {
            setReadingChapterNum(null);
            setHistory(getReadingHistory());
          }}
        />
      )}
    </div>
  );
};
