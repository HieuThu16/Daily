import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Bookmark, ArrowUp, RefreshCw, Sparkles } from 'lucide-react';
import type { HManga } from './hMangaService';
import { getHMangaProgress, saveHMangaProgress } from './hMangaService';
import { recordMangaReading, useMangaReadingTracker } from '../../lib/mangaReadingLog';
import { ReaderControls, useAutoScroll, useReaderPrefs } from './readerControls';
import './ngontinhReader.css';

interface Props {
  manga: HManga;
  initialChapterNumber?: number;
  initialChapterNum?: number;
  onClose: () => void;
  onSelectChapter?: (chapterNumber: number) => void;
}

export const HMangaReaderModal: React.FC<Props> = ({
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

  const isNavigatingRef = useRef(false);
  const lastChapterNumRef = useRef(currentChapterNum);

  // Tự động theo dõi thời gian đọc trên màn hình
  useMangaReadingTracker({
    mangaSlug: manga?.slug,
    mangaTitle: manga?.title,
    mangaType: 'H_MANGA',
    chapterNumber: currentChapter?.number ?? currentChapterNum,
    chapterName: currentChapter?.name || `Chapter ${currentChapterNum}`,
    isActive: !!manga && !!currentChapter,
  });

  useEffect(() => {
    setCurrentChapterNum(initialChapterNumber ?? initialChapterNum ?? 1);
  }, [initialChapterNumber, initialChapterNum]);

  useEffect(() => {
    if (currentChapter) {
      const chNum = currentChapter.number ?? currentChapterNum;
      const isDifferentChapter = lastChapterNumRef.current !== chNum;
      lastChapterNumRef.current = chNum;

      const currentImgs = currentChapter.images || [];

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
          if (!mainRef.current) return;
          const maxScroll = mainRef.current.scrollHeight - mainRef.current.clientHeight;
          if (maxScroll > 100) {
            mainRef.current.scrollTop = maxScroll * resumeRatio;
          } else if (tries < 10) {
            tries++;
            setTimeout(restore, 100);
          }
        };
        setTimeout(restore, 50);
      } else {
        if (mainRef.current) mainRef.current.scrollTop = 0;
      }

      setImageErrors({});
      const timer = setTimeout(() => {
        isNavigatingRef.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [manga, currentChapter, currentChapterNum]);

  // Scroll ratio & completed mark
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    let ticking = false;
    const handleScroll = () => {
      if (isNavigatingRef.current) return;
      if (!ticking && currentChapter) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          if (isNavigatingRef.current) return;
          saveHMangaProgress(manga.slug, {
            chapterNumber: currentChapter.number ?? currentChapterNum,
            chapterName: currentChapter.name,
            readAt: new Date().toISOString(),
            scrollRatio: el.scrollHeight > 0 ? el.scrollTop / el.scrollHeight : 0,
          });
        });
      }

      const scrollBottom = el.scrollTop + el.clientHeight;
      const threshold = el.scrollHeight - 250;
      if (scrollBottom >= threshold && currentChapter) {
        recordMangaReading({
          mangaSlug: manga.slug,
          mangaTitle: manga.title,
          mangaType: 'H_MANGA',
          chapterNumber: currentChapter.number ?? currentChapterNum,
          chapterName: currentChapter.name,
          status: 'COMPLETED',
        });
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [currentChapter, currentChapterNum, manga.slug, manga.title]);

  const handleNext = useCallback(() => {
    if (currentChapter) {
      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'H_MANGA',
        chapterNumber: currentChapter.number ?? currentChapterNum,
        chapterName: currentChapter.name,
        status: 'COMPLETED',
      });
    }
    if (nextChapter && nextChapter.number != null) {
      isNavigatingRef.current = true;
      saveHMangaProgress(manga.slug, {
        chapterNumber: nextChapter.number,
        chapterName: nextChapter.name || `Chapter ${nextChapter.number}`,
        scrollRatio: 0,
      });
      if (mainRef.current) mainRef.current.scrollTop = 0;
      if (onSelectChapter) onSelectChapter(nextChapter.number);
      else setCurrentChapterNum(nextChapter.number);
    }
  }, [currentChapter, currentChapterNum, manga.slug, manga.title, nextChapter, onSelectChapter]);

  const handlePrev = useCallback(() => {
    if (prevChapter && prevChapter.number != null) {
      isNavigatingRef.current = true;
      saveHMangaProgress(manga.slug, {
        chapterNumber: prevChapter.number,
        chapterName: prevChapter.name || `Chapter ${prevChapter.number}`,
        scrollRatio: 0,
      });
      if (mainRef.current) mainRef.current.scrollTop = 0;
      if (onSelectChapter) onSelectChapter(prevChapter.number);
      else setCurrentChapterNum(prevChapter.number);
    }
  }, [prevChapter, onSelectChapter, manga.slug]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const rawImages = currentChapter?.images || [];
  const images = rawImages.map(img => typeof img === 'string' ? { url: img, alt: 'Trang' } : img);

  return (
    <div className="ngontinh-reader-overlay">
      <div ref={topRef} />
      
      {/* Floating Reader Header */}
      <ReaderControls running={autoScroll.running} onToggle={autoScroll.toggle} prefs={prefs} onChange={updatePrefs} />

      <header className="ngontinh-reader-header-compact">
        <div className="ngontinh-reader-header-left">
          <button className="ngontinh-reader-back-btn" onClick={onClose} title="Trở về danh sách">
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="ngontinh-reader-header-right">
          {/* Quick Chapter Selector */}
          <select
            value={currentChapterNum}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (onSelectChapter) onSelectChapter(val);
              else setCurrentChapterNum(val);
              if (mainRef.current) mainRef.current.scrollTop = 0;
            }}
            className="ngontinh-chapter-picker"
          >
            {sortedChapters.map((ch) => (
              <option key={ch.url || ch.number} value={ch.number ?? 0}>
                {ch.name || `Chương ${ch.number}`}
              </option>
            ))}
          </select>

          <button
            className="ngontinh-reader-nav-icon-btn"
            onClick={handlePrev}
            disabled={!prevChapter}
            title="Chương trước (←)"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            className="ngontinh-reader-nav-icon-btn"
            onClick={handleNext}
            disabled={!nextChapter}
            title="Chương sau (→)"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Reader Body */}
      <main ref={mainRef} className="ngontinh-reader-body" style={readerStyle}>
        {images.length > 0 ? (
          <div className="ngontinh-reader-image-stream">
            {images.map((img, idx) => {
              const imgUrl = img.url || '';
              const imgAlt = img.alt || `Trang ${idx + 1}`;
              const hasError = imageErrors[idx];
              return (
                <div key={imgUrl || idx} className="ngontinh-image-frame">
                  {hasError ? (
                    <div className="ngontinh-image-error">
                      <p>Không thể tải ảnh {idx + 1}</p>
                      <a href={imgUrl} target="_blank" rel="noreferrer" className="ngontinh-link-direct">
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
                      className="ngontinh-chapter-img"
                    />
                  )}
                  <span className="ngontinh-page-badge">{idx + 1} / {images.length}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ngontinh-reader-empty">
            <Bookmark size={40} className="ngontinh-empty-icon" />
            <h3>Chương này chưa tải sẵn ảnh vào bộ nhớ</h3>
            <p>Bạn có thể mở đọc trực tiếp ngay trên trang gốc:</p>
            <a
              href={currentChapter?.url || manga.url}
              target="_blank"
              rel="noreferrer"
              className="ngontinh-btn-primary"
              style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <ExternalLink size={16} /> Mở đọc tại nguồn
            </a>
          </div>
        )}

        {/* Bottom Navigator */}
        <div className="ngontinh-reader-bottom-nav">
          <button
            className="ngontinh-btn-nav-control"
            onClick={handlePrev}
            disabled={!prevChapter}
          >
            <ChevronLeft size={16} /> Chương trước
          </button>

          <button
            className="ngontinh-btn-nav-control"
            onClick={() => {
              if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="Lên đầu trang"
          >
            <ArrowUp size={16} /> Đầu trang
          </button>

          <button
            className="ngontinh-btn-nav-control is-primary"
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
