import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, ExternalLink, Bookmark, ArrowUp } from 'lucide-react';
import type { BLManga } from '../../types/manga';
import { saveReadingProgress } from './mangaService';
import { recordMangaReading } from '../../lib/mangaReadingLog';

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

      // Scroll to top on chapter change
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

  const images = currentChapter?.images || [];

  return (
    <div className="bl-reader-overlay">
      <div ref={topRef} />
      
      {/* Sleek Floating Reader Header */}
      <header className="bl-reader-header-compact">
        <div className="bl-reader-header-left">
          <button className="bl-reader-back-btn" onClick={onClose} title="Trở về">
            <ArrowLeft size={18} />
          </button>
          <div className="bl-reader-info-compact">
            <span className="bl-reader-manga-title">{manga.title}</span>
            <span className="bl-reader-chapter-sub">{currentChapter?.name || `Chương ${currentChapterNum}`}</span>
          </div>
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

          <button
            className="bl-reader-nav-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Reader Body */}
      <main ref={mainRef} className="bl-reader-body">
        {images.length > 0 ? (
          <div className="bl-reader-image-stream">
            {images.map((img, idx) => {
              const hasError = imageErrors[idx];
              return (
                <div key={img.url || idx} className="bl-image-frame">
                  {hasError ? (
                    <div className="bl-image-error">
                      <p>Không thể tải ảnh {idx + 1}</p>
                      <a href={img.url} target="_blank" rel="noreferrer" className="bl-link-direct">
                        <ExternalLink size={14} /> Mở ảnh gốc
                      </a>
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={img.alt || `Trang ${idx + 1}`}
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
