import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Bookmark, ArrowUp } from 'lucide-react';
import type { BLManga, ChapterImage } from '../../types/manga';
import { fetchBLChapterImages, getMangaProgress, saveReadingProgress } from './mangaService';
import { fetchNgontinhChapterImages } from './ngontinhService';
import { recordMangaReading, useMangaReadingTracker } from '../../lib/mangaReadingLog';
import { ReaderControls, useAutoScroll, useReaderPrefs } from './readerControls';

interface Props {
  manga: BLManga;
  initialChapterNumber?: number;
  initialChapterNum?: number;
  onClose: () => void;
  onSelectChapter?: (chapterNumber: number) => void;
}

export const BLReaderModal: React.FC<Props> = ({
  manga,
  initialChapterNumber,
  initialChapterNum,
  onClose,
  onSelectChapter,
}) => {
  const startNum = initialChapterNumber ?? initialChapterNum ?? 1;
  const [currentChapterNum, setCurrentChapterNum] = useState<number>(startNum);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const topRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const { prefs, update: updatePrefs, readerStyle } = useReaderPrefs();
  const autoScroll = useAutoScroll(useCallback(() => mainRef.current, []), prefs.speed);

  const currentChapter = manga.chapters.find(c => c.number === currentChapterNum) || manga.chapters[0];
  const sortedChapters = [...manga.chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const currentIndex = sortedChapters.findIndex(c => c.number === currentChapterNum);
  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  // Tự động theo dõi thời gian đọc trên màn hình
  useMangaReadingTracker({
    mangaSlug: manga?.slug,
    mangaTitle: manga?.title,
    mangaType: 'BL',
    chapterNumber: currentChapter?.number ?? currentChapterNum,
    chapterName: currentChapter?.name || `Chương ${currentChapterNum}`,
    isActive: !!manga && !!currentChapter,
  });

  useEffect(() => {
    setCurrentChapterNum(initialChapterNumber ?? initialChapterNum ?? 1);
  }, [initialChapterNumber, initialChapterNum]);

  useEffect(() => {
    if (currentChapter) {
      const chNum = currentChapter.number ?? currentChapterNum;
      saveReadingProgress({
        slug: manga.slug,
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        readAt: new Date().toISOString(),
        totalImages: currentChapter.images?.length || 0,
      });

      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'BL',
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        status: 'READING',
      });

      // Vào đúng chương đang đọc dở thì trả về chỗ cũ, chương khác mới kéo lên đầu.
      const saved = getMangaProgress(manga.slug);
      const resumeRatio = saved && saved.chapterNumber === chNum ? saved.scrollRatio ?? 0 : 0;
      const el = mainRef.current;
      if (resumeRatio > 0.01 && el) {
        // Ảnh chưa tải xong thì scrollHeight còn ngắn; thử lại vài nhịp cho tới khi đủ dài.
        let tries = 0;
        const restore = () => {
          if (!mainRef.current) return;
          mainRef.current.scrollTop = mainRef.current.scrollHeight * resumeRatio;
          if (++tries < 20) setTimeout(restore, 250);
        };
        restore();
      } else {
        if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth' });
        if (el) el.scrollTop = 0;
      }
      setImageErrors({});
    }
  }, [currentChapter, currentChapterNum, manga.slug, manga.title]);

  // Track scrolling to mark chapter as completed when reached the end
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    let ticking = false;
    const handleScroll = () => {
      // Ghi vị trí đọc, gộp theo khung hình cho khỏi ghi localStorage liên tục.
      if (!ticking && currentChapter) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          const ratio = el.scrollHeight > 0 ? el.scrollTop / el.scrollHeight : 0;
          saveReadingProgress({
            slug: manga.slug,
            chapterNumber: currentChapter.number ?? currentChapterNum,
            chapterName: currentChapter.name,
            readAt: new Date().toISOString(),
            totalImages: currentChapter.images?.length || 0,
            scrollRatio: ratio,
          });
        });
      }

      const scrollBottom = el.scrollTop + el.clientHeight;
      // Quá 80% chương thì nạp ngầm chương kế, bấm "chương sau" là hiện ngay.
      if (el.scrollHeight > 0 && scrollBottom / el.scrollHeight > 0.8) preloadNext();
      const threshold = el.scrollHeight - 250;
      if (scrollBottom >= threshold && currentChapter) {
        recordMangaReading({
          mangaSlug: manga.slug,
          mangaTitle: manga.title,
          mangaType: 'BL',
          chapterNumber: currentChapter.number ?? currentChapterNum,
          chapterName: currentChapter.name,
          status: 'COMPLETED',
        });
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [currentChapter, currentChapterNum, manga.slug, manga.title]);

  const handleNext = () => {
    if (currentChapter) {
      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'BL',
        chapterNumber: currentChapter.number ?? currentChapterNum,
        chapterName: currentChapter.name,
        status: 'COMPLETED',
      });
    }
    if (nextChapter && nextChapter.number != null) {
      if (onSelectChapter) onSelectChapter(nextChapter.number);
      else setCurrentChapterNum(nextChapter.number);
    }
  };

  const handlePrev = () => {
    if (prevChapter && prevChapter.number != null) {
      if (onSelectChapter) onSelectChapter(prevChapter.number);
      else setCurrentChapterNum(prevChapter.number);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Danh sách truyện không kèm URL ảnh (file quá to để deploy), nên nạp riêng theo truyện.
  const [lazyImages, setLazyImages] = useState<Record<string, ChapterImage[]>>({});
  useEffect(() => {
    if (!currentChapter || (currentChapter.images?.length ?? 0) > 0) return;
    let alive = true;
    const key = String(currentChapter.number ?? '');
    if (manga.source === 'otruyen') {
      void fetchNgontinhChapterImages(manga.slug, currentChapter.number ?? 0).then((imgs) => {
        if (alive) setLazyImages((prev) => ({ ...prev, [key]: imgs }));
      });
    } else {
      void fetchBLChapterImages(manga.slug).then((byChapter) => {
        if (alive) setLazyImages(byChapter);
      });
    }
    return () => { alive = false; };
  }, [manga.slug, manga.source, currentChapter]);

  /** Nạp trước ảnh chương kế; chạy một lần cho mỗi chương nhờ cờ preloadedRef. */
  const preloadedRef = useRef<Set<number>>(new Set());
  const preloadNext = useCallback(() => {
    const num = nextChapter?.number;
    if (num == null || preloadedRef.current.has(num)) return;
    preloadedRef.current.add(num);

    const warm = (imgs: ChapterImage[] | undefined) => {
      for (const img of (imgs ?? []).slice(0, 5)) {
        const url = typeof img === 'string' ? img : img?.url;
        if (url) new Image().src = url;
      }
    };

    if (nextChapter?.images?.length) {
      warm(nextChapter.images);
    } else if (manga.source === 'otruyen') {
      void fetchNgontinhChapterImages(manga.slug, num).then((imgs) => {
        setLazyImages((prev) => ({ ...prev, [String(num)]: imgs }));
        warm(imgs);
      });
    } else {
      void fetchBLChapterImages(manga.slug).then((byChapter) => {
        setLazyImages((prev) => ({ ...prev, ...byChapter }));
        warm(byChapter[String(num)]);
      });
    }
  }, [nextChapter, manga.slug, manga.source]);

  const images =
    currentChapter?.images?.length
      ? currentChapter.images
      : lazyImages[String(currentChapter?.number ?? '')] || [];

  return (
    <div className="bl-reader-overlay">
      <div ref={topRef} />
      
      <ReaderControls running={autoScroll.running} onToggle={autoScroll.toggle} prefs={prefs} onChange={updatePrefs} />

      {/* Sleek Floating Reader Header */}
      <header className="bl-reader-header-compact">
        <div className="bl-reader-header-left">
          <button className="bl-reader-back-btn" onClick={onClose} title="Trở về">
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="bl-reader-header-right">
          {/* Quick Chapter Selector */}
          <select
            value={currentChapterNum}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (onSelectChapter) onSelectChapter(val);
              else setCurrentChapterNum(val);
            }}
            className="bl-chapter-picker"
          >
            {sortedChapters.map((ch) => (
              <option key={ch.url || ch.number} value={ch.number ?? 0}>
                {ch.name || `Chương ${ch.number}`}
              </option>
            ))}
          </select>

          <button
            className="bl-reader-nav-icon-btn"
            onClick={handlePrev}
            disabled={!prevChapter}
            title="Chương trước"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            className="bl-reader-nav-icon-btn"
            onClick={handleNext}
            disabled={!nextChapter}
            title="Chương sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Reader Body */}
      <main ref={mainRef} className="bl-reader-body" style={readerStyle}>
        {images.length > 0 ? (
          <div className="bl-reader-image-stream">
            {images.map((img, idx) => {
              const imgUrl = typeof img === 'string' ? img : (img.url || '');
              const imgAlt = (typeof img === 'object' && img.alt) ? img.alt : `Trang ${idx + 1}`;
              const hasError = imageErrors[idx];
              return (
                <div key={imgUrl || idx} className="bl-image-frame">
                  {hasError ? (
                    <div className="bl-image-error">
                      <p>Không thể tải ảnh {idx + 1}</p>
                      <a href={imgUrl} target="_blank" rel="noreferrer" className="bl-link-direct">
                        <ExternalLink size={14} /> Mở ảnh gốc
                      </a>
                    </div>
                  ) : (
                    <img
                      src={imgUrl}
                      alt={imgAlt}
                      loading={idx < 3 ? 'eager' : 'lazy'}
                      onError={() => setImageErrors(prev => ({ ...prev, [idx]: true }))}
                      className="bl-chapter-img"
                    />
                  )}
                  <span className="bl-page-badge">{idx + 1} / {images.length}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bl-reader-empty">
            <Bookmark size={36} className="bl-empty-icon" />
            <h3>Chương này chưa có sẵn ảnh trong bộ nhớ đệm</h3>
            <p>Bạn có thể mở đọc trực tiếp từ trang nguồn:</p>
            <a
              href={currentChapter?.url || manga.url}
              target="_blank"
              rel="noreferrer"
              className="bl-btn-primary"
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ExternalLink size={15} /> Mở trang {manga.sourceName || (manga.source === 'teamsany' ? 'Sany Team' : 'Dưa Leo')}
            </a>
          </div>
        )}

        {/* Bottom Navigator */}
        <div className="bl-reader-bottom-nav">
          <button
            className="bl-btn-nav-control"
            onClick={handlePrev}
            disabled={!prevChapter}
          >
            <ChevronLeft size={16} /> Trước
          </button>

          <button
            className="bl-btn-nav-control"
            onClick={() => {
              if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth' });
            }}
            title="Lên đầu trang"
          >
            <ArrowUp size={16} /> Đầu trang
          </button>

          <button
            className="bl-btn-nav-control is-primary"
            onClick={handleNext}
            disabled={!nextChapter}
          >
            Sau <ChevronRight size={16} />
          </button>
        </div>
      </main>
    </div>
  );
};
