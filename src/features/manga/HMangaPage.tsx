import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Heart, BookOpen, Clock, Play, 
  X, Bookmark, ChevronRight,
  Flame, Sparkles, Loader2, Plus, Download,
  Link as LinkIcon, AlertCircle, Clipboard, ExternalLink
} from 'lucide-react';
import type { HManga } from './hMangaService';
import { 
  fetchHMangaList,
  getHMangaFavorites, toggleHMangaFavorite, 
  getHMangaHistory,
  crawlAndSaveStory,
  getChapterImageUrl
} from './hMangaService';
import { HMangaReaderModal } from './HMangaReaderModal';
import { useScrollRestore } from '../shared';
import { useToast } from '../ToastContext';
import './ngontinhManga.css';

type MainTab = 'all' | 'history' | 'favorites';

const BATCH_SIZE = 36;

interface CardProps {
  manga: HManga;
  isFav: boolean;
  userProgress?: { chapterNumber: number };
  onToggleFav: (e: React.MouseEvent, slug: string) => void;
  onOpenReader: (manga: HManga, chapterNum: number) => void;
  onClick: () => void;
}

const HMangaCardItem: React.FC<CardProps> = React.memo(({
  manga,
  isFav,
  userProgress,
  onToggleFav,
  onOpenReader,
  onClick,
}) => {
  const ch1Img = getChapterImageUrl(manga.chapters?.[0]?.images?.[0]);
  const fallbackCover = manga.cover || ch1Img || '';
  const [currentCover, setCurrentCover] = useState<string>(fallbackCover);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    const ch1 = getChapterImageUrl(manga.chapters?.[0]?.images?.[0]);
    setCurrentCover(manga.cover || ch1 || '');
    setImgError(false);
    setImgLoaded(false);
  }, [manga.cover, manga.chapters]);

  const sortedChs = useMemo(() => {
    return [...(manga.chapters || [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  }, [manga.chapters]);
  const firstCh = sortedChs[0]?.number ?? 1;

  const handleImgError = () => {
    const ch1 = getChapterImageUrl(manga.chapters?.[0]?.images?.[0]);
    if (ch1 && currentCover !== ch1) {
      setCurrentCover(ch1);
    } else {
      setImgError(true);
      setImgLoaded(true);
    }
  };

  return (
    <div className="ngontinh-manga-card" onClick={onClick}>
      {/* Cover Wrap */}
      <div className="ngontinh-cover-wrap">
        {!imgLoaded && !imgError && <div className="ngontinh-cover-skeleton" />}

        {currentCover && !imgError ? (
          <img
            src={currentCover}
            alt={manga.title}
            className={`ngontinh-cover-img ${imgLoaded ? 'loaded' : 'loading'}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={handleImgError}
          />
        ) : (
          <div className="ngontinh-cover-placeholder">
            <BookOpen size={32} />
          </div>
        )}

        {/* 18+ Hot Tag */}
        <div className="ngontinh-hot-tag" style={{ background: '#e11d48', color: '#fff', fontWeight: 800 }}>
          🔞 18+
        </div>

        {/* Favorite Button */}
        <button
          className={`ngontinh-card-fav-btn ${isFav ? 'favorited' : ''}`}
          onClick={(e) => onToggleFav(e, manga.slug)}
          title={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
        >
          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        {/* Total Chapters Badge */}
        <div className="ngontinh-card-chapter-badge">
          {manga.totalChapters || manga.chapters.length} Ch
        </div>

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
        </div>
      </div>
    </div>
  );
});

// Crawl Modal Component
function CrawlModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: (manga: HManga) => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) setUrl(text.trim());
    } catch {}
  };

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorMsg('Vui lòng nhập link truyện từ metruyen18.app');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setProgressMsg('Đang bắt đầu cào dữ liệu...');

    try {
      const crawled = await crawlAndSaveStory(url.trim(), (msg) => setProgressMsg(msg));
      onSuccess(crawled);
      onClose();
    } catch (err: any) {
      console.error('Crawl error:', err);
      setErrorMsg(err.message || 'Không thể cào dữ liệu truyện này. Vui lòng kiểm tra lại đường link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crawl-modal-backdrop" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div 
        className="crawl-modal-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{
          background: 'var(--surface-card, #ffffff)',
          color: 'var(--text-primary, #1e293b)',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color, #e2e8f0)',
          animation: 'modalSlideIn 0.2s ease-out'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '12px', background: '#ffe4e6', color: '#e11d48' }}>
              <Download size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Cào truyện H (MeTruyen18 & VietManhwa)</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>Hỗ trợ link từ metruyen18.app hoặc vietmanhwa.com</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            disabled={loading}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', color: 'var(--text-muted, #64748b)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCrawl}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Đường dẫn truyện (metruyen18.app hoặc vietmanhwa.com)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <LinkIcon size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted, #64748b)' }} />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://vietmanhwa.com/manhwa-18/... hoặc https://metruyen18.app/..."
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 75px 12px 38px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--surface-bg, #f8fafc)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '6px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--surface-card, #fff)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Clipboard size={12} /> Dán
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginTop: '6px' }}>
              Ví dụ: <code>https://vietmanhwa.com/manhwa-18/toi-duoc-giao-nhiem-vu...</code>
            </div>
          </div>

          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '0.85rem',
              marginBottom: '16px',
              border: '1px solid #fecaca'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--primary-bg, #eff6ff)',
              color: 'var(--primary, #2563eb)',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              <Loader2 className="spinner" size={18} />
              <span>{progressMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'transparent',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="spinner" size={16} /> Đang cào truyện...
                </>
              ) : (
                <>
                  <Download size={16} /> Bắt đầu cào truyện
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const HMangaPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mangaList, setMangaList] = useState<HManga[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<MainTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, any>>({});
  const [showCrawlModal, setShowCrawlModal] = useState<boolean>(false);

  // Progressive batching count
  const [visibleCount, setVisibleCount] = useState<number>(
    () => Number(sessionStorage.getItem('daily_count_h-list') ?? BATCH_SIZE) || BATCH_SIZE,
  );

  useEffect(() => {
    sessionStorage.setItem('daily_count_h-list', String(visibleCount));
  }, [visibleCount]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Quick Reader modal state
  const [readingState, setReadingState] = useState<{ manga: HManga; chapterNum: number } | null>(null);

  useScrollRestore('truyenh-list', mangaList.length > 0);

  const loadData = async () => {
    try {
      const list = await fetchHMangaList();
      if (list && list.length > 0) {
        setMangaList(list);
      }
    } catch (err) {
      console.error('Failed to load H manga list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setFavorites(getHMangaFavorites());
    setHistory(getHMangaHistory());
  }, []);

  // Reset pagination on tab/search change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [activeTab, searchQuery]);

  const handleToggleFav = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    toggleHMangaFavorite(slug);
    setFavorites(getHMangaFavorites());
  };

  const openReader = (manga: HManga, chapterNum: number) => {
    setReadingState({ manga, chapterNum });
    setHistory(getHMangaHistory());
  };

  const handleCrawlSuccess = (manga: HManga) => {
    showToast(`🎉 Đã cào thành công truyện "${manga.title}" (${manga.totalChapters} chương)!`);
    loadData();
    navigate(`/truyenh/${manga.slug}`);
  };

  // Map slug to full manga details
  const mangaMap = useMemo(() => {
    return new Map(mangaList.map(m => [m.slug, m]));
  }, [mangaList]);

  // Filtered list
  const filteredList = useMemo(() => {
    let result: { manga: HManga }[] = [];

    if (activeTab === 'favorites') {
      result = mangaList.filter(m => favorites.includes(m.slug)).map(m => ({ manga: m }));
    } else if (activeTab === 'history') {
      result = mangaList
        .filter(m => history[m.slug])
        .sort((a, b) => {
          const tA = new Date(history[a.slug]?.readAt || 0).getTime();
          const tB = new Date(history[b.slug]?.readAt || 0).getTime();
          return tB - tA;
        })
        .map(m => ({ manga: m }));
    } else {
      result = mangaList.map(m => ({ manga: m }));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        item.manga.title.toLowerCase().includes(q) || 
        item.manga.author?.toLowerCase().includes(q) ||
        item.manga.genres?.some(g => g.toLowerCase().includes(q))
      );
    }

    return result;
  }, [mangaList, activeTab, favorites, history, searchQuery]);

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

  /** Truyện đang đọc dở gần nhất */
  const continueReading = useMemo(() => {
    const entries = Object.values(history) as Array<{ slug: string; chapterNumber: number; chapterName?: string; readAt?: string }>;
    const latest = entries
      .filter((h) => h?.slug && mangaMap.has(h.slug))
      .sort((a, b) => (b.readAt ?? '').localeCompare(a.readAt ?? ''))[0];
    return latest ? { progress: latest, manga: mangaMap.get(latest.slug)! } : null;
  }, [history, mangaMap]);

  return (
    <div className="ngontinh-page-container">
      <CrawlModal
        isOpen={showCrawlModal}
        onClose={() => setShowCrawlModal(false)}
        onSuccess={handleCrawlSuccess}
      />

      {/* Continue reading banner if available */}
      {continueReading && (() => {
        const cover = continueReading.manga.cover || getChapterImageUrl(continueReading.manga.chapters?.[0]?.images?.[0]);
        return (
          <button
            type="button"
            className="continue-reading"
            onClick={() => void openReader(continueReading.manga, continueReading.progress.chapterNumber)}
          >
            {cover && (
              <img 
                className="continue-reading-cover" 
                src={cover} 
                alt="" 
                loading="lazy" 
                referrerPolicy="no-referrer"
              />
            )}
            <span className="continue-reading-body">
              <span className="continue-reading-label">▶ Đọc tiếp</span>
              <span className="continue-reading-title">{continueReading.manga.title}</span>
              <span className="continue-reading-sub">
                {continueReading.progress.chapterName || `Chương ${continueReading.progress.chapterNumber}`}
              </span>
            </span>
          </button>
        );
      })()}

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

          {/* Button Cào truyện mới */}
          <button
            type="button"
            className="ngontinh-nav-tab-btn"
            onClick={() => setShowCrawlModal(true)}
            style={{
              background: 'linear-gradient(135deg, #e11d48, #be123c)',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            <Plus size={15} /> Paste link cào truyện
          </button>
        </div>

        <div className="ngontinh-search-wrapper">
          <Search size={16} className="ngontinh-search-icon" />
          <input
            type="text"
            placeholder={`Tìm kiếm trong ${mangaList.length || 'kho'} bộ truyện H...`}
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

      {/* Manga Grid View */}
      {loading && mangaList.length === 0 ? (
        <div className="ngontinh-loading-box">
          <div className="ngontinh-spinner" />
          <p>Đang tải danh sách truyện H...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="ngontinh-empty-state">
          <Bookmark size={40} className="ngontinh-empty-icon" />
          <h3>Không tìm thấy truyện phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác hoặc bấm nút <strong>"Paste link cào truyện"</strong> ở trên.</p>
        </div>
      ) : (
        <>
          <div className="ngontinh-manga-grid">
            {visibleItems.map(({ manga }) => {
              const isFav = favorites.includes(manga.slug);
              const userProgress = history[manga.slug];

              return (
                <HMangaCardItem
                  key={manga.slug}
                  manga={manga}
                  isFav={isFav}
                  userProgress={userProgress}
                  onToggleFav={handleToggleFav}
                  onOpenReader={openReader}
                  onClick={() => navigate(`/truyenh/${manga.slug}`)}
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
        <HMangaReaderModal
          manga={readingState.manga}
          initialChapterNum={readingState.chapterNum}
          onClose={() => {
            setReadingState(null);
            setHistory(getHMangaHistory());
          }}
        />
      )}
    </div>
  );
};
