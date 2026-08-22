import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Play, BookOpen, Clock, 
  Search, ArrowUpDown, ChevronRight,
  CheckCircle2, Sparkles, Flame, Star, Users, Bookmark,
  Tag, ChevronDown, ChevronUp, ExternalLink, Share2, Check,
  Layers, Bell
} from 'lucide-react';
import type { MangaChapter, NgontinhManga } from '../../types/manga';
import { 
  fetchNgontinhList, fetchNgontinhHotData, 
  getNgontinhFavorites, toggleNgontinhFavorite, 
  getNgontinhHistory,
  getNgontinhFollows, toggleNgontinhFollow
} from './ngontinhService';
import { hydrateMangadexManga } from './mangadexService';
import { notifyFollowsChanged } from './mangaUpdates';
import { useToast } from '../ToastContext';
import { useHideHeader } from '../HeaderAction';
import './ngontinhDetail.css';

export const NgontinhDetailPage: React.FC = () => {
  useHideHeader(true);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [manga, setManga] = useState<NgontinhManga | null>(null);
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
          const match = list.find((m) => m.slug === slug);
          const found = match ? await hydrateMangadexManga(match) : undefined;
          if (found) {
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
    setFollows(getNgontinhFollows());
    setHistory(getNgontinhHistory());

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const isFav = slug ? favorites.includes(slug) : false;
  const isFollowed = slug ? follows.includes(slug) : false;
  const userProgress = slug ? history[slug] : null;

  const handleToggleFav = () => {
    if (!slug) return;
    const added = toggleNgontinhFavorite(slug);
    setFavorites(getNgontinhFavorites());
    showToast(added ? '❤️ Đã thêm vào danh sách Yêu thích!' : '💔 Đã bỏ khỏi danh sách Yêu thích');
  };

  const handleToggleFollow = () => {
    if (!slug) return;
    const added = toggleNgontinhFollow(slug);
    setFollows(getNgontinhFollows());
    notifyFollowsChanged();
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
      } catch (e) {
        // Fallback to copy
      }
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
    const totalCh = manga.chapters?.length || manga.totalChapters || 50;
    
    let hash = 0;
    for (let i = 0; i < (slug || '').length; i++) {
      hash = (hash << 5) - hash + (slug || '').charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    
    const viewsNum = ((absHash % 2400) / 10 + 35).toFixed(1);
    const ratingScore = (9.3 + (absHash % 7) / 10).toFixed(1);
    const reviewsNum = ((absHash % 42) / 10 + 1.8).toFixed(1);

    return {
      chapters: `${totalCh} Chapters`,
      views: `${viewsNum}K lượt xem`,
      rating: `${ratingScore}/10`,
      reviews: `${reviewsNum}K đánh giá`
    };
  }, [manga, slug]);

  // Breadcrumbs
  const breadcrumbsList = useMemo(() => {
    if (!manga) return ['Truyện Ngôn Tình', 'Manhua', 'Hiện đại'];
    const list = ['Truyện Ngôn Tình'];
    if (manga.genres && manga.genres.length > 0) {
      const typeGenre = manga.genres.find(g => ['Manhwa', 'Manga', 'Manhua'].includes(g));
      list.push(typeGenre || 'Manhua');
    } else {
      list.push('Manhua');
    }

    if (manga.genres && manga.genres.length > 0) {
      const mainGenre = manga.genres.find(g => !['Manhwa', 'Manga', 'Manhua', 'Ngôn Tình', 'Romance', '18+'].includes(g));
      if (mainGenre) list.push(mainGenre);
      else list.push('Hiện đại');
    } else {
      list.push('Hiện đại');
    }
    return list;
  }, [manga]);

  // Tags list
  const tags = useMemo(() => {
    if (!manga) return [];
    const rawGenres = manga.genres || [];
    if (rawGenres.length < 3) {
      return [
        'Ngôn Tình', 'Tổng Tài', 'Sủng Ngọt', 
        'Hiện Đại', 'Nữ Cường', 'Hào Môn Thế Gia', 
        'Gương Vỡ Lại Lành', 'Chữa Lành'
      ];
    }
    return rawGenres;
  }, [manga]);

  const visibleTags = useMemo(() => {
    if (showAllTags) return tags;
    return tags.slice(0, 7);
  }, [tags, showAllTags]);

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
      return list.slice(0, 15);
    }

    return list;
  }, [manga, sortAsc, chapterSearch, showAllChapters]);

  const firstChapterNum = useMemo(() => {
    if (!manga || !manga.chapters || !manga.chapters.length) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga]);

  const maxChapterNum = useMemo(() => {
    if (!manga?.chapters || manga.chapters.length === 0) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga?.chapters]);

  const handleStartRead = () => {
    if (!slug) return;
    const targetChapter = userProgress?.chapterNumber ?? firstChapterNum;
    navigate(`/ngontinh/${slug}/read/${targetChapter}`);
  };

  const handleReadChapter = (chNum: number) => {
    if (!slug) return;
    navigate(`/ngontinh/${slug}/read/${chNum}`);
  };

  // Clean chapter title helper (only show Chapter X, remove duplicate comic title)
  const getCleanChapterTitle = (ch: MangaChapter, fallbackNum: number) => {
    if (ch.number != null) {
      return `Chapter ${ch.number}`;
    }
    const rawName = ch.name || ch.title || '';
    const match = rawName.match(/(?:chapter|chap|chương|tập)\s*([\d.]+)/i);
    if (match && match[1]) {
      return `Chapter ${match[1]}`;
    }
    return `Chapter ${fallbackNum}`;
  };

  const getChapterDate = (chNum: number, total: number) => {
    const now = new Date(2025, 7, 15);
    const diffDays = Math.max(0, (total - chNum) * 7);
    const date = new Date(now.getTime() - diffDays * 24 * 60 * 60 * 1000);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
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
          <button className="ngontinh-btn-back-home" onClick={() => navigate('/ngontinh')}>
            <ArrowLeft size={16} /> Quay lại danh sách truyện Ngôn Tình
          </button>
        </div>
      </div>
    );
  }

  const authorDisplay = manga.author || 'Đang cập nhật';
  const statusDisplay = manga.status || 'Đang làm';

  return (
    <div className="ngontinh-detail-wrapper">
      {/* Top Header App Bar */}
      <header className="ngontinh-top-bar">
        <button 
          className="ngontinh-icon-btn" 
          onClick={() => navigate('/ngontinh')}
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
            <div className="ngontinh-team-badge">
              <Sparkles size={11} className="ngontinh-sparkle-icon" />
              <span>NetTruyen</span>
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
        {/* Action 2: Resume read */}
        <button className="ngontinh-quick-action-card" onClick={handleStartRead}>
          <Clock size={19} className="ngontinh-qa-icon" />
          <div className="ngontinh-qa-text">
            <span className="ngontinh-qa-title">Tiếp tục đọc</span>
            <span className="ngontinh-qa-subtitle">
              {userProgress ? `Chapter ${userProgress.chapterNumber}` : `Chapter ${firstChapterNum}`}
            </span>
          </div>
        </button>

        {/* Action 3: Toggle Synopsis & Genres */}
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

        {/* Action 4: Open original source */}
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
              <span className="ngontinh-qa-subtitle">NetTruyen</span>
            </div>
          </a>
        ) : (
          <div className="ngontinh-quick-action-card disabled">
            <ExternalLink size={19} className="ngontinh-qa-icon" />
            <div className="ngontinh-qa-text">
              <span className="ngontinh-qa-title">Nguồn</span>
              <span className="ngontinh-qa-subtitle">NetTruyen</span>
            </div>
          </div>
        )}

        {/* Action 5: Toggle Favorite */}
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

        {/* Action 6: Theo dõi để được báo khi có chương mới */}
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

      {/* Collapsible Description & Genres Card (shown when clicking Giới thiệu) */}
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
              {manga.description || 'Một câu chuyện ngôn tình lãng mạn đầy ngọt ngào và cuốn hút, đưa bạn đắm chìm vào những khoảnh khắc rung động của tình yêu.'}
            </p>

            {/* Tags & Tropes Badges */}
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

      {/* Chapters List Card */}
      <section className="ngontinh-content-card ngontinh-chapters-card">
        <div className="ngontinh-chapters-card-header">
          <div className="ngontinh-chapters-title-group">
            <h2 className="ngontinh-card-title">Danh sách chương</h2>
            <span className="ngontinh-chapters-badge">
              {manga.chapters?.length || 0} chương
            </span>
          </div>
        </div>

        {/* Chapter Toolbar (Search & Sort) */}
        <div className="ngontinh-chapters-toolbar-row">
          <div className="ngontinh-search-input-wrap">
            <Search size={16} className="ngontinh-search-icon" />
            <input 
              type="text" 
              placeholder="Tìm số chapter..."
              value={chapterSearch}
              onChange={(e) => setChapterSearch(e.target.value)}
              className="ngontinh-search-input"
            />
          </div>

          <button 
            className="ngontinh-sort-toggle-btn"
            onClick={() => setSortAsc(!sortAsc)}
          >
            <ArrowUpDown size={15} />
            <span>{sortAsc ? 'Cũ nhất' : 'Mới nhất'}</span>
          </button>
        </div>

        {/* Chapters List */}
        <div className="ngontinh-chapters-list-container">
          {displayedChapters.length === 0 ? (
            <div className="ngontinh-no-chapters-notice">
              <p>Không tìm thấy chapter nào phù hợp.</p>
            </div>
          ) : (
            displayedChapters.map((ch, idx) => {
              const chNum = ch.number ?? (displayedChapters.length - idx);
              const isCurrentlyReading = userProgress?.chapterNumber === chNum;
              const isLatest = chNum >= maxChapterNum - 2 && chNum <= maxChapterNum;
              const releaseDate = getChapterDate(chNum, maxChapterNum);

              return (
                <div 
                  key={ch.url || `chapter-${chNum}-${idx}`}
                  className={`ngontinh-chapter-item-row ${isCurrentlyReading ? 'reading-active' : ''}`}
                >
                  <div className="ngontinh-chapter-meta-left">
                    <span className="ngontinh-chapter-dot" />
                    <span className="ngontinh-chapter-name">
                      {getCleanChapterTitle(ch, chNum)}
                    </span>
                    {isLatest && (
                      <span className="ngontinh-chapter-new-badge">Mới</span>
                    )}
                  </div>

                  <div className="ngontinh-chapter-meta-right">
                    <span className="ngontinh-chapter-date">{releaseDate}</span>
                    <button 
                      className={`ngontinh-chapter-read-btn ${isCurrentlyReading ? 'reading' : ''}`}
                      onClick={() => handleReadChapter(chNum)}
                    >
                      {isCurrentlyReading ? 'Đang đọc' : 'Đọc'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom View All Button */}
        {manga.chapters && manga.chapters.length > 15 && !chapterSearch.trim() && (
          <div className="ngontinh-chapters-footer-action">
            <button 
              type="button"
              className="ngontinh-btn-view-all-bottom"
              onClick={() => setShowAllChapters(!showAllChapters)}
            >
              <span>{showAllChapters ? 'Thu gọn danh sách chương' : `Xem tất cả ${manga.chapters.length} chương`}</span>
              {showAllChapters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
