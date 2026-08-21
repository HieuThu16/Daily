import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, 
  Bookmark, ArrowUp, RefreshCw, BookOpen 
} from 'lucide-react';
import type { HManga } from './hMangaService';
import { fetchHMangaList, getHMangaProgress, saveHMangaProgress } from './hMangaService';
import { useHideHeader } from '../HeaderAction';
import { ReaderControls, useAutoScroll, useReaderPrefs } from './readerControls';
import './ngontinhReader.css';

export const HMangaReaderPage: React.FC = () => {
  const { slug, chapterNum } = useParams<{ slug: string; chapterNum: string }>();
  const navigate = useNavigate();

  // Hide the global shell header to give full-screen reader immersion
  useHideHeader(true);

  const [manga, setManga] = useState<HManga | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fitMode, setFitMode] = useState<'standard' | 'wide' | 'full'>('standard');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const currentChapterNum = useMemo(() => {
    return chapterNum ? parseFloat(chapterNum) : 1;
  }, [chapterNum]);

  // Load Manga Info
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const list = await fetchHMangaList();
        if (isMounted && slug) {
          const found = list.find(m => m.slug === slug);
          if (found) setManga(found);
        }
      } catch (err) {
        console.error('Failed to load manga for reader', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [slug]);

  // Sorted chapters
  const sortedChapters = useMemo(() => {
    if (!manga || !manga.chapters) return [];
    return [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  }, [manga]);

  const currentIndex = sortedChapters.findIndex(c => c.number === currentChapterNum);
  const currentChapter = sortedChapters[currentIndex] || manga?.chapters.find(c => c.number === currentChapterNum) || sortedChapters[0];
  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  const { prefs, update: updatePrefs, readerStyle } = useReaderPrefs();
  const autoScroll = useAutoScroll(useCallback(() => null, []), prefs.speed);

  // Save reading progress & scroll to top on change
  useEffect(() => {
    if (manga && currentChapter) {
      const chNum = currentChapter.number ?? currentChapterNum;
      saveHMangaProgress(manga.slug, {
        chapterNumber: chNum,
        chapterName: currentChapter.name || `Chapter ${chNum}`,
      });
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      setImageErrors({});
    }
  }, [manga, currentChapter, currentChapterNum]);

  // Scroll percentage tracker
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = Math.min(100, Math.max(0, Math.round((window.scrollY / totalHeight) * 100)));
        setScrollProgress(currentProgress);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChapterChange = (newChNum: number) => {
    if (slug) {
      navigate(`/truyenh/${slug}/read/${newChNum}`);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleImageError = (idx: number) => {
    setImageErrors(prev => ({ ...prev, [idx]: true }));
  };

  const handleRetryImage = (idx: number) => {
    setImageErrors(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="ngontinh-reader-page loading">
        <div className="reader-loading-state">
          <div className="spinner" />
          <p>Đang tải chương truyện...</p>
        </div>
      </div>
    );
  }

  if (!manga || !currentChapter) {
    return (
      <div className="ngontinh-reader-page empty">
        <div className="reader-empty-box">
          <BookOpen size={48} />
          <h2>Không tìm thấy chương truyện</h2>
          <button className="primary-btn" onClick={() => navigate(slug ? `/truyenh/${slug}` : '/truyenh')}>
            <ArrowLeft size={16} /> Quay lại trang truyện
          </button>
        </div>
      </div>
    );
  }

  const rawImages = currentChapter.images || [];
  const images = rawImages.map(img => typeof img === 'string' ? { url: img, alt: 'Trang' } : img);

  return (
    <div className={`ngontinh-reader-page fit-${fitMode}`} style={readerStyle}>
      {/* Top Floating Control Bar */}
      <header className="reader-top-bar">
        <div className="top-bar-left">
          <button 
            className="reader-icon-btn back-btn" 
            onClick={() => navigate(`/truyenh/${slug}`)}
            title="Quay lại chi tiết truyện"
          >
            <ArrowLeft size={18} />
          </button>
          
          <div className="manga-title-wrap">
            <h1 className="reader-manga-title" title={manga.title}>{manga.title}</h1>
            <span className="reader-chapter-title">{currentChapter.name}</span>
          </div>
        </div>

        {/* Center Chapter Switcher */}
        <div className="top-bar-center">
          <button
            className="ch-nav-arrow"
            disabled={!prevChapter}
            onClick={() => prevChapter && handleChapterChange(prevChapter.number!)}
            title="Chương trước"
          >
            <ChevronLeft size={18} />
          </button>

          <select
            className="chapter-select-dropdown"
            value={currentChapter.number ?? currentChapterNum}
            onChange={(e) => handleChapterChange(parseFloat(e.target.value))}
          >
            {sortedChapters.map((c) => (
              <option key={c.number} value={c.number!}>
                {c.name} {c.title ? `- ${c.title}` : ''}
              </option>
            ))}
          </select>

          <button
            className="ch-nav-arrow"
            disabled={!nextChapter}
            onClick={() => nextChapter && handleChapterChange(nextChapter.number!)}
            title="Chương sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Right Settings */}
        <div className="top-bar-right">
          <div className="fit-mode-group">
            <button 
              className={`fit-btn ${fitMode === 'standard' ? 'active' : ''}`}
              onClick={() => setFitMode('standard')}
              title="Vừa màn hình (Chuẩn)"
            >
              Chuẩn
            </button>
            <button 
              className={`fit-btn ${fitMode === 'wide' ? 'active' : ''}`}
              onClick={() => setFitMode('wide')}
              title="Rộng hơn"
            >
              Rộng
            </button>
            <button 
              className={`fit-btn ${fitMode === 'full' ? 'active' : ''}`}
              onClick={() => setFitMode('full')}
              title="Toàn màn hình (100% width)"
            >
              Tràn
            </button>
          </div>

          <button 
            className="reader-icon-btn fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? '⤢' : '⤡'}
          </button>
        </div>
      </header>

      {/* Progress Bar Top Fixed */}
      <div className="reader-progress-track">
        <div className="reader-progress-bar" style={{ width: `${scrollProgress}%` }} />
      </div>

      {/* Reading Images Main Container */}
      <main className="reader-image-container">
        {images.length === 0 ? (
          <div className="no-images-notice">
            <p>Chương này chưa có ảnh hoặc đang được cập nhật.</p>
          </div>
        ) : (
          images.map((img, idx) => (
            <div key={idx} className="reader-image-wrapper" id={`page-${idx + 1}`}>
              {imageErrors[idx] ? (
                <div className="image-error-fallback">
                  <p>Không thể tải trang {idx + 1}</p>
                  <button className="retry-btn" onClick={() => handleRetryImage(idx)}>
                    <RefreshCw size={14} /> Thử lại
                  </button>
                </div>
              ) : (
                <img
                  src={img.url}
                  alt={img.alt || `Trang ${idx + 1}`}
                  className="manga-page-image"
                  loading={idx < 3 ? 'eager' : 'lazy'}
                  decoding="async"
                  onError={() => handleImageError(idx)}
                />
              )}
              <div className="page-number-tag">{idx + 1} / {images.length}</div>
            </div>
          ))
        )}
      </main>

      {/* Bottom Chapter Navigation */}
      <footer className="reader-bottom-nav">
        <div className="bottom-nav-inner">
          <button
            className="bottom-nav-btn prev"
            disabled={!prevChapter}
            onClick={() => prevChapter && handleChapterChange(prevChapter.number!)}
          >
            <ChevronLeft size={18} /> Chương trước
          </button>

          <span className="bottom-ch-indicator">
            {currentChapter.name}
          </span>

          <button
            className="bottom-nav-btn next"
            disabled={!nextChapter}
            onClick={() => nextChapter && handleChapterChange(nextChapter.number!)}
          >
            Chương sau <ChevronRight size={18} />
          </button>
        </div>
      </footer>

      {/* Floating Action Controls */}
      <div className="reader-floating-actions">
        {autoScroll.running && (
          <div className="auto-scroll-badge">
            Cuộn tự động: x{prefs.speed}
          </div>
        )}

        <ReaderControls
          running={autoScroll.running}
          onToggle={autoScroll.toggle}
          prefs={prefs}
          onChange={updatePrefs}
        />

        <button className="floating-btn scroll-top" onClick={scrollToTop} title="Lên đầu trang">
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
};
