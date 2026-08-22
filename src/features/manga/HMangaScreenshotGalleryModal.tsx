import React from 'react';
import { X, Trash2, Camera, ExternalLink, Calendar, BookOpen } from 'lucide-react';
import type { HMangaScreenshot } from './hMangaScreenshot';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  screenshots: HMangaScreenshot[];
  onSelectScreenshot: (shot: HMangaScreenshot) => void;
  onDeleteScreenshot: (id: string) => void;
}

export const HMangaScreenshotGalleryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  screenshots,
  onSelectScreenshot,
  onDeleteScreenshot,
}) => {
  if (!isOpen) return null;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '85vh',
          backgroundColor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(236, 72, 153, 0.08) 0%, rgba(0,0,0,0) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(236, 72, 153, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ec4899',
              }}
            >
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f4f4f5' }}>
                Kho ảnh chụp khoảnh khắc ({screenshots.length})
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
                Bấm vào ảnh bất kỳ để nhảy đến đúng truyện và đúng chapter đó
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d4d4d8',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Gallery Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}
        >
          {screenshots.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '50px 20px',
                color: '#71717a',
              }}
            >
              <Camera size={44} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#a1a1aa' }}>
                Bạn chưa chụp lưu khoảnh khắc nào.
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#71717a' }}>
                Khi đang đọc truyện H, nhấn nút 📸 Chụp màn hình để lưu lại trang ảnh yêu thích!
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              {screenshots.map((shot) => (
                <div
                  key={shot.id}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Image Snapshot */}
                  <div
                    onClick={() => {
                      onSelectScreenshot(shot);
                      onClose();
                    }}
                    style={{
                      height: '180px',
                      backgroundColor: '#09090b',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={shot.imageData}
                      alt={shot.mangaTitle}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.8) 100%)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: '8px 10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#f472b6',
                          fontWeight: 700,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {shot.chapterName}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h5
                      onClick={() => {
                        onSelectScreenshot(shot);
                        onClose();
                      }}
                      style={{
                        margin: '0 0 4px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#f4f4f5',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      }}
                    >
                      {shot.mangaTitle}
                    </h5>

                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: '#71717a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginBottom: '8px',
                      }}
                    >
                      <Calendar size={11} />
                      {formatDate(shot.createdAt)}
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          onSelectScreenshot(shot);
                          onClose();
                        }}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(236, 72, 153, 0.2)',
                          color: '#f472b6',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <BookOpen size={12} />
                        <span>Mở đọc</span>
                      </button>

                      <button
                        onClick={() => onDeleteScreenshot(shot.id)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Xóa ảnh này"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
