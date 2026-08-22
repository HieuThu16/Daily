import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Trash2, BookOpen, Calendar, Search, X, Images } from 'lucide-react';
import { getHMangaScreenshots, deleteHMangaScreenshot, type HMangaScreenshot } from './hMangaScreenshot';
import { useToast } from '../ToastContext';

export const HMangaScreenshotPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [screenshots, setScreenshots] = useState<HMangaScreenshot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setScreenshots(getHMangaScreenshots());
  }, []);

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

  const handleDelete = async (id: string) => {
    await deleteHMangaScreenshot(id);
    setScreenshots(prev => prev.filter(s => s.id !== id));
    setDeleteConfirm(null);
    showToast('🗑️ Đã xóa ảnh chụp');
  };

  const handleOpenReader = (shot: HMangaScreenshot) => {
    navigate(`/truyenh/${shot.mangaSlug}/read/${shot.chapterNumber}`);
  };

  const filtered = screenshots.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.mangaTitle.toLowerCase().includes(q) ||
      s.chapterName.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(9, 9, 11, 0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          onClick={() => navigate('/truyenh')}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d4d4d8',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(236, 72, 153, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ec4899',
            flexShrink: 0,
          }}
        >
          <Camera size={18} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f4f4f5' }}>
            Kho ảnh chụp khoảnh khắc
          </h1>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#71717a' }}>
            {screenshots.length} ảnh · Bấm để nhảy đến đúng truyện và chapter
          </p>
        </div>
      </div>

      {/* Search Bar */}
      {screenshots.length > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ position: 'relative', maxWidth: '480px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Tìm theo tên truyện hoặc chapter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 36px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#f4f4f5',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '16px 20px 40px' }}>
        {screenshots.length === 0 ? (
          /* Empty State */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              textAlign: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '24px',
                background: 'rgba(236, 72, 153, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Images size={36} style={{ color: '#ec4899', opacity: 0.6 }} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, color: '#d4d4d8' }}>
                Chưa có ảnh chụp nào
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#71717a', maxWidth: '320px' }}>
                Khi đang đọc truyện H, nhấn nút{' '}
                <span style={{ color: '#ec4899' }}>📸</span> để lưu lại khoảnh khắc yêu thích!
              </p>
            </div>
            <button
              onClick={() => navigate('/truyenh')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <BookOpen size={16} /> Đọc truyện ngay
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#71717a',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              Không tìm thấy ảnh nào khớp với "{searchQuery}"
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: '16px',
            }}
          >
            {filtered.map((shot) => (
              <div
                key={shot.id}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.5)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(236, 72, 153, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Image Preview */}
                <div
                  onClick={() => handleOpenReader(shot)}
                  style={{
                    height: '200px',
                    backgroundColor: '#0c0c0e',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <img
                    src={shot.imageData}
                    alt={shot.mangaTitle}
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                      display: 'block',
                    }}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.style.cssText =
                          'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:#52525b;font-size:0.8rem;';
                        fallback.innerHTML =
                          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Ảnh không tải được</span>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                  {/* Gradient + chapter badge */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: '10px',
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#fce7f3',
                        fontWeight: 700,
                        backgroundColor: 'rgba(225, 29, 72, 0.85)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {shot.chapterName}
                    </span>
                  </div>
                </div>

                {/* Card Details */}
                <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <h4
                    onClick={() => handleOpenReader(shot)}
                    title={shot.mangaTitle}
                    style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#f4f4f5',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer',
                    }}
                  >
                    {shot.mangaTitle}
                  </h4>

                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: '#71717a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Calendar size={11} />
                    {formatDate(shot.createdAt)}
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', paddingTop: '6px' }}>
                    <button
                      onClick={() => handleOpenReader(shot)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(236, 72, 153, 0.2)',
                        color: '#f472b6',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                    >
                      <BookOpen size={13} />
                      Mở đọc
                    </button>

                    {deleteConfirm === shot.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleDelete(shot.id)}
                          style={{
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#dc2626',
                            color: '#fff',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Xóa
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          style={{
                            padding: '7px 8px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent',
                            color: '#a1a1aa',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(shot.id)}
                        title="Xóa ảnh này"
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
