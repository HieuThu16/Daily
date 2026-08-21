import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Play, BookOpen, Clock, 
  Search, ArrowUpDown, ChevronRight,
  CheckCircle2, Sparkles, Flame, Star, Users, Bookmark,
  Tag, ChevronDown, ChevronUp, ExternalLink, Share2, Check,
  Bell, X
} from 'lucide-react';
import type { MangaChapter } from '../../types/manga';
import type { HManga } from './hMangaService';
import { 
  fetchHMangaList,
  getHMangaFavorites, toggleHMangaFavorite, 
  getHMangaHistory,
  getHMangaFollows, toggleHMangaFollow
} from './hMangaService';
import { HMangaReaderModal } from './HMangaReaderModal';
import { useToast } from '../ToastContext';
import { useHideHeader } from '../HeaderAction';
import './ngontinhDetail.css';

export const HMangaDetailPage: React.FC = () => {
  useHideHeader(true);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [manga, setManga] = useState<HManga | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [follows, setFollows] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, any>>({});
  const [showAllTags, setShowAllTags] = useState<boolean>(false);
  const [isShareCopied, setIsShareCopied] = useState<boolean>(false);
  
  // Chapter filter and sort
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [showAllChapters, setShowAllChapters] = useState<boolean>(false);

  // Quick Webtoon Reader Modal
  const [readingChapterNum, setReadingChapterNum] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadMangaDetail = async () => {
      setLoading(true);
      try {
        const list = await fetchHMangaList();
        if (isMounted && slug) {
          const found = list.find((m) => m.slug === slug);
          if (found) {
            setManga(found);
          }
        }
      } catch (err) {
        console.error('Failed to load H manga detail', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMangaDetail();
    setFavorites(getHMangaFavorites());
    setFollows(getHMangaFollows());
    setHistory(getHMangaHistory());

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const isFav = slug ? favorites.includes(slug) : false;
  const isFollowed = slug ? follows.includes(slug) : false;
  const userProgress = slug ? history[slug] : null;

  const handleToggleFav = () => {
    if (!slug) return;
    const added = toggleHMangaFavorite(slug);
    setFavorites(getHMangaFavorites());
    showToast(added ? '❤️ Đã thêm vào danh sách Yêu thích!' : '💔 Đã bỏ khỏi danh sách Yêu thích');
  };

  const handleToggleFollow = () => {
    if (!slug) return;
    const added = toggleHMangaFollow(slug);
    setFollows(getHMangaFollows());
    showToast(added ? '🔔 Đang theo dõi truyện này! Sẽ nhận thông báo khi có chap mới' : '🔕 Đã hủy theo dõi truyện');
  };

  const handleShare = async () => {
    if (!manga) return;
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: manga.title,
          text: `Đọc truyện ${manga.title} cực hay!`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsShareCopied(true);
      showToast('📋 Đã sao chép link truyện vào bộ nhớ tạm!');
      setTimeout(() => setIsShareCopied(false), 2000);
    } catch {
      showToast('Không thể chia sẻ link');
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    if (!manga) return null;
    const totalCh = manga.chapters?.length || manga.totalChapters || 49;
    
    let hash = 0;
    for (let i = 0; i < (slug || '').length; i++) {
      hash = (hash << 5) - hash + (slug || '').charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    
    const viewsNum = ((absHash % 2400) / 10 + 35).toFixed(1);
    const ratingScore = (9.5 + (absHash % 5) / 10).toFixed(1);
    const reviewsNum = ((absHash % 42) / 10 + 1.8).toFixed(1);

    return {
      chapters: `${totalCh} Chapters`,
      views: `${viewsNum}K lượt xem`,
      rating: `${ratingScore}/10`,
      reviews: `${reviewsNum}K đánh giá`
    };
  }, [manga, slug]);

  // Tags list
  const tags = useMemo(() => {
    if (!manga) return [];
    return manga.genres && manga.genres.length > 0 ? manga.genres : ['18+', 'Hentai', 'Manhwa', 'Romance', 'Drama'];
  }, [manga]);

  // Chapter sorting & filtering
  const displayedChapters = useMemo(() => {
    if (!manga || !manga.chapters) return [];
    
    let list = [...manga.chapters];
    
    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase().trim();
      list = list.filter(ch => 
        (ch.name && ch.name.toLowerCase().includes(q)) ||
        (ch.number != null && ch.number.toString().includes(q))
      );
    }

    list.sort((a, b) => {
      const numA = a.number ?? 0;
      const numB = b.number ?? 0;
      return sortAsc ? numA - numB : numB - numA;
    });

    if (!showAllChapters && !chapterSearch.trim()) {
      return list.slice(0, 20);
    }

    return list;
  }, [manga, sortAsc, chapterSearch, showAllChapters]);

  const firstChapterNum = useMemo(() => {
    if (!manga || !manga.chapters.length) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga]);

  const handleStartRead = () => {
    const targetChapter = userProgress?.chapterNumber ?? firstChapterNum;
    setReadingChapterNum(targetChapter);
  };

  const handleReadChapter = (chNum: number) => {
    setReadingChapterNum(chNum);
  };

  if (loading) {
    return (
      <div className="ngontinh-detail-loading-screen">
        <div className="ngontinh-spinner" />
        <p>Đang tải thông tin truyện...</p>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="ngontinh-detail-container">
        <div className="ngontinh-detail-notfound-card">
          <h2>Không tìm thấy bộ truyện</h2>
          <p>Truyện có thể đã được cập nhật hoặc không tồn tại.</p>
          <button className="ngontinh-btn-back-home" onClick={() => navigate('/truyenh')}>
            <ArrowLeft size={16} /> Quay lại danh sách truyện H
          </button>
        </div>
      </div>
    );
  }

  const authorDisplay = manga.author || 'Đang cập nhật';
  const statusDisplay = manga.status || 'Đang tiến hành';

  return (
    <div className="ngontinh-detail-wrapper">
      {/* Top Header App Bar */}
      <header className="ngontinh-top-bar">
        <button 
          className="ngontinh-icon-btn" 
          onClick={() => navigate('/truyenh')}
          aria-label="Quay lại"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="ngontinh-top-bar-actions">
          <button 
            className={`ngontinh-icon-btn ${isFav ? 'active-fav' : ''}`}
            onClick={handleToggleFav}
            aria-label={isFav ? 'Bỏ thích' : 'Yêu thích'}
          >
            <Heart size={20} fill={isFav ? '#f43f5e' : 'none'} color={isFav ? '#f43f5e' : 'currentColor'} />
          </button>
        </div>
      </header>

      {/* Main Manga Showcase Card */}
      <section className="ngontinh-showcase-section">
        <div className="ngontinh-showcase-grid">
          {/* Left Poster Image */}
          <div className="ngontinh-poster-container">
            {manga.cover ? (
              <img 
                src={manga.cover} 
                alt={manga.title} 
                className="ngontinh-poster-image"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="ngontinh-poster-fallback">
                <BookOpen size={44} />
              </div>
            )}

            {/* Top Team Badge */}
            <div className="ngontinh-team-badge" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}>
              <Sparkles size={11} className="ngontinh-sparkle-icon" />
              <span>🔞 18+ MeTruyen18</span>
            </div>
          </div>

          {/* Right Manga Details */}
          <div className="ngontinh-showcase-details">
            {/* Title */}
            <h1 className="ngontinh-manga-title">{manga.title}</h1>

            {/* Author / Team with Verified Check */}
            <div className="ngontinh-author-row">
              <span className="ngontinh-author-name">{authorDisplay}</span>
              <span className="ngontinh-verified-badge" title="Đã xác thực">
                <CheckCircle2 size={15} fill="#f43f5e" color="#ffffff" />
              </span>
            </div>

            {/* 2x2 Stats Grid */}
            {stats && (
              <div className="ngontinh-stats-grid">
                <div className="ngontinh-stat-card">
                  <BookOpen size={14} className="ngontinh-stat-icon" />
                  <span>{stats.chapters}</span>
                </div>
                <div className="ngontinh-stat-card">
                  <Flame size={14} className="ngontinh-stat-icon ngontinh-fire" />
                  <span>{stats.views}</span>
                </div>
                <div className="ngontinh-stat-card">
                  <Star size={14} className="ngontinh-stat-icon ngontinh-star" />
                  <span>{stats.rating}</span>
                </div>
                <div className="ngontinh-stat-card">
                  <Users size={14} className="ngontinh-stat-icon ngontinh-users" />
                  <span>{stats.reviews}</span>
                </div>
              </div>
            )}

            {/* Status Pill */}
            <div className="ngontinh-status-row">
              <span className="ngontinh-status-pill">
                <span className="ngontinh-status-dot" />
                <span>{statusDisplay}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Big Primary Action CTA Button */}
      <div className="ngontinh-cta-container">
        <button className="ngontinh-primary-read-btn" onClick={handleStartRead}>
          <Play size={20} fill="currentColor" />
          <span>
            {userProgress 
              ? `Tiếp tục đọc Chapter ${userProgress.chapterNumber}` 
              : 'Đọc từ Chapter 1'}
          </span>
        </button>
      </div>

      {/* 5 Quick Actions Row */}
      <div className="ngontinh-quick-actions-row">
        {/* Action 1: Resume read */}
        <button className="ngontinh-quick-action-card" onClick={handleStartRead}>
          <Clock size={19} className="ngontinh-qa-icon" />
          <div className="ngontinh-qa-text">
            <span className="ngontinh-qa-title">Tiếp tục đọc</span>
            <span className="ngontinh-qa-subtitle">
              {userProgress ? `Chapter ${userProgress.chapterNumber}` : `Chapter ${firstChapterNum}`}
            </span>
          </div>
        </button>

        {/* Action 2: Toggle Synopsis & Genres */}
        <button 
          className={`ngontinh-quick-action-card ${showAllTags ? 'active-tab' : ''}`}
          onClick={() => setShowAllTags(!showAllTags)}
          title="Xem giới thiệu truyện và thể loại"
        >
          <BookOpen size={19} className="ngontinh-qa-icon ngontinh-icon-synopsis" />
          <div className="ngontinh-qa-text">
            <span className="ngontinh-qa-title">Giới thiệu</span>
            <span className="ngontinh-qa-subtitle">{showAllTags ? 'Đang mở' : 'Chi tiết'}</span>
          </div>
        </button>

        {/* Action 3: Open original source */}
        {manga.url ? (
          <a 
            href={manga.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="ngontinh-quick-action-card"
          >
            <ExternalLink size={19} className="ngontinh-qa-icon" />
            <div className="ngontinh-qa-text">
              <span className="ngontinh-qa-title">Mở trên</span>
              <span className="ngontinh-qa-subtitle">MeTruyen18</span>
            </div>
          </a>
        ) : (
          <div className="ngontinh-quick-action-card disabled">
            <ExternalLink size={19} className="ngontinh-qa-icon" />
            <div className="ngontinh-qa-text">
              <span className="ngontinh-qa-title">Nguồn</span>
              <span className="ngontinh-qa-subtitle">MeTruyen18</span>
            </div>
          </div>
        )}

        {/* Action 4: Toggle Favorite */}
        <button 
          className={`ngontinh-quick-action-card ${isFav ? 'favorited' : ''}`}
          onClick={handleToggleFav}
        >
          <Heart size={19} fill={isFav ? '#f43f5e' : 'none'} color={isFav ? '#f43f5e' : 'currentColor'} className="ngontinh-qa-icon" />
          <div className="ngontinh-qa-text">
            <span className="ngontinh-qa-title">{isFav ? 'Đã thích' : 'Yêu thích'}</span>
            <span className="ngontinh-qa-subtitle">{isFav ? 'Đã lưu' : 'Tủ truyện'}</span>
          </div>
        </button>

        {/* Action 5: Theo dõi */}
        <button
          className={`ngontinh-quick-action-card ${isFollowed ? 'favorited' : ''}`}
          onClick={handleToggleFollow}
          aria-pressed={isFollowed}
        >
          <Bell
            size={19}
            fill={isFollowed ? '#f43f5e' : 'none'}
            color={isFollowed ? '#f43f5e' : 'currentColor'}
            className="ngontinh-qa-icon"
          />
          <div className="ngontinh-qa-text">
            <span className="ngontinh-qa-title">{isFollowed ? 'Đang theo dõi' : 'Theo dõi'}</span>
            <span className="ngontinh-qa-subtitle">{isFollowed ? 'Báo chương mới' : 'Nhận báo mới'}</span>
          </div>
        </button>
      </div>

      {/* Collapsible Description & Genres Card */}
      {showAllTags && (
        <section className="ngontinh-content-card ngontinh-synopsis-card ngontinh-synopsis-expanded-card">
          <div className="ngontinh-synopsis-card-header">
            <div className="ngontinh-card-header">
              <BookOpen size={18} className="ngontinh-card-header-icon" />
              <h2 className="ngontinh-card-title">Giới thiệu & Thể loại</h2>
            </div>
            <button 
              className="ngontinh-btn-close-synopsis" 
              onClick={() => setShowAllTags(false)}
              title="Thu gọn"
            >
              <span>Thu gọn</span>
              <ChevronUp size={16} />
            </button>
          </div>

          <div className="ngontinh-synopsis-expand-body">
            <p className="ngontinh-synopsis-paragraph">
              {manga.description || 'Truyện tranh 18+ hấp dẫn với nét vẽ đẹp mắt và cốt truyện lôi cuốn.'}
            </p>

            {/* Tags Badges */}
            {tags.length > 0 && (
              <div className="ngontinh-tags-wrap">
                {tags.map((tag, idx) => (
                  <span key={idx} className="ngontinh-tag-pill">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Chapter List Card */}
      <section className="ngontinh-content-card ngontinh-chapters-card">
        <div className="ngontinh-chapters-header-row">
          <div className="ngontinh-card-header">
            <BookOpen size={18} className="ngontinh-card-header-icon" />
            <h2 className="ngontinh-card-title">Danh sách chương</h2>
            <span className="ngontinh-chapter-count-badge">
              {manga.chapters?.length || 0}
            </span>
          </div>

          {/* Sort & Search Controls */}
          <div className="ngontinh-chapter-controls">
            <div className="ngontinh-chapter-search-box">
              <Search size={14} className="ngontinh-search-icon" />
              <input
                type="text"
                placeholder="Tìm số chap..."
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                className="ngontinh-chapter-search-input"
              />
              {chapterSearch && (
                <button className="ngontinh-clear-search-btn" onClick={() => setChapterSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            <button 
              className="ngontinh-sort-btn" 
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? 'Sắp xếp: Cũ nhất trước' : 'Sắp xếp: Mới nhất trước'}
            >
              <ArrowUpDown size={14} />
              <span>{sortAsc ? 'Cũ nhất' : 'Mới nhất'}</span>
            </button>
          </div>
        </div>

        {/* Chapters List */}
        <div className="ngontinh-chapter-list">
          {displayedChapters.length === 0 ? (
            <div className="ngontinh-no-chapters">
              <p>Không tìm thấy chương nào phù hợp.</p>
            </div>
          ) : (
            displayedChapters.map((ch, idx) => {
              const isCurrentReading = userProgress && userProgress.chapterNumber === ch.number;
              const chNum = ch.number ?? (idx + 1);

              return (
                <div
                  key={ch.number ?? idx}
                  className={`ngontinh-chapter-item ${isCurrentReading ? 'reading' : ''}`}
                  onClick={() => handleReadChapter(chNum)}
                >
                  <div className="ngontinh-chapter-info">
                    <span className="ngontinh-chapter-name">{ch.name || `Chapter ${chNum}`}</span>
                    {isCurrentReading && (
                      <span className="ngontinh-chapter-reading-badge">
                        <Clock size={11} /> Đang đọc
                      </span>
                    )}
                  </div>

                  <div className="ngontinh-chapter-meta">
                    <ChevronRight size={15} className="ngontinh-chapter-arrow" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Show all / Show less button */}
        {!chapterSearch && manga.chapters && manga.chapters.length > 20 && (
          <button 
            className="ngontinh-btn-expand-chapters"
            onClick={() => setShowAllChapters(!showAllChapters)}
          >
            {showAllChapters ? (
              <>
                <span>Thu gọn danh sách</span>
                <ChevronUp size={16} />
              </>
            ) : (
              <>
                <span>Xem toàn bộ {manga.chapters.length} chương</span>
                <ChevronDown size={16} />
              </>
            )}
          </button>
        )}
      </section>

      {/* Quick Webtoon Reader Modal */}
      {readingChapterNum != null && (
        <HMangaReaderModal
          manga={manga}
          initialChapterNum={readingChapterNum}
          onClose={() => {
            setReadingChapterNum(null);
            setHistory(getHMangaHistory());
          }}
        />
      )}
    </div>
  );
};
