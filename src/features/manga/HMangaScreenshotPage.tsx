import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Trash2, BookOpen, Calendar, Search, X, Images, Eye, ExternalLink } from 'lucide-react';
import { getHMangaScreenshots, syncHMangaScreenshotsWithSupabase, deleteHMangaScreenshot, type HMangaScreenshot } from './hMangaScreenshot';
import { useToast } from '../ToastContext';

export const HMangaScreenshotPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('from');
  const filterSlug = searchParams.get('slug');

  const { showToast } = useToast();
  const [screenshots, setScreenshots] = useState<HMangaScreenshot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewShot, setPreviewShot] = useState<HMangaScreenshot | null>(null);
  const [selectedManga, setSelectedManga] = useState<string>(filterSlug || 'ALL');

  useEffect(() => {
    setScreenshots(getHMangaScreenshots());
    void syncHMangaScreenshotsWithSupabase().then((list) => {
      if (list && list.length > 0) {
        setScreenshots(list);
      }
    });
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
    if (previewShot?.id === id) setPreviewShot(null);
    showToast('🗑️ Đã xóa ảnh khỏi bộ sưu tập');
  };

  const handleOpenReader = (shot: HMangaScreenshot) => {
    navigate(`/truyenh/${shot.mangaSlug}/read/${shot.chapterNumber}`);
  };

  // Group manga list for filter pills
  const mangaList = useMemo(() => {
    const map = new Map<string, { slug: string; title: string; count: number }>();
    for (const s of screenshots) {
      const existing = map.get(s.mangaSlug);
      if (existing) {
        existing.count++;
      } else {
        map.set(s.mangaSlug, { slug: s.mangaSlug, title: s.mangaTitle, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [screenshots]);

  const filtered = useMemo(() => {
    return screenshots.filter(s => {
      if (selectedManga !== 'ALL' && s.mangaSlug !== selectedManga) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.mangaTitle.toLowerCase().includes(q) ||
        s.chapterName.toLowerCase().includes(q) ||
        (s.pageIndex && `trang ${s.pageIndex}`.includes(q))
      );
    });
  }, [screenshots, selectedManga, searchQuery]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(9, 9, 11, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <button
          onClick={() => {
            if (returnUrl) {
              navigate(returnUrl);
            } else {
              navigate('/truyenh');
            }
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#f4f4f5',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: 700,
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <ArrowLeft size={16} />
          {returnUrl ? 'Quay lại đọc tiếp' : 'Truyện H'}
        </button>

        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)',
          }}
        >
          <Camera size={20} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.02em' }}>
            Bộ sưu tập ảnh chụp trang ({screenshots.length})
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
            Ảnh trang full hình chữ nhật · Nhấn "Đọc tiếp" để nhảy ngay đến đúng trang và chương đó
          </p>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div style={{ padding: '16px 20px 0', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Tìm theo tên truyện, chapter, trang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 38px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                color: '#f4f4f5',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
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
                <X size={15} />
              </button>
            )}
          </div>

          {/* Manga Filter Pills */}
          {mangaList.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
              <button
                onClick={() => setSelectedManga('ALL')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: selectedManga === 'ALL' ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: selectedManga === 'ALL' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: selectedManga === 'ALL' ? '#f472b6' : '#d4d4d8',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                Tất cả ({screenshots.length})
              </button>
              {mangaList.map(m => (
                <button
                  key={m.slug}
                  onClick={() => setSelectedManga(m.slug)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: selectedManga === m.slug ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: selectedManga === m.slug ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: selectedManga === m.slug ? '#f472b6' : '#d4d4d8',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m.title} ({m.count})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <main style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {screenshots.length === 0 ? (
          /* Empty State */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '100px 20px',
              textAlign: 'center',
              gap: '18px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '20px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              marginTop: '10px',
            }}
          >
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '24px',
                background: 'rgba(236, 72, 153, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ec4899',
              }}
            >
              <Images size={42} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 800, color: '#f4f4f5' }}>
                Bộ sưu tập ảnh đang trống
              </h2>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#a1a1aa', maxWidth: '380px', lineHeight: 1.5 }}>
                Khi bạn đang đọc truyện H, nhấn nút <span style={{ color: '#ec4899', fontWeight: 700 }}>📸 Chụp ảnh</span> ở thanh điều hướng để lưu lại nguyên trang ảnh khoảnh khắc đẹp!
              </p>
            </div>
            <button
              onClick={() => navigate('/truyenh')}
              style={{
                marginTop: '6px',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(236, 72, 153, 0.35)',
              }}
            >
              <BookOpen size={18} /> Mở đọc truyện ngay
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: '#a1a1aa',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '20px',
            }}
          >
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Không tìm thấy ảnh chụp nào khớp với "{searchQuery}"
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '22px',
            }}
          >
            {filtered.map((shot) => (
              <div
                key={shot.id}
                style={{
                  backgroundColor: '#121215',
                  border: '1px solid rgba(255, 255, 255, 0.09)',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 36px rgba(236, 72, 153, 0.2), 0 4px 12px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                }}
              >
                {/* Full Rectangular Manga Page Preview */}
                <div
                  onClick={() => setPreviewShot(shot)}
                  style={{
                    width: '100%',
                    height: '380px',
                    backgroundColor: '#000000',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={shot.imageData}
                    alt={`${shot.mangaTitle} - ${shot.chapterName}`}
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain', // Hiển thị full trọn vẹn hình chữ nhật không cắt xén
                      display: 'block',
                      backgroundColor: '#000000',
                    }}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.style.cssText =
                          'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:#71717a;font-size:0.85rem;';
                        fallback.innerHTML =
                          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Không tải được ảnh</span>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />

                  {/* Badges on image */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      display: 'flex',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#ffffff',
                        backgroundColor: '#ec4899',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {shot.pageIndex ? `Trang ${shot.pageIndex}` : 'Ảnh trang'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#f4f4f5',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(6px)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      {shot.chapterName}
                    </span>
                  </div>

                  {/* Hover View Zoom Icon */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    <Eye size={16} />
                  </div>
                </div>

                {/* Card Details & Action Buttons */}
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <h3
                      title={shot.mangaTitle}
                      style={{
                        margin: '0 0 4px',
                        fontSize: '0.98rem',
                        fontWeight: 800,
                        color: '#f4f4f5',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {shot.mangaTitle}
                    </h3>
                    <div
                      style={{
                        fontSize: '0.76rem',
                        color: '#71717a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Calendar size={12} />
                      {formatDate(shot.createdAt)}
                    </div>
                  </div>

                  {/* Large Prominent Action: QUAY LẠI ĐỌC TRUYỆN TIẾP */}
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', paddingTop: '4px' }}>
                    <button
                      onClick={() => handleOpenReader(shot)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(236, 72, 153, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.3)';
                      }}
                    >
                      <BookOpen size={16} />
                      Đọc tiếp chương này
                    </button>

                    {deleteConfirm === shot.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleDelete(shot.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#dc2626',
                            color: '#fff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Xóa
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'transparent',
                            color: '#a1a1aa',
                            fontSize: '0.78rem',
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
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#f87171',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Fullscreen Lightbox Modal */}
      {previewShot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => setPreviewShot(null)}
        >
          {/* Lightbox Topbar */}
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0, 0, 0, 0.6)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f4f4f5' }}>
                {previewShot.mangaTitle}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#ec4899', fontWeight: 700 }}>
                {previewShot.chapterName} {previewShot.pageIndex ? `· Trang ${previewShot.pageIndex}` : ''}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => handleOpenReader(previewShot)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <BookOpen size={16} /> Đọc tiếp chương này
              </button>

              <button
                onClick={() => setPreviewShot(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f4f4f5',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lightbox Image Container */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              overflow: 'auto',
            }}
            onClick={() => setPreviewShot(null)}
          >
            <img
              src={previewShot.imageData}
              alt={previewShot.mangaTitle}
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
