import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Bookmark, ArrowUp, RefreshCw, BookOpen } from 'lucide-react';
import type { HManga } from './hMangaService';
import { getHMangaProgress, saveHMangaProgress } from './hMangaService';
import { recordMangaReading } from '../../lib/mangaReadingLog';
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

  useEffect(() => {
    setCurrentChapterNum(initialChapterNumber ?? initialChapterNum ?? 1);
  }, [initialChapterNumber, initialChapterNum]);

  useEffect(() => {
    if (currentChapter) {
      const chNum = currentChapter.number ?? currentChapterNum;
      const currentImgs = currentChapter.images || [];

      saveHMangaProgress(manga.slug, {
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        readAt: new Date().toISOString(),
        totalImages: currentImgs.length,
      });

      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'H_MANGA',
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        status: 'READING',
      });

      // Restore scroll
      const saved = getHMangaProgress(manga.slug);
      const resumeRatio = saved && saved.chapterNumber === chNum ? saved.scrollRatio ?? 0 : 0;
      if (resumeRatio > 0.01) {
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
    }
  }, [manga, currentChapter, currentChapterNum]);

  const handleScroll = () => {
    if (!mainRef.current || !currentChapter) return;
    const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
    const max = scrollHeight - clientHeight;
    if (max <= 0) return;
    const ratio = Math.max(0, Math.min(1, scrollTop / max));
    const chNum = currentChapter.number ?? currentChapterNum;
    saveHMangaProgress(manga.slug, {
      chapterNumber: chNum,
      chapterName: currentChapter.name,
      scrollRatio: ratio,
    });
  };

  const handleNext = () => {
    if (nextChapter && nextChapter.number != null) {
      setCurrentChapterNum(nextChapter.number);
      onSelectChapter?.(nextChapter.number);
      if (mainRef.current) mainRef.current.scrollTop = 0;
      setImageErrors({});
    }
  };

  const handlePrev = () => {
    if (prevChapter && prevChapter.number != null) {
      setCurrentChapterNum(prevChapter.number);
      onSelectChapter?.(prevChapter.number);
      if (mainRef.current) mainRef.current.scrollTop = 0;
      setImageErrors({});
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleRetryImage = (idx: number) => {
    setImageErrors(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const rawImages = currentChapter?.images || [];
  const images = rawImages.map(img => typeof img === 'string' ? { url: img, alt: 'Trang' } : img);

  return (
    <div className="ngontinh-reader-modal" ref={topRef}>
      {/* Top Floating Control Bar */}
      <header className="ngontinh-reader-top-bar">
        <div className="top-bar-left">
          <button className="ngontinh-reader-icon-btn" onClick={onClose} title="Đóng trình đọc">
            <ArrowLeft size={18} />
          </button>
          
          <div className="manga-title-wrap">
            <h2 className="reader-manga-title" title={manga.title}>{manga.title}</h2>
            <span className="reader-chapter-title">{currentChapter?.name || `Chapter ${currentChapterNum}`}</span>
          </div>
        </div>

        {/* Center Chapter Switcher */}
        <div className="top-bar-center">
          <button
            className="ch-nav-arrow"
            disabled={!prevChapter}
            onClick={handlePrev}
            title="Chương trước"
          >
            <ChevronLeft size={18} />
          </button>

          <select
            className="chapter-select-dropdown"
            value={currentChapter?.number ?? currentChapterNum}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentChapterNum(val);
              onSelectChapter?.(val);
              if (mainRef.current) mainRef.current.scrollTop = 0;
              setImageErrors({});
            }}
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
            onClick={handleNext}
            title="Chương sau"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Right Settings */}
        <div className="top-bar-right">
          <button 
            className="ngontinh-reader-icon-btn fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? '⤢' : '⤡'}
          </button>
        </div>
      </header>

      {/* Main Images Container */}
      <main 
        className="ngontinh-reader-body" 
        ref={mainRef}
        onScroll={handleScroll}
        style={readerStyle}
      >
        <div className="ngontinh-reader-images-flow">
          {images.length === 0 ? (
            <div className="ngontinh-no-images">
              <p>Chương này chưa có ảnh hoặc đang cập nhật.</p>
            </div>
          ) : (
            images.map((img, idx) => (
              <div key={idx} className="ngontinh-page-wrapper">
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
                    className="ngontinh-page-img"
                    loading={idx < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={() => setImageErrors(prev => ({ ...prev, [idx]: true }))}
                  />
                )}
                <span className="page-idx-pill">{idx + 1} / {images.length}</span>
              </div>
            ))
          )}
        </div>

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
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
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

      {/* Floating Reader Controls */}
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
      </div>
    </div>
  );
};
