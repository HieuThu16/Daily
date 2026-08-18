import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, 
  ExternalLink, Bookmark, ArrowUp, RefreshCw, Sparkles, BookOpen 
} from 'lucide-react';
import type { NgontinhManga } from '../../types/manga';
import { fetchNgontinhList, saveNgontinhProgress, fetchNgontinhChapterImages } from './ngontinhService';
import { hydrateMangadexManga } from './mangadexService';
import { recordMangaReading } from '../../lib/mangaReadingLog';
import { useHideHeader } from '../HeaderAction';
import './ngontinhReader.css';

export const NgontinhReaderPage: React.FC = () => {
  const { slug, chapterNum } = useParams<{ slug: string; chapterNum: string }>();
  const navigate = useNavigate();

  // Hide the global shell header to give full-screen reader immersion
  useHideHeader(true);

  const [manga, setManga] = useState<NgontinhManga | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchingChapterImages, setFetchingChapterImages] = useState<boolean>(false);
  const [dynamicChapterImages, setDynamicChapterImages] = useState<Record<number, any[]>>({});
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
        const list = await fetchNgontinhList();
        if (isMounted && slug) {
          const found = list.find(m => m.slug === slug);
          if (found) setManga(await hydrateMangadexManga(found));
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

  // Dynamically fetch images if chapter has no images
  useEffect(() => {
    let isMounted = true;
    const loadImagesIfNeeded = async () => {
      if (!manga || !currentChapter) return;
      const cachedImages = currentChapter.images || [];
      const dynamic = dynamicChapterImages[currentChapterNum];

      if (cachedImages.length === 0 && (!dynamic || dynamic.length === 0)) {
        setFetchingChapterImages(true);
        try {
          const fetched = await fetchNgontinhChapterImages(manga, currentChapterNum);
          if (isMounted && fetched.length > 0) {
            setDynamicChapterImages(prev => ({ ...prev, [currentChapterNum]: fetched }));
          }
        } finally {
          if (isMounted) setFetchingChapterImages(false);
        }
      }
    };

    loadImagesIfNeeded();
    return () => { isMounted = false; };
  }, [manga, currentChapter, currentChapterNum, dynamicChapterImages]);

  // Save reading progress & scroll to top on change
  useEffect(() => {
    if (manga && currentChapter) {
      const chNum = currentChapter.number ?? currentChapterNum;
      const currentImgs = (currentChapter.images && currentChapter.images.length > 0) 
        ? currentChapter.images 
        : (dynamicChapterImages[chNum] || []);

      saveNgontinhProgress({
        slug: manga.slug,
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        readAt: new Date().toISOString(),
        totalImages: currentImgs.length,
      });

      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'NGONTINH',
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        status: 'READING',
      });

      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      setImageErrors({});
    }
  }, [manga, currentChapter, currentChapterNum, dynamicChapterImages]);

  // Track scroll progress & mark completed when scrolling near bottom
  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0) {
        const progress = (window.scrollY / total) * 100;
        setScrollProgress(progress);
        if (progress >= 85 && manga && currentChapter) {
          recordMangaReading({
            mangaSlug: manga.slug,
            mangaTitle: manga.title,
            mangaType: 'NGONTINH',
            chapterNumber: currentChapter.number ?? currentChapterNum,
            chapterName: currentChapter.name,
            status: 'COMPLETED',
          });
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [manga, currentChapter, currentChapterNum]);

  const goToChapter = useCallback((chNum: number) => {
    if (manga && currentChapter) {
      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'NGONTINH',
        chapterNumber: currentChapter.number ?? currentChapterNum,
        chapterName: currentChapter.name,
        status: 'COMPLETED',
      });
    }
    if (slug) {
      navigate(`/ngontinh/${slug}/read/${chNum}`);
    }
  }, [manga, currentChapter, currentChapterNum, navigate, slug]);

  const handleNext = useCallback(() => {
    if (nextChapter && nextChapter.number != null) {
      goToChapter(nextChapter.number);
    }
  }, [nextChapter, goToChapter]);

  const handlePrev = useCallback(() => {
    if (prevChapter && prevChapter.number != null) {
      goToChapter(prevChapter.number);
    }
  }, [prevChapter, goToChapter]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        handlePrev();
      } else if (e.key === 'Escape') {
        if (slug) navigate(`/ngontinh/${slug}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, navigate, slug]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const cycleFitMode = () => {
    if (fitMode === 'standard') setFitMode('wide');
    else if (fitMode === 'wide') setFitMode('full');
    else setFitMode('standard');
  };

  if (loading) {
    return (
      <div className="ngontinh-reader-page" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <Sparkles className="animate-spin" size={32} style={{ margin: '0 auto 12px auto', color: '#f43f5e' }} />
          <p>Đang tải chương truyện...</p>
        </div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="ngontinh-reader-page" style={{ justifyContent: 'center' }}>
        <div className="ngontinh-reader-source-notice">
          <Bookmark size={48} color="#f43f5e" />
          <h2>Không tìm thấy truyện</h2>
          <p>Không tìm thấy dữ liệu cho bộ truyện này.</p>
          <button className="ngontinh-reader-nav-btn primary" onClick={() => navigate('/ngontinh')}>
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const images = (currentChapter?.images && currentChapter.images.length > 0)
    ? currentChapter.images
    : (dynamicChapterImages[currentChapterNum] || []);

  return (
    <div className="ngontinh-reader-page">
      {/* Top Floating Bar */}
      <header className="ngontinh-reader-top-bar">
        <div className="ngontinh-reader-left">
          <button 
            className="ngontinh-reader-back-link" 
            onClick={() => navigate(`/ngontinh/${manga.slug}`)}
            title="Quay lại trang chi tiết"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="ngontinh-reader-right">
          {/* Chapter selector */}
          <select
            value={currentChapterNum}
            onChange={(e) => goToChapter(Number(e.target.value))}
            className="ngontinh-reader-select"
          >
            {sortedChapters.map((ch) => (
              <option key={ch.url || ch.number} value={ch.number ?? 0}>
                {ch.name || `Chap ${ch.number}`}
              </option>
            ))}
          </select>

          {/* Prev Chapter */}
          <button
            className="ngontinh-reader-btn-icon"
            onClick={handlePrev}
            disabled={!prevChapter}
            title="Chương trước (←)"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Next Chapter */}
          <button
            className="ngontinh-reader-btn-icon"
            onClick={handleNext}
            disabled={!nextChapter}
            title="Chương sau (→)"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Progress Line */}
      <div className="ngontinh-reader-progress-line" style={{ width: `${scrollProgress}%` }} />

      {/* Image Stream */}
      <main className={`ngontinh-reader-main-stream fit-${fitMode}`}>
        {fetchingChapterImages ? (
          <div className="ngontinh-reader-source-notice" style={{ padding: '60px 20px' }}>
            <Sparkles className="animate-spin" size={36} color="#f43f5e" style={{ margin: '0 auto 12px auto' }} />
            <h3>Đang tải ảnh chương {currentChapterNum}...</h3>
            <p>Vui lòng đợi giây lát để hệ thống kết nối máy chủ ảnh.</p>
          </div>
        ) : images.length > 0 ? (
          images.map((img, idx) => {
            const imgUrl = typeof img === 'string' ? img : (img.url || '');
            const imgAlt = (typeof img === 'object' && img.alt) ? img.alt : `Trang ${idx + 1}`;
            const hasError = imageErrors[idx];
            return (
              <div key={imgUrl || idx} className="ngontinh-reader-img-card">
                {hasError ? (
                  <div className="ngontinh-img-fallback">
                    <p>Không thể hiển thị trang {idx + 1}</p>
                    <a href={imgUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Mở ảnh gốc
                    </a>
                  </div>
                ) : (
                  <img
                    src={imgUrl}
                    alt={imgAlt}
                    loading={idx < 3 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                    onError={() => setImageErrors(prev => ({ ...prev, [idx]: true }))}
                    className="ngontinh-reader-image"
                  />
                )}
                <span className="ngontinh-page-indicator-pill">
                  {idx + 1} / {images.length}
                </span>
              </div>
            );
          })
        ) : (
          <div className="ngontinh-reader-source-notice">
            <BookOpen size={44} color="#f43f5e" />
            <h3>Chương này chưa có sẵn ảnh trong bộ đệm</h3>
            <p>Bạn có thể mở đọc trực tiếp ngay trên trang gốc NetTruyen:</p>
            <a
              href={currentChapter?.url || manga.url}
              target="_blank"
              rel="noreferrer"
              className="ngontinh-reader-nav-btn primary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={16} /> Đọc trên NetTruyen
            </a>
          </div>
        )}

        {/* Next Chapter Prompt Bar */}
        {nextChapter && (
          <div className="ngontinh-next-chap-floating">
            <div>
              <div className="ngontinh-next-chap-text">Hết {currentChapter?.name || `Chapter ${currentChapterNum}`}</div>
              <div className="ngontinh-next-chap-sub">Tiếp theo: {nextChapter.name}</div>
            </div>
            <button 
              className="ngontinh-reader-nav-btn primary"
              onClick={handleNext}
            >
              Đọc tiếp <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Bottom Navigator */}
        <div className="ngontinh-reader-bottom-bar">
          <button
            className="ngontinh-reader-nav-btn"
            onClick={handlePrev}
            disabled={!prevChapter}
          >
            <ChevronLeft size={16} /> Chương trước
          </button>

          <button
            className="ngontinh-reader-nav-btn"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ArrowUp size={16} /> Đầu trang
          </button>

          <button
            className="ngontinh-reader-nav-btn primary"
            onClick={handleNext}
            disabled={!nextChapter}
          >
            Chương sau <ChevronRight size={16} />
          </button>
        </div>
      </main>
    </div>
  );
};
