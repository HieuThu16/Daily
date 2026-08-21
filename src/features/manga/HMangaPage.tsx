import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Heart, BookOpen, Clock, Play, 
  X, Bookmark, ChevronRight,
  Flame, Sparkles, Loader2, Plus, Download,
  Link as LinkIcon, CheckCircle2, AlertCircle, Clipboard
} from 'lucide-react';
import type { HManga } from './hMangaService';
import { 
  fetchHMangaList,
  getHMangaFavorites, toggleHMangaFavorite, 
  getHMangaHistory,
  crawlAndSaveStory
} from './hMangaService';
import { useScrollRestore } from '../shared';
import { useToast } from '../ToastContext';
import './ngontinhManga.css';

type MainTab = 'all' | 'history' | 'favorites';

interface CardProps {
  manga: HManga;
  isFav: boolean;
  userProgress?: { chapterNumber: number; chapterName?: string };
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

        {/* 18+ Badge */}
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

        {/* Fast Reader Action Overlay */}
        <div className="ngontinh-card-quick-actions">
          {userProgress ? (
            <button
              className="ngontinh-quick-read-btn resume"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReader(manga, userProgress.chapterNumber);
              }}
            >
              <Play size={13} fill="currentColor" /> Đọc tiếp C.{userProgress.chapterNumber}
            </button>
          ) : (
            <button
              className="ngontinh-quick-read-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReader(manga, firstCh);
              }}
            >
              <Play size={13} fill="currentColor" /> Đọc Chap {firstCh}
            </button>
          )}
        </div>
      </div>

      {/* Info Body */}
      <div className="ngontinh-info-body">
        <h3 className="ngontinh-manga-title" title={manga.title}>
          {manga.title}
        </h3>

        <div className="ngontinh-meta-row">
          <span className="ngontinh-author-tag">{manga.author || 'Đang cập nhật'}</span>
          <span className="ngontinh-status-dot" title={manga.status || 'Đang tiến hành'} />
        </div>

        {/* Genres tag preview */}
        {manga.genres && manga.genres.length > 0 && (
          <div className="ngontinh-genres-preview">
            {manga.genres.slice(0, 3).map((g, idx) => (
              <span key={idx} className="ngontinh-mini-genre">{g}</span>
            ))}
          </div>
        )}

        {/* Reading Progress Indicator */}
        {userProgress && (
          <div className="ngontinh-progress-pill">
            <Clock size={11} /> Đã đọc Chap {userProgress.chapterNumber}
          </div>
        )}
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
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Cào truyện từ MeTruyen18</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>Nhập bất kỳ link truyện hoặc link chapter</span>
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
              Đường dẫn truyện (metruyen18.app)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <LinkIcon size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted, #64748b)' }} />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://metruyen18.app/truyen/mot-buoc-len-may..."
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
              Ví dụ: <code>https://metruyen18.app/truyen/mot-buoc-len-may/chapter-1</code>
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

  useScrollRestore('truyenh-list', mangaList.length > 0);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchHMangaList();
      setMangaList(list);
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

  const handleToggleFav = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    toggleHMangaFavorite(slug);
    setFavorites(getHMangaFavorites());
  };

  const handleOpenReader = (manga: HManga, chapterNum: number) => {
    navigate(`/truyenh/${manga.slug}/read/${chapterNum}`);
  };

  const handleCrawlSuccess = (manga: HManga) => {
    showToast(`🎉 Đã cào thành công truyện "${manga.title}" (${manga.totalChapters} chương)!`);
    loadData();
    navigate(`/truyenh/${manga.slug}`);
  };

  // Filtered mangas
  const filteredList = useMemo(() => {
    let list = mangaList;

    if (activeTab === 'favorites') {
      list = list.filter(m => favorites.includes(m.slug));
    } else if (activeTab === 'history') {
      list = list.filter(m => !!history[m.slug]);
      list.sort((a, b) => {
        const tA = new Date(history[a.slug]?.readAt || 0).getTime();
        const tB = new Date(history[b.slug]?.readAt || 0).getTime();
        return tB - tA;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m => 
        m.title.toLowerCase().includes(q) || 
        m.author?.toLowerCase().includes(q) ||
        m.genres?.some(g => g.toLowerCase().includes(q))
      );
    }

    return list;
  }, [mangaList, activeTab, favorites, history, searchQuery]);

  return (
    <div className="ngontinh-page-container">
      <CrawlModal
        isOpen={showCrawlModal}
        onClose={() => setShowCrawlModal(false)}
        onSuccess={handleCrawlSuccess}
      />

      {/* Top Bar Navigation */}
      <div className="ngontinh-top-nav-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="ngontinh-nav-tabs">
            <button 
              className={`ngontinh-nav-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <Flame size={15} /> Tất cả ({mangaList.length})
            </button>
            <button 
              className={`ngontinh-nav-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              <Heart size={15} /> Yêu thích ({favorites.length})
            </button>
            <button 
              className={`ngontinh-nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <Clock size={15} /> Lịch sử ({Object.keys(history).length})
            </button>
          </div>

          {/* Button Cào truyện mới */}
          <button
            type="button"
            className="ngontinh-nav-tab-btn"
            onClick={() => setShowCrawlModal(true)}
            style={{
              background: 'linear-gradient(135deg, #e11d48, #be123c)',
              color: '#ffffff',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)',
            }}
          >
            <Plus size={16} /> Paste link cào truyện
          </button>
        </div>

        {/* Search Bar */}
        <div className="ngontinh-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm truyện H..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="ngontinh-loading-state">
          <Loader2 className="spinner" size={32} />
          <p>Đang tải danh sách truyện H...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="ngontinh-empty-state">
          <BookOpen size={48} />
          <h3>Không tìm thấy truyện nào</h3>
          <p>Bấm nút <strong>"Paste link cào truyện"</strong> ở trên để cào truyện từ metruyen18.app</p>
        </div>
      ) : (
        <div className="ngontinh-manga-grid">
          {filteredList.map((manga) => (
            <HMangaCardItem
              key={manga.slug}
              manga={manga}
              isFav={favorites.includes(manga.slug)}
              userProgress={history[manga.slug]}
              onToggleFav={handleToggleFav}
              onOpenReader={handleOpenReader}
              onClick={() => navigate(`/truyenh/${manga.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
