import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Play, BookOpen, Clock, 
  Search, ArrowUpDown, ChevronRight,
  CheckCircle2, Sparkles, Flame, Star, Users, Bookmark,
  Tag, ChevronDown, ChevronUp, ExternalLink, Share2, Check,
  Bell, RefreshCw, Trash2
} from 'lucide-react';
import type { MangaChapter } from '../../types/manga';
import type { HManga } from './hMangaService';
import { 
  fetchHMangaList,
  getHMangaFavorites, toggleHMangaFavorite, 
  getHMangaHistory,
  getHMangaFollows, toggleHMangaFollow,
  getChapterImageUrl,
  isValidHMangaCover,
  syncHMangaChapters,
  canDeleteHManga,
  deleteHMangaForever
} from './hMangaService';
import { useToast } from '../ToastContext';
import { useHideHeader } from '../HeaderAction';
import { getCachedCoverBlobUrl, fetchAndCacheCover } from '../../lib/mangaCoverCache';
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
  // Chỉ chủ kho (Hieu100) mới thấy nút xoá vĩnh viễn.
  const [canDelete, setCanDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAllTags, setShowAllTags] = useState<boolean>(false);
  const [isShareCopied, setIsShareCopied] = useState<boolean>(false);
  
  // Chapter filter and sort
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [showAllChapters, setShowAllChapters] = useState<boolean>(false);

  useEffect(() => {
    void canDeleteHManga().then(setCanDelete);
  }, []);

  /** Xoá hẳn truyện khỏi kho chung: hỏi lại một lần rồi mới làm. */
  const handleDeleteForever = async () => {
    if (!manga || deleting) return;
    const ok = window.confirm(
      `Xoá vĩnh viễn "${manga.title}"?

Truyện sẽ biến mất khỏi kho trên mọi máy và không khôi phục lại được.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteHMangaForever({ slug: manga.slug, title: manga.title });
      showToast(`🗑️ Đã xoá vĩnh viễn "${manga.title}"`);
      navigate('/truyenh');
    } catch (err: any) {
      showToast(`❌ Không xoá được: ${err?.message ?? err}`);
      setDeleting(false);
    }
  };

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

  const [detailCover, setDetailCover] = useState<string>('');

  useEffect(() => {
    if (manga) {
      let isMounted = true;
      const ch1 = getChapterImageUrl(manga.chapters?.[0]?.images?.[0]);
      const valid = (isValidHMangaCover(manga.cover) ? manga.cover : ch1) || manga.cover || '';
      
      void getCachedCoverBlobUrl(manga.slug).then((cachedBlob) => {
        if (isMounted) {
          if (cachedBlob) {
            setDetailCover(cachedBlob);
          } else {
            setDetailCover(valid);
            if (valid) void fetchAndCacheCover(valid, manga.slug);
          }
        }
      });
      return () => { isMounted = false; };
    }
  }, [manga]);

  const handleDetailCoverError = () => {
    const ch1 = getChapterImageUrl(manga?.chapters?.[0]?.images?.[0]);
    if (ch1 && detailCover !== ch1) {
      setDetailCover(ch1);
      if (manga?.slug) void fetchAndCacheCover(ch1, manga.slug);
    }
  };


  const isFav = slug ? favorites.includes(slug) : false;
  const isFollowed = slug ? follows.includes(slug) : false;
  const userProgress = slug ? history[slug] : null;

  const [syncingNewChapters, setSyncingNewChapters] = useState<boolean>(false);

  const handleSyncChapters = async (silent = false) => {
    if (!manga || syncingNewChapters) return;
    setSyncingNewChapters(true);
    try {
      if (!silent) showToast('🔄 Đang kiểm tra chapter mới từ link gốc...');
      const res = await syncHMangaChapters(manga);
      if (res.updated && res.addedCount > 0) {
        setManga(res.manga);
        showToast(`🎉 Đã tự động cào thêm ${res.addedCount} chapter mới!`);
      } else if (!silent) {
        setManga(res.manga);
        showToast('✅ Đã là danh sách chapter mới nhất!');
      }
    } catch (err: any) {
      if (!silent) showToast(`❌ Lỗi kiểm tra: ${err?.message || 'Không kết nối được web gốc'}`);
    } finally {
      setSyncingNewChapters(false);
    }
  };

  // Tự động kiểm tra chapter mới trong nền khi mở trang chi tiết (mỗi 10 phút / lần mở)
  useEffect(() => {
    if (!manga?.slug) return;
    const cooldownKey = `h_manga_sync_cooldown_${manga.slug}`;
    const lastSync = sessionStorage.getItem(cooldownKey);
    const now = Date.now();
    if (!lastSync || now - Number(lastSync) > 10 * 60 * 1000) {
      sessionStorage.setItem(cooldownKey, String(now));
      void handleSyncChapters(true);
    }
  }, [manga?.slug]);

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
    const targetChapter = userProgress?.chapterNumber ?? firstChapterNum;
    navigate(`/truyenh/${slug}/read/${targetChapter}`);
  };

  const handleReadChapter = (chNum: number) => {
    navigate(`/truyenh/${slug}/read/${chNum}`);
  };

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
    const now = new Date();
    const diffDays = Math.max(0, (total - chNum) * 4);
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
          <button className="ngontinh-btn-back-home" onClick={() => navigate('/truyenh')}>
            <ArrowLeft size={16} /> Quay lại danh sách truyện H
          </button>
        </div>
      </div>
    );
  }

  const authorDisplay = manga.author || 'Đang cập nhật';
  const statusDisplay = manga.status || 'Đang tiến hành';
  const sourceName = manga.sourceName || (manga.url?.includes('vietmanhwa') ? 'VietManhwa' : 'MeTruyen18');

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
            {detailCover ? (
              <img 
                src={detailCover} 
                alt={manga.title} 
                className="ngontinh-poster-image"
                referrerPolicy="no-referrer"
                onError={handleDetailCoverError}
              />
            ) : (
              <div className="ngontinh-poster-fallback">
                <BookOpen size={44} />
              </div>
            )}

            {/* Top Team Badge */}
            <div className="ngontinh-team-badge" style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff' }}>
              <Sparkles size={11} className="ngontinh-sparkle-icon" />
              <span>🔞 18+ {sourceName}</span>
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
              <span className="ngontinh-qa-subtitle">{manga.sourceName || (manga.url.includes('vietmanhwa') ? 'VietManhwa' : 'MeTruyen18')}</span>
            </div>
          </a>
        ) : (
          <div className="ngontinh-quick-action-card disabled">
            <ExternalLink size={19} className="ngontinh-qa-icon" />
            <div className="ngontinh-qa-text">
              <span className="ngontinh-qa-title">Nguồn</span>
              <span className="ngontinh-qa-subtitle">{manga.sourceName || 'MeTruyen18'}</span>
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

        {canDelete && (
          <button
            className="ngontinh-quick-action-card"
            style={{ color: '#ef4444' }}
            disabled={deleting}
            onClick={() => void handleDeleteForever()}
          >
            <Trash2 size={19} className="ngontinh-qa-icon" />
            <div className="ngontinh-qa-text">
              <span className="ngontinh-qa-title">{deleting ? 'Đang xoá…' : 'Xoá vĩnh viễn'}</span>
              <span className="ngontinh-qa-subtitle">Gỡ khỏi kho trên mọi máy</span>
            </div>
          </button>
        )}
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

      {/* Chapters List Card */}
      <section className="ngontinh-content-card ngontinh-chapters-card">
        <div className="ngontinh-chapters-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="ngontinh-chapters-title-group">
            <h2 className="ngontinh-card-title">Danh sách chương</h2>
            <span className="ngontinh-chapters-badge">
              {manga.chapters?.length || 0} chương
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSyncChapters(false)}
            disabled={syncingNewChapters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 8,
              fontSize: '0.76rem',
              fontWeight: 600,
              background: syncingNewChapters ? 'var(--purple-bg)' : 'var(--bg-main)',
              color: 'var(--purple)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              cursor: syncingNewChapters ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Kiểm tra và cào thêm chapter mới từ link gốc"
          >
            <RefreshCw size={13} style={{ animation: syncingNewChapters ? 'spin 1s linear infinite' : 'none' }} />
            <span>{syncingNewChapters ? 'Đang quét...' : 'Cào chap mới'}</span>
          </button>
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
