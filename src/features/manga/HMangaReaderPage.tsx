import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, 
  ExternalLink, Bookmark, ArrowUp, RefreshCw, Sparkles, BookOpen,
  Camera, Images
} from 'lucide-react';
import type { HManga } from './hMangaService';
import { fetchHMangaList, getHMangaProgress, saveHMangaProgress } from './hMangaService';
import { 
  getHMangaScreenshots, saveHMangaScreenshot, deleteHMangaScreenshot,
  type HMangaScreenshot 
} from './hMangaScreenshot';
import { HMangaScreenshotGalleryModal } from './HMangaScreenshotGalleryModal';
import { useToast } from '../ToastContext';
import { recordMangaReading, useMangaReadingTracker } from '../../lib/mangaReadingLog';
import { useHideHeader } from '../HeaderAction';
import { ReaderControls, useAutoScroll, useReaderPrefs } from './readerControls';
import './ngontinhReader.css';

export const HMangaReaderPage: React.FC = () => {
  const { slug, chapterNum } = useParams<{ slug: string; chapterNum: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Hide the global shell header to give full-screen reader immersion
  useHideHeader(true);

  const [manga, setManga] = useState<HManga | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fitMode, setFitMode] = useState<'standard' | 'wide' | 'full'>('standard');
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  // Screenshot capture & gallery states
  const [capturing, setCapturing] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [showScreenshotGallery, setShowScreenshotGallery] = useState<boolean>(false);
  const [screenshots, setScreenshots] = useState<HMangaScreenshot[]>([]);

  useEffect(() => {
    setScreenshots(getHMangaScreenshots());
  }, []);

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

  const isNavigatingRef = useRef(false);
  const lastChapterNumRef = useRef(currentChapterNum);

  // Tự động theo dõi thời gian đọc trên màn hình
  useMangaReadingTracker({
    mangaSlug: manga?.slug,
    mangaTitle: manga?.title,
    mangaType: 'H_MANGA',
    chapterNumber: currentChapter?.number ?? currentChapterNum,
    chapterName: currentChapter?.name || `Chapter ${currentChapterNum}`,
    isActive: !loading && !!manga && !!currentChapter,
  });

  // Save reading progress & scroll to top on change
  useEffect(() => {
    if (manga && currentChapter) {
      const chNum = currentChapter.number ?? currentChapterNum;
      const isDifferentChapter = lastChapterNumRef.current !== chNum;
      lastChapterNumRef.current = chNum;

      const currentImgs = currentChapter.images || [];

      // Nếu chuyển qua chương mới thì vị trí cuộn luôn bắt đầu từ đầu trang (0)
      const saved = getHMangaProgress(manga.slug);
      const isSameChapter = saved && saved.chapterNumber === chNum;
      const resumeRatio = (!isDifferentChapter && isSameChapter) ? (saved.scrollRatio ?? 0) : 0;

      saveHMangaProgress(manga.slug, {
        chapterNumber: chNum,
        chapterName: currentChapter.name || `Chapter ${chNum}`,
        readAt: new Date().toISOString(),
        totalImages: currentImgs.length,
        scrollRatio: resumeRatio,
      });

      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'H_MANGA',
        chapterNumber: chNum,
        chapterName: currentChapter.name || `Chapter ${chNum}`,
        status: 'READING',
      });

      if (resumeRatio > 0.01 && resumeRatio < 0.85) {
        let tries = 0;
        const restore = () => {
          const total = document.documentElement.scrollHeight - window.innerHeight;
          if (total > 0) window.scrollTo({ top: total * resumeRatio, behavior: 'instant' as ScrollBehavior });
          if (++tries < 20) setTimeout(restore, 250);
        };
        restore();
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }

      setImageErrors({});
      const timer = setTimeout(() => {
        isNavigatingRef.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [manga, currentChapter, currentChapterNum]);

  // Track scroll progress & mark completed when scrolling near bottom
  useEffect(() => {
    const handleScroll = () => {
      if (isNavigatingRef.current) return;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0) {
        const progress = (window.scrollY / total) * 100;
        setScrollProgress(progress);
        if (manga && currentChapter) {
          saveHMangaProgress(manga.slug, {
            chapterNumber: currentChapter.number ?? currentChapterNum,
            chapterName: currentChapter.name,
            readAt: new Date().toISOString(),
            scrollRatio: window.scrollY / total,
          });
        }
        if (progress >= 85 && manga && currentChapter) {
          recordMangaReading({
            mangaSlug: manga.slug,
            mangaTitle: manga.title,
            mangaType: 'H_MANGA',
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
    isNavigatingRef.current = true;
    if (manga && currentChapter) {
      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'H_MANGA',
        chapterNumber: currentChapter.number ?? currentChapterNum,
        chapterName: currentChapter.name,
        status: 'COMPLETED',
      });
      saveHMangaProgress(manga.slug, {
        chapterNumber: chNum,
        chapterName: `Chapter ${chNum}`,
        scrollRatio: 0,
      });
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    if (slug) {
      navigate(`/truyenh/${slug}/read/${chNum}`);
    }
  }, [manga, currentChapter, currentChapterNum, navigate, slug]);

  const handleNext = useCallback(() => {
    if (nextChapter && nextChapter.number != null) {
      goToChapter(nextChapter.number);
    }
  }, [nextChapter, goToChapter]);

  const handleCaptureScreenshot = async () => {
    if (!manga || !currentChapter || capturing) return;
    setCapturing(true);

    try {
      const imgElements = Array.from(document.querySelectorAll<HTMLImageElement>('.ngontinh-reader-image'));
      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportHeight / 2;

      let targetImg: HTMLImageElement | null = null;
      let targetIndex = 0;

      for (let i = 0; i < imgElements.length; i++) {
        const rect = imgElements[i].getBoundingClientRect();
        if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
          targetImg = imgElements[i];
          targetIndex = i;
          break;
        }
      }

      if (!targetImg && imgElements.length > 0) {
        for (let i = 0; i < imgElements.length; i++) {
          const rect = imgElements[i].getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < viewportHeight) {
            targetImg = imgElements[i];
            targetIndex = i;
            break;
          }
        }
      }

      let dataUrl = '';

      if (targetImg && targetImg.naturalWidth > 0 && targetImg.naturalHeight > 0) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const rect = targetImg.getBoundingClientRect();

          const visibleTop = Math.max(0, -rect.top);
          const visibleHeight = Math.min(rect.height, viewportHeight - Math.max(0, rect.top));

          const scaleY = targetImg.naturalHeight / rect.height;
          const cropTop = visibleTop * scaleY;
          const cropHeight = Math.max(120, visibleHeight * scaleY);

          canvas.width = Math.min(800, targetImg.naturalWidth);
          const destHeight = Math.round((canvas.width / targetImg.naturalWidth) * cropHeight);
          canvas.height = destHeight;

          if (ctx) {
            ctx.drawImage(
              targetImg,
              0, cropTop, targetImg.naturalWidth, cropHeight,
              0, 0, canvas.width, destHeight
            );
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch {
          // If canvas is tainted or cross-origin blocked, fallback to direct img URL
          dataUrl = targetImg.src;
        }
      }

      if (!dataUrl && targetImg) {
        dataUrl = targetImg.src;
      }

      if (!dataUrl) {
        showToast('⚠️ Không tìm thấy khung ảnh đang hiển thị để chụp.');
        return;
      }

      const totalH = document.documentElement.scrollHeight - window.innerHeight;
      const scrollRatio = totalH > 0 ? window.scrollY / totalH : 0;

      const saved = await saveHMangaScreenshot({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        chapterNumber: currentChapter.number ?? currentChapterNum,
        chapterName: currentChapter.name || `Chapter ${currentChapterNum}`,
        pageIndex: targetIndex + 1,
        scrollRatio,
        imageData: dataUrl,
      });

      setScreenshots(prev => [saved, ...prev.filter(s => s.id !== saved.id)]);

      // Flash shutter animation
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 350);

      showToast(`📸 Đã chụp & lưu trang ${targetIndex + 1} (${currentChapter.name || `Chapter ${currentChapterNum}`})!`);
    } catch (err: any) {
      console.error('Screenshot error', err);
      showToast('❌ Lỗi khi chụp màn hình');
    } finally {
      setCapturing(false);
    }
  };

  const handleSelectScreenshot = (shot: HMangaScreenshot) => {
    if (shot.mangaSlug !== manga?.slug) {
      navigate(`/truyenh/${shot.mangaSlug}/read/${shot.chapterNumber}`);
      return;
    }
    if (shot.chapterNumber !== (currentChapter?.number ?? currentChapterNum)) {
      goToChapter(shot.chapterNumber);
      return;
    }
    if (shot.scrollRatio != null) {
      const totalH = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: totalH * shot.scrollRatio, behavior: 'smooth' });
    }
  };

  const handleDeleteScreenshot = async (id: string) => {
    await deleteHMangaScreenshot(id);
    setScreenshots(prev => prev.filter(s => s.id !== id));
    showToast('🗑️ Đã xóa ảnh chụp');
  };

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
        if (slug) navigate(`/truyenh/${slug}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, navigate, slug]);

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
          <button className="ngontinh-reader-nav-btn primary" onClick={() => navigate('/truyenh')}>
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const rawImages = currentChapter?.images || [];
  const images = rawImages.map(img => typeof img === 'string' ? { url: img, alt: 'Trang' } : img);

  return (
    <div className="ngontinh-reader-page">
      {/* Top Floating Bar */}
      <header className="ngontinh-reader-top-bar">
        <div className="ngontinh-reader-left">
          <button 
            className="ngontinh-reader-back-link" 
            onClick={() => navigate(`/truyenh/${manga.slug}`)}
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

          {/* Snapshot Button */}
          <button
            className="ngontinh-reader-btn-icon"
            onClick={handleCaptureScreenshot}
            disabled={capturing}
            title="Chụp lưu ảnh trang đang xem vào cơ sở dữ liệu"
            style={{
              color: '#ec4899',
              background: 'rgba(236, 72, 153, 0.15)',
              border: '1px solid rgba(236, 72, 153, 0.3)',
            }}
          >
            <Camera size={18} />
          </button>

          {/* Screenshot Gallery Button */}
          <button
            className="ngontinh-reader-btn-icon"
            onClick={() => setShowScreenshotGallery(true)}
            title={`Kho ảnh chụp (${screenshots.length})`}
            style={{
              position: 'relative',
              color: screenshots.length > 0 ? '#f472b6' : 'currentColor',
            }}
          >
            <Images size={18} />
            {screenshots.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  backgroundColor: '#ec4899',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '1px 4px',
                  lineHeight: 1,
                }}
              >
                {screenshots.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Camera Shutter Flash Overlay */}
      {isFlashing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#ffffff',
            opacity: 0.85,
            zIndex: 10000,
            pointerEvents: 'none',
            transition: 'opacity 0.35s ease-out',
          }}
        />
      )}

      {/* Screenshot Gallery Modal */}
      <HMangaScreenshotGalleryModal
        isOpen={showScreenshotGallery}
        onClose={() => setShowScreenshotGallery(false)}
        screenshots={screenshots}
        onSelectScreenshot={handleSelectScreenshot}
        onDeleteScreenshot={handleDeleteScreenshot}
      />

      {/* Progress Line */}
      <div className="ngontinh-reader-progress-line" style={{ width: `${scrollProgress}%` }} />

      {/* Floating Reader Settings */}
      <ReaderControls running={autoScroll.running} onToggle={autoScroll.toggle} prefs={prefs} onChange={updatePrefs} />

      <main className={`ngontinh-reader-main-stream fit-${fitMode}`} style={readerStyle}>
        {images.length > 0 ? (
          images.map((img, idx) => {
            const imgUrl = img.url || '';
            const imgAlt = img.alt || `Trang ${idx + 1}`;
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
            <p>Bạn có thể mở đọc trực tiếp ngay trên trang gốc:</p>
            <a
              href={currentChapter?.url || manga.url}
              target="_blank"
              rel="noreferrer"
              className="ngontinh-reader-nav-btn primary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={16} /> Đọc trên nguồn gốc
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
