import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Trash2, BookOpen, Search, X, Images, Eye, ZoomIn, Plus, Minus, UploadCloud } from 'lucide-react';
import { getHMangaScreenshots, syncHMangaScreenshotsWithSupabase, deleteHMangaScreenshot, type HMangaScreenshot } from './hMangaScreenshot';
import { UploadMangaScreenshotModal } from './UploadMangaScreenshotModal';
import { useToast } from '../ToastContext';
import { Z } from '../../lib/zLayers'

export const HMangaScreenshotPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('from');
  const filterSlug = searchParams.get('slug');

  const { showToast } = useToast();
  const [screenshots, setScreenshots] = useState<HMangaScreenshot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewShot, setPreviewShot] = useState<HMangaScreenshot | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedManga, setSelectedManga] = useState<string>(filterSlug || 'ALL');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);


  useEffect(() => {
    setScreenshots(getHMangaScreenshots());
    void syncHMangaScreenshotsWithSupabase().then((list) => {
      if (list && list.length > 0) {
        setScreenshots(list);
      }
    });
  }, []);

  const handleDelete = async (id: string) => {
    await deleteHMangaScreenshot(id);
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirmId(null);
    if (previewShot?.id === id) setPreviewShot(null);
    showToast('🗑️ Đã xóa ảnh thành công');
  };

  const handleGoToManga = (shot: HMangaScreenshot) => {
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
    return screenshots.filter((s) => {
      if (selectedManga !== 'ALL' && s.mangaSlug !== selectedManga) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.mangaTitle.toLowerCase().includes(q) ||
        s.chapterName.toLowerCase().includes(q)
      );
    });
  }, [screenshots, selectedManga, searchQuery]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0c',
        color: '#f4f4f5',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        paddingBottom: '40px',
      }}
    >
      {/* ── Top Header ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(10, 10, 12, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => {
              if (returnUrl) {
                navigate(returnUrl);
              } else {
                navigate('/truyenh');
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '7px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#f4f4f5',
              cursor: 'pointer',
              fontSize: '0.84rem',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
            }}
          >
            <ArrowLeft size={16} />
            {returnUrl ? 'Đọc tiếp' : 'Truyện H'}
          </button>

          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📸 Kho ảnh chụp</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  backgroundColor: 'rgba(225, 29, 72, 0.2)',
                  color: '#fb7185',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(225, 29, 72, 0.3)',
                }}
              >
                {screenshots.length} ảnh
              </span>
            </h1>
          </div>
        </div>

        {/* Actions in Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            style={{
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              border: 'none',
              borderRadius: '10px',
              padding: '7px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              transition: 'transform 0.15s ease',
            }}
          >
            <UploadCloud size={16} />
            <span>Tải ảnh lên</span>
          </button>

          {/* Search input right in header */}
          <div style={{ position: 'relative', width: '180px', maxWidth: '35vw' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Tìm truyện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 28px 6px 30px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f4f4f5',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Manga Filter Pills */}
      {mangaList.length > 1 && (
        <div
          style={{
            padding: '12px 18px 0',
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <button
            onClick={() => setSelectedManga('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: selectedManga === 'ALL' ? '1.5px solid #e11d48' : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedManga === 'ALL' ? 'rgba(225, 29, 72, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: selectedManga === 'ALL' ? '#fb7185' : '#a1a1aa',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            Tất cả ({screenshots.length})
          </button>
          {mangaList.map((m) => (
            <button
              key={m.slug}
              onClick={() => setSelectedManga(m.slug)}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: selectedManga === m.slug ? '1.5px solid #e11d48' : '1px solid rgba(255, 255, 255, 0.08)',
                background: selectedManga === m.slug ? 'rgba(225, 29, 72, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: selectedManga === m.slug ? '#fb7185' : '#a1a1aa',
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

      {/* ── Main Grid Content ── */}
      <main style={{ padding: '16px 18px', maxWidth: '1400px', margin: '0 auto' }}>
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
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '20px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              marginTop: '10px',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '20px',
                background: 'rgba(225, 29, 72, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e11d48',
              }}
            >
              <Images size={36} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5' }}>
                Chưa có ảnh chụp nào
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#a1a1aa', maxWidth: '360px', lineHeight: 1.5 }}>
                Khi đang đọc truyện H, nhấn nút <span style={{ color: '#fb7185', fontWeight: 700 }}>📸 Chụp ảnh</span> để lưu lại các trang truyện bạn yêu thích.
              </p>
            </div>
            <button
              onClick={() => navigate('/truyenh')}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(225, 29, 72, 0.35)',
              }}
            >
              <BookOpen size={16} /> Mở đọc truyện H
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#a1a1aa',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>
              Không tìm thấy ảnh chụp nào khớp với từ khóa "{searchQuery}"
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            {filtered.map((shot) => (
              <div
                key={shot.id}
                style={{
                  backgroundColor: '#131318',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(225, 29, 72, 0.5)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 10px 28px rgba(225, 29, 72, 0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
                }}
              >
                {/* 1. KHU VỰC ẢNH */}
                <div
                  onClick={() => setPreviewShot(shot)}
                  style={{
                    width: '100%',
                    height: '280px',
                    backgroundColor: '#000000',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={shot.imageData}
                    alt={shot.mangaTitle}
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.style.cssText = 'color:#71717a;font-size:0.78rem;text-align:center;padding:10px;';
                        fallback.innerText = 'Không tải được ảnh';
                        parent.appendChild(fallback);
                      }
                    }}
                  />

                  {/* Tag chương / trang góc ảnh */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.75)',
                      backdropFilter: 'blur(6px)',
                      color: '#fb7185',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(225, 29, 72, 0.3)',
                    }}
                  >
                    {shot.chapterName}
                  </div>

                  {/* Nút xem nhanh icon trên ảnh */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(4px)',
                      color: '#ffffff',
                      borderRadius: '6px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ZoomIn size={15} />
                  </div>
                </div>

                {/* 2. KHU VỰC THÔNG TIN TRUYỆN & 3 NÚT HÀNH ĐỘNG */}
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'space-between' }}>
                  {/* Tên truyện */}
                  <div
                    title={shot.mangaTitle}
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: '#f4f4f5',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {shot.mangaTitle}
                  </div>

                  {/* 3 NÚT: XEM · ĐẾN TRUYỆN · XÓA */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Nút 1: Xem ảnh */}
                    <button
                      type="button"
                      onClick={() => setPreviewShot(shot)}
                      style={{
                        flex: '1',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#f4f4f5',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      <Eye size={13} /> Xem
                    </button>

                    {/* Nút 2: Đi tới truyện */}
                    <button
                      type="button"
                      onClick={() => handleGoToManga(shot)}
                      title="Đọc truyện này"
                      style={{
                        flex: '1.2',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #e11d48, #be123c)',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <BookOpen size={13} /> Đến truyện
                    </button>

                    {/* Nút 3: Xóa ảnh */}
                    {deleteConfirmId === shot.id ? (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(shot.id)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#dc2626',
                            color: '#fff',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          style={{
                            padding: '6px 6px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent',
                            color: '#a1a1aa',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(shot.id)}
                        title="Xóa ảnh"
                        style={{
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#f87171',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
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
      </main>

      {/* ── Fullscreen Lightbox Modal (Phóng to / Thu nhỏ ảnh) ── */}
      {previewShot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            zIndex: Z.fullscreen,
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => setPreviewShot(null)}
        >
          {/* Lightbox Topbar */}
          <div
            style={{
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0, 0, 0, 0.8)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#f4f4f5' }}>
                {previewShot.mangaTitle}
              </h3>
              <p style={{ margin: '1px 0 0', fontSize: '0.76rem', color: '#fb7185', fontWeight: 700 }}>
                {previewShot.chapterName}
              </p>
            </div>

            {/* Zoom Controls & Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Zoom Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '3px 6px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  title="Thu nhỏ (-)"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#f4f4f5',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Minus size={15} />
                </button>

                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#fb7185', minWidth: '42px', textAlign: 'center' }}>
                  {Math.round(zoomLevel * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
                  title="Phóng to (+)"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#f4f4f5',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={15} />
                </button>

                {zoomLevel !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    title="Đặt lại 100%"
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'rgba(255, 255, 255, 0.12)',
                      color: '#d4d4d8',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Nút Đến truyện */}
              <button
                type="button"
                onClick={() => handleGoToManga(previewShot)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #e11d48, #be123c)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <BookOpen size={13} /> Đến truyện
              </button>

              {/* Nút Xóa */}
              <button
                type="button"
                onClick={() => {
                  if (previewShot) handleDelete(previewShot.id);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#f87171',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Trash2 size={13} /> Xóa
              </button>

              {/* Nút Đóng */}
              <button
                type="button"
                onClick={() => setPreviewShot(null)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f4f4f5',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Lightbox Image View with Zoom */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflow: 'auto',
              cursor: zoomLevel > 1 ? 'grab' : 'default',
            }}
            onClick={() => setPreviewShot(null)}
          >
            <img
              src={previewShot.imageData}
              alt={previewShot.mangaTitle}
              style={{
                maxWidth: zoomLevel === 1 ? '100%' : 'none',
                maxHeight: zoomLevel === 1 ? '88vh' : 'none',
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Click to toggle 1x / 1.75x zoom
                setZoomLevel((z) => (z === 1 ? 1.75 : 1));
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Upload Ảnh từ bộ sưu tập máy */}
      <UploadMangaScreenshotModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={(newShots) => {
          setScreenshots((prev) => [...newShots, ...prev]);
        }}
        defaultSlug={selectedManga !== 'ALL' ? selectedManga : undefined}
      />
    </div>
  );
};

