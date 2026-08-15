import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Play, BookOpen, Clock, 
  Search, ArrowUpDown, ChevronRight,
  CheckCircle2, Sparkles, Flame, Trophy, Zap, Bookmark,
  Tag, ChevronDown, ChevronUp, User, Palette, Layers, Info,
  ExternalLink, AlertCircle
} from 'lucide-react';
import type { BLManga, MangaChapter } from '../../types/manga';
import { 
  fetchBLMangaList, fetchHotMangaData, 
  getFavorites, toggleFavorite, 
  getReadingHistory, hasMangaData
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
        console.error('Failed to load BL manga detail', err);
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

  const isFav = useMemo(() => {
    return manga ? favorites.includes(manga.slug) : false;
  }, [favorites, manga]);

  const userProgress = useMemo(() => {
    return manga ? history[manga.slug] : null;
  }, [history, manga]);

  const handleToggleFav = () => {
    if (!manga) return;
    toggleFavorite(manga.slug);
    setFavorites(getFavorites());
  };

  // Chapter sorting & filtering
  const displayedChapters = useMemo(() => {
    if (!manga?.chapters) return [];
    let list = [...manga.chapters];

    // Filter by search
    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase().trim();
      list = list.filter((ch) => {
        const nameMatch = ch.name?.toLowerCase().includes(q);
        const numMatch = ch.number != null && ch.number.toString().includes(q);
        return nameMatch || numMatch;
      });
    }

    // Sort
    list.sort((a, b) => {
      const numA = a.number ?? 0;
      const numB = b.number ?? 0;
      return sortAsc ? numA - numB : numB - numA;
    });

    return list;
  }, [manga?.chapters, chapterSearch, sortAsc]);

  const firstChapterNum = useMemo(() => {
    if (!manga?.chapters || manga.chapters.length === 0) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga?.chapters]);

  const handleStartRead = () => {
    if (userProgress?.chapterNumber != null) {
      setReadingChapterNum(userProgress.chapterNumber);
    } else {
      setReadingChapterNum(firstChapterNum);
    }
  };

  if (loading) {
    return (
      <div className="bl-detail-loading">
        <div className="bl-detail-spinner" />
        <p>Đang tải thông tin truyện...</p>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="bl-detail-page">
        <div className="bl-detail-notfound">
          <h2>Không tìm thấy truyện</h2>
          <p>Truyện có thể đã được cập nhật hoặc không tồn tại.</p>
          <button className="bl-btn-back-home" onClick={() => navigate('/bl')}>
            <ArrowLeft size={16} /> Quay lại danh sách truyện BL
          </button>
        </div>
      </div>
    );
  }

  const isSanyTeam = manga.source === 'teamsany' || manga.sourceName === 'Sany Team';
  const hasData = hasMangaData(manga);
  const sourceName = manga.sourceName || (isSanyTeam ? 'Sany Team' : 'Dưa Leo');

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

            {isSanyTeam && (
              <div className="bl-sany-source-tag-detail">
                ✨ Sany Team
              </div>
            )}
          </div>

          {/* Details Meta */}
          <div className="bl-hero-meta">
            <h1 className="bl-hero-title">{manga.title}</h1>

            {/* Badges Row */}
            <div className="bl-hero-badges-row">
              {hasData ? (
                <span className="bl-badge-pill highlight">
                  <BookOpen size={14} /> {manga.totalChapters || manga.chapters.length} Chapters
                </span>
              ) : (
                <span className="bl-badge-pill no-data">
                  <AlertCircle size={14} /> Chưa có dữ liệu ảnh
                </span>
              )}

              <span className="bl-badge-pill source-badge">
                <Layers size={14} /> Nguồn: {sourceName}
              </span>

              {manga.status && (
                <span className="bl-badge-pill status-badge">
                  <CheckCircle2 size={14} /> {manga.status}
                </span>
              )}

              {userProgress && (
                <span className="bl-badge-pill reading">
                  <Clock size={14} /> Đang đọc: Chapter {userProgress.chapterNumber}
                </span>
              )}

              {manga.topDayRank != null && (
                <span className="bl-badge-pill top-day">
                  <Zap size={14} /> Top {manga.topDayRank} Ngày
                </span>
              )}

              {manga.topWeekRank != null && (
                <span className="bl-badge-pill top-week">
                  <Trophy size={14} /> Top {manga.topWeekRank} Tuần
                </span>
              )}
            </div>

            {/* Author / Artist Meta */}
            {(manga.author || manga.artist || manga.type) && (
              <div className="bl-author-meta-row">
                {manga.author && (
                  <span className="bl-author-chip">
                    <User size={13} /> <strong>Tác giả:</strong> {manga.author}
                  </span>
                )}
                {manga.artist && (
                  <span className="bl-author-chip">
                    <Palette size={13} /> <strong>Họa sĩ:</strong> {manga.artist}
                  </span>
                )}
                {manga.type && (
                  <span className="bl-author-chip">
                    <Info size={13} /> <strong>Loại:</strong> {manga.type}
                  </span>
                )}
              </div>
            )}

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
              {hasData ? (
                <button className="bl-btn-read-main" onClick={handleStartRead}>
                  <Play size={18} fill="currentColor" />
                  <span>
                    {userProgress 
                      ? `Đọc tiếp Chapter ${userProgress.chapterNumber}` 
                      : `Bắt đầu đọc Chapter ${firstChapterNum}`}
                  </span>
                </button>
              ) : (
                <span className="bl-nodata-detail-badge">
                  <AlertCircle size={15} /> Chưa có dữ liệu đọc
                </span>
              )}

              {manga.url && (
                <a 
                  href={manga.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bl-btn-source-link"
                >
                  <ExternalLink size={16} />
                  <span>Mở trên {sourceName}</span>
                </a>
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

      {/* Main Body */}
      <div className="bl-detail-body">
        {/* No-data notice banner */}
        {!hasData && (
          <div className="bl-nodata-notice-banner">
            <AlertCircle size={20} className="bl-notice-icon" />
            <div className="bl-notice-text">
              <strong>Chưa có dữ liệu ảnh trong bộ nhớ đệm:</strong>
              <span>Bộ truyện này hiện chưa có sẵn ảnh các chapter trên hệ thống. Bạn có thể bấm vào từng chương để mở đọc trực tiếp trên trang {sourceName}.</span>
            </div>
            {manga.url && (
              <a 
                href={manga.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bl-notice-btn"
              >
                Đọc trên {sourceName} <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}

        {/* Description Section if available */}
        {manga.description && (
          <div className="bl-section-card">
            <h3 className="bl-section-heading">
              <BookOpen size={18} color="#6366f1" /> Giới thiệu nội dung
            </h3>
            <p className="bl-synopsis-text">{manga.description}</p>
          </div>
        )}

        {/* Chapters Section */}
        <section className="bl-section-card">
          <div className="bl-chapters-header">
            <div className="bl-chapters-title-group">
              <h3 className="bl-section-heading" style={{ margin: 0 }}>
                Danh sách chương
              </h3>
              <span className="bl-chapters-count-badge">
                {manga.chapters.length} chương
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
                <span>{sortAsc ? 'Cũ nhất' : 'Mới nhất'}</span>
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
                const chNum = ch.number ?? (idx + 1);
                const isCurrentlyReading = userProgress?.chapterNumber === chNum;
                const hasChImages = Boolean((ch.images && ch.images.length > 0) || (ch.imageCount && ch.imageCount > 0));

                return (
                  <button
                    key={ch.url || `ch-${idx}`}
                    className={`bl-ch-card ${isCurrentlyReading ? 'reading' : ''} ${!hasChImages ? 'no-images' : ''}`}
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
                      {!hasChImages && !isCurrentlyReading && (
                        <span className="bl-ch-noimg-tag">
                          Chưa có ảnh
                        </span>
                      )}
                    </div>
                    {hasChImages ? (
                      <span className="bl-ch-count">{ch.imageCount || ch.images?.length} ảnh</span>
                    ) : (
                      <ExternalLink size={13} className="bl-ch-ext-icon" />
                    )}
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
          onSelectChapter={(nextNum) => setReadingChapterNum(nextNum)}
        />
      )}
    </div>
  );
};
