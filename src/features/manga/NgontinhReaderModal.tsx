import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, ExternalLink, Bookmark, ArrowUp, RefreshCw } from 'lucide-react';
import type { NgontinhManga } from '../../types/manga';
import { saveNgontinhProgress } from './ngontinhService';
import { recordMangaReading } from '../../lib/mangaReadingLog';

interface Props {
  manga: NgontinhManga;
  initialChapterNumber?: number;
  initialChapterNum?: number;
  onClose: () => void;
  onSelectChapter?: (chapterNumber: number) => void;
}

export const NgontinhReaderModal: React.FC<Props> = ({
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
      saveNgontinhProgress({
        slug: manga.slug,
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        readAt: new Date().toISOString(),
        totalImages: currentChapter.images?.length || 0,
      });

      recordMangaReading({
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaType: 'NGONTINH',
        chapterNumber: chNum,
        chapterName: currentChapter.name,
        status: 'READING',
      });

      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
      setImageErrors({});
    }
  }, [currentChapter, currentChapterNum, manga.slug, manga.title]);

  // Track scrolling to mark chapter as completed when reached the end
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollBottom = el.scrollTop + el.clientHeight;
      const threshold = el.scrollHeight - 250;
      if (scrollBottom >= threshold && currentChapter) {
        recordMangaReading({
          mangaSlug: manga.slug,
          mangaTitle: manga.title,
          mangaType: 'NGONTINH',
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
        mangaType: 'NGONTINH',
        chapterNumber: currentChapter.number ?? currentChapterNum,
        chapterName: currentChapter.name,
        status: 'COMPLETED',
      });
    }
    if (nextChapter && nextChapter.number != null) {
      if (onSelectChapter) onSelectChapter(nextChapter.number);
      else setCurrentChapterNum(nextChapter.number);
    }
  }, [currentChapter, currentChapterNum, manga.slug, manga.title, nextChapter, onSelectChapter]);

  const handlePrev = useCallback(() => {
    if (prevChapter && prevChapter.number != null) {
      if (onSelectChapter) onSelectChapter(prevChapter.number);
      else setCurrentChapterNum(prevChapter.number);
    }
  }, [prevChapter, onSelectChapter]);

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const images = currentChapter?.images || [];

  return (
    <div className="ngontinh-reader-overlay">
      <div ref={topRef} />
      
      {/* Floating Reader Header */}
      <header className="ngontinh-reader-header-compact">
        <div className="ngontinh-reader-header-left">
          <button className="ngontinh-reader-back-btn" onClick={onClose} title="Trở về danh sách">
            <ArrowLeft size={18} />
          </button>
          <div className="ngontinh-reader-info-compact">
            <span className="ngontinh-reader-manga-title">{manga.title}</span>
            <span className="ngontinh-reader-chapter-sub">{currentChapter?.name || `Chương ${currentChapterNum}`}</span>
          </div>
        </div>

        <div className="ngontinh-reader-header-right">
          {/* Quick Chapter Selector */}
          <select
            value={currentChapterNum}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (onSelectChapter) onSelectChapter(val);
              else setCurrentChapterNum(val);
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

          <button
            className="ngontinh-reader-nav-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Reader Body */}
      <main ref={mainRef} className="ngontinh-reader-body">
        {images.length > 0 ? (
          <div className="ngontinh-reader-image-stream">
            {images.map((img, idx) => {
              const hasError = imageErrors[idx];
              return (
                <div key={img.url || idx} className="ngontinh-image-frame">
                  {hasError ? (
                    <div className="ngontinh-image-error">
                      <p>Không thể tải ảnh {idx + 1}</p>
                      <a href={img.url} target="_blank" rel="noreferrer" className="ngontinh-link-direct">
                        <ExternalLink size={14} /> Mở ảnh gốc
                      </a>
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={img.alt || `Trang ${idx + 1}`}
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
            <p>Bạn có thể mở đọc trực tiếp ngay trên trang gốc NetTruyen:</p>
            <a
              href={currentChapter?.url || manga.url}
              target="_blank"
              rel="noreferrer"
              className="ngontinh-btn-primary"
              style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <ExternalLink size={16} /> Mở đọc tại NetTruyen
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
              if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth' });
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
