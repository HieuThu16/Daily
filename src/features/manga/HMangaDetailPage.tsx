import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Play, BookOpen, Clock, 
  Search, ArrowUpDown, ChevronRight,
  Sparkles, Flame, Bookmark,
  Tag, ExternalLink, Share2, Check,
  Bell
} from 'lucide-react';
import type { MangaChapter } from '../../types/manga';
import type { HManga } from './hMangaService';
import { 
  fetchHMangaList,
  getHMangaFavorites, toggleHMangaFavorite, 
  getHMangaHistory,
  getHMangaFollows, toggleHMangaFollow
} from './hMangaService';
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
    const next = toggleHMangaFavorite(slug);
    setFavorites(getHMangaFavorites());
    showToast(next ? '❤️ Đã thêm vào danh sách yêu thích' : '💔 Đã bỏ yêu thích');
  };

  const handleToggleFollow = () => {
    if (!slug) return;
    const next = toggleHMangaFollow(slug);
    setFollows(getHMangaFollows());
    showToast(next ? '🔔 Đã theo dõi truyện' : '🔕 Đã huỷ theo dõi');
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setIsShareCopied(true);
    showToast('🔗 Đã sao chép link truyện');
    setTimeout(() => setIsShareCopied(false), 2000);
  };

  // Chapter sorting and filtering
  const sortedChapters = useMemo(() => {
    if (!manga || !manga.chapters) return [];
    const list = [...manga.chapters];
    list.sort((a, b) => {
      const numA = a.number ?? 0;
      const numB = b.number ?? 0;
      return sortAsc ? numA - numB : numB - numA;
    });
    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase().trim();
      return list.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.number !== null && c.number.toString().includes(q))
      );
    }
    return list;
  }, [manga, sortAsc, chapterSearch]);

  const firstChapterNum = useMemo(() => {
    if (!manga || !manga.chapters || manga.chapters.length === 0) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga]);

  const latestChapterNum = useMemo(() => {
    if (!manga || !manga.chapters || manga.chapters.length === 0) return 1;
    const sorted = [...manga.chapters].sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
    return sorted[0]?.number ?? 1;
  }, [manga]);

  const displayedChapters = useMemo(() => {
    if (showAllChapters || chapterSearch.trim()) return sortedChapters;
    return sortedChapters.slice(0, 30);
  }, [sortedChapters, showAllChapters, chapterSearch]);

  if (loading) {
    return (
      <div className="ngontinh-detail-page loading">
        <div className="ngontinh-detail-skeleton">
          <div className="skeleton-cover" />
          <div className="skeleton-info" />
        </div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="ngontinh-detail-page empty">
        <div className="empty-container">
          <BookOpen size={48} />
          <h2>Không tìm thấy truyện</h2>
          <p>Truyện không tồn tại hoặc đã bị xóa.</p>
          <button className="primary-btn" onClick={() => navigate('/truyenh')}>
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ngontinh-detail-page">
      {/* Top action bar */}
      <div className="detail-top-nav">
        <button className="nav-back-btn" onClick={() => navigate('/truyenh')} title="Quay lại">
          <ArrowLeft size={18} />
          <span>Danh sách truyện H</span>
        </button>
        <div className="nav-actions">
          <button className="icon-btn" onClick={handleShare} title="Chia sẻ">
            {isShareCopied ? <Check size={18} color="#10b981" /> : <Share2 size={18} />}
          </button>
          <button className={`icon-btn ${isFollowed ? 'active' : ''}`} onClick={handleToggleFollow} title="Theo dõi">
            <Bell size={18} fill={isFollowed ? 'currentColor' : 'none'} />
          </button>
          <button className={`icon-btn ${isFav ? 'active-fav' : ''}`} onClick={handleToggleFav} title="Yêu thích">
            <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Hero Header */}
      <div className="detail-hero-card">
        <div className="hero-backdrop" style={{ backgroundImage: `url(${manga.cover})` }} />
        
        <div className="hero-content">
          <div className="hero-cover-wrap">
            <img src={manga.cover || ''} alt={manga.title} className="hero-cover-img" />
            <div className="hero-badge-18" style={{ background: '#e11d48', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12, marginTop: 6, display: 'inline-block' }}>
              🔞 18+ Hentai Manhwa
            </div>
          </div>

          <div className="hero-meta-body">
            <h1 className="hero-title">{manga.title}</h1>

            <div className="hero-author-status">
              <span className="author-item">Tác giả: <strong>{manga.author || 'Đang cập nhật'}</strong></span>
              <span className="dot-divider">•</span>
              <span className="status-item">Tình trạng: <strong>{manga.status || 'Đang tiến hành'}</strong></span>
            </div>

            {/* Genres Tag List */}
            <div className="hero-genres-row">
              {manga.genres?.map((genre, idx) => (
                <span key={idx} className="genre-pill">
                  <Tag size={12} /> {genre}
                </span>
              ))}
            </div>

            {/* Quick Action Buttons */}
            <div className="hero-actions-row">
              {userProgress ? (
                <button
                  className="read-main-btn resume"
                  onClick={() => navigate(`/truyenh/${manga.slug}/read/${userProgress.chapterNumber}`)}
                >
                  <Play size={18} fill="currentColor" />
                  <span>Đọc tiếp Chap {userProgress.chapterNumber}</span>
                </button>
              ) : (
                <button
                  className="read-main-btn"
                  onClick={() => navigate(`/truyenh/${manga.slug}/read/${firstChapterNum}`)}
                >
                  <Play size={18} fill="currentColor" />
                  <span>Đọc từ đầu</span>
                </button>
              )}

              <button
                className="read-sub-btn"
                onClick={() => navigate(`/truyenh/${manga.slug}/read/${latestChapterNum}`)}
              >
                <span>Chap mới nhất ({latestChapterNum})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Description Section */}
      {manga.description && (
        <div className="detail-section description-section">
          <h2 className="section-title">
            <Sparkles size={18} /> Nội dung tóm tắt
          </h2>
          <div className="description-text">
            {manga.description}
          </div>
        </div>
      )}

      {/* Chapter List Section */}
      <div className="detail-section chapters-section">
        <div className="chapters-section-header">
          <div className="chapters-title-group">
            <h2 className="section-title">
              <BookOpen size={18} /> Danh sách chương
            </h2>
            <span className="chapters-count-badge">
              {manga.chapters?.length || 0} chương
            </span>
          </div>

          <div className="chapters-toolbar">
            {/* Search within chapters */}
            <div className="chapter-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Tìm số chương..."
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
              />
            </div>

            {/* Sort Button */}
            <button
              className="sort-toggle-btn"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? 'Mới nhất trước' : 'Cũ nhất trước'}
            >
              <ArrowUpDown size={15} />
              <span>{sortAsc ? 'Cũ nhất' : 'Mới nhất'}</span>
            </button>
          </div>
        </div>

        {/* Chapters Grid */}
        <div className="chapters-grid">
          {displayedChapters.map((ch) => {
            const isRead = userProgress && userProgress.chapterNumber === ch.number;
            return (
              <Link
                key={ch.number ?? ch.name}
                to={`/truyenh/${manga.slug}/read/${ch.number}`}
                className={`chapter-item-card ${isRead ? 'is-current-read' : ''}`}
              >
                <div className="chapter-item-main">
                  <span className="ch-name">{ch.name}</span>
                  {ch.title && <span className="ch-sub">{ch.title}</span>}
                </div>
                {isRead && <span className="ch-reading-tag"><Clock size={12} /> Đang đọc</span>}
                <ChevronRight size={14} className="ch-arrow" />
              </Link>
            );
          })}
        </div>

        {/* Show More Chapters Button */}
        {!showAllChapters && sortedChapters.length > 30 && !chapterSearch && (
          <div className="chapters-show-more-wrap">
            <button className="show-more-btn" onClick={() => setShowAllChapters(true)}>
              Xem toàn bộ {sortedChapters.length} chương
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
