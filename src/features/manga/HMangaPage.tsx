import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Loader2, Plus, Download, Link as LinkIcon, AlertCircle, Clipboard,
  ExternalLink, CheckCircle2, Camera, Lock,
} from 'lucide-react'
import type { HManga } from './hMangaService'
import {
  fetchHMangaList,
  getHMangaFavorites, toggleHMangaFavorite,
  getHMangaHistory,
  crawlAndSaveStory,
  getChapterImageUrl,
  isValidHMangaCover,
  getCustomHMangaList,
} from './hMangaService'
import { lockH } from './HPinGate'
import { useToast } from '../ToastContext'
import { MangaLibraryPage, type MangaLibraryConfig } from './MangaLibraryPage'
import './ngontinhManga.css'
import { Z } from '../../lib/zLayers'

function extractSlugFromUrl(rawUrl: string): string {
  let u = rawUrl.trim();
  if (!u) return '';
  u = u.replace(/\/chap(?:ter)?-[\d.]+\/?$/i, '');
  u = u.replace(/\/+$/, '');
  const segments = u.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

// Crawl Modal Component
function CrawlModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  existingMangaList = [],
  onOpenExisting
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: (manga: HManga) => void;
  existingMangaList?: HManga[];
  onOpenExisting?: (slug: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Kiểm tra trùng truyện ngay trên frontend khi paste/nhập link
  const existingMatch = useMemo(() => {
    if (!url.trim()) return null;
    const slug = extractSlugFromUrl(url);
    if (!slug) return null;
    return existingMangaList.find(m => 
      m.slug === slug || 
      m.slug.toLowerCase() === slug.toLowerCase() ||
      (m.url && extractSlugFromUrl(m.url) === slug) ||
      m.title.toLowerCase().replace(/[^a-z0-9]/g, '') === slug.replace(/[^a-z0-9]/g, '')
    );
  }, [url, existingMangaList]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) setUrl(text.trim());
    } catch {}
  };

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorMsg('Vui lòng nhập link truyện từ sayhentai.cx, metruyen18.app hoặc vietmanhwa.com');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setProgressMsg('Đang bắt đầu cào dữ liệu...');

    try {
      const crawled = await crawlAndSaveStory(url.trim(), (msg) => setProgressMsg(msg));
      onSuccess(crawled);
      onClose();
    } catch (err: any) {
      console.error('Crawl error:', err);
      setErrorMsg(err.message || 'Không thể cào dữ liệu truyện này. Vui lòng kiểm tra lại đường link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crawl-modal-backdrop" role="presentation" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: Z.modal,
      padding: '16px'
    }}>
      <div 
        className="crawl-modal-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{
          background: 'var(--surface-card, #ffffff)',
          color: 'var(--text-primary, #1e293b)',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color, #e2e8f0)',
          animation: 'modalSlideIn 0.2s ease-out'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '12px', background: '#ffe4e6', color: '#e11d48' }}>
              <Download size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Cào truyện H (SayHentai, MeTruyen18, VietManhwa)</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>Hỗ trợ link từ sayhentai.cx, metruyen18.app hoặc vietmanhwa.com</span>
            </div>
          </div>
          <button 
            type="button" 
            aria-label="Đóng"
            onClick={onClose} 
            disabled={loading}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', color: 'var(--text-muted, #64748b)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCrawl}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Đường dẫn truyện (sayhentai.cx, metruyen18.app, vietmanhwa.com)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <LinkIcon size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted, #64748b)' }} />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Dán link sayhentai.cx, metruyen18.app hoặc vietmanhwa.com..."
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 75px 12px 38px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--surface-bg, #f8fafc)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '6px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--surface-card, #fff)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Clipboard size={12} /> Dán
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginTop: '6px' }}>
              Ví dụ: <code>https://sayhentai.cx/truyen-thoa-thuan-day-toi-loi...html</code>
            </div>
          </div>


          {/* Cảnh báo truyện trùng tên/slug ngay trên Frontend */}
          {existingMatch && !loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#fef9c3',
              color: '#854d0e',
              fontSize: '0.85rem',
              marginBottom: '16px',
              border: '1px solid #fef08a'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <CheckCircle2 size={17} style={{ color: '#ca8a04', flexShrink: 0 }} />
                <span>Truyện này đã có trong danh sách!</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#713f12' }}>
                Đã lưu: <strong>{existingMatch.title}</strong> ({existingMatch.chapters?.length || existingMatch.totalChapters || 0} chương).
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenExisting) onOpenExisting(existingMatch.slug);
                    else onClose();
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ca8a04',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ExternalLink size={12} /> Mở đọc ngay
                </button>
                <span style={{ fontSize: '0.75rem', color: '#854d0e' }}>
                  hoặc bấm "Cào lại truyện" bên dưới để cập nhật chương mới
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '0.85rem',
              marginBottom: '16px',
              border: '1px solid #fecaca'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--primary-bg, #eff6ff)',
              color: 'var(--primary, #2563eb)',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              <Loader2 className="spinner" size={18} />
              <span>{progressMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'transparent',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="spinner" size={16} /> Đang cào truyện...
                </>
              ) : existingMatch ? (
                <>
                  <Download size={16} /> Cào lại & Cập nhật
                </>
              ) : (
                <>
                  <Download size={16} /> Bắt đầu cào truyện
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const HMangaPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showCrawlModal, setShowCrawlModal] = useState(false)

  const config = useMemo<MangaLibraryConfig<HManga>>(
    () => ({
      cssPrefix: 'ngontinh',
      kindLabel: 'H',
      routeBase: '/truyenh',
      scrollKey: 'truyenh-list',
      recentTitle: 'Truyện H đã cào gần đây',
      accentColor: '#a855f7',

      loadList: fetchHMangaList,
      getFavorites: getHMangaFavorites,
      toggleFavorite: toggleHMangaFavorite,
      getHistory: getHMangaHistory,
      historyEvent: 'daily_h_history_updated',

      // Bìa hay hỏng: rơi về trang đầu của chương 1.
      coverOf: (manga) => {
        const ch1 = getChapterImageUrl(manga.chapters?.[0]?.images?.[0] as any)
        return (isValidHMangaCover(manga.cover) ? manga.cover : ch1) || manga.cover || ''
      },
      cardBadge: () => (
        <div className="ngontinh-hot-tag" style={{ background: '#e11d48', color: '#fff', fontWeight: 800 }}>
          🔞 18+
        </div>
      ),

      recentCrawled: (list) => {
        const map = new Map<string, HManga>()
        for (const m of getCustomHMangaList()) map.set(m.slug, m)
        for (const m of list) if (m.updatedAt && !map.has(m.slug)) map.set(m.slug, m)
        return [...map.values()]
      },

      // Truyện H đọc ở trang riêng (có khóa PIN, chụp ảnh màn hình), không mở modal.
      onRead: (manga, chapterNum) => navigate(`/truyenh/${manga.slug}/read/${chapterNum}`),

      navExtras: () => (
        <>
          <button
            type="button"
            className="ngontinh-nav-tab-btn"
            onClick={() => navigate('/truyenh/screenshots')}
            style={{
              background: 'rgba(236, 72, 153, 0.15)',
              color: '#f472b6',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              fontWeight: 600,
            }}
            title="Xem kho ảnh chụp khoảnh khắc khi đọc truyện"
          >
            <Camera size={15} /> Kho ảnh chụp
          </button>

          <button
            type="button"
            className="ngontinh-nav-tab-btn"
            onClick={() => {
              lockH()
              navigate('/home')
            }}
            style={{ background: 'rgba(225, 29, 72, 0.12)', color: '#fb7185', fontWeight: 600 }}
            title="Khóa lại mục Truyện H"
          >
            <Lock size={15} /> Khóa
          </button>

          <button
            type="button"
            className="ngontinh-nav-tab-btn"
            onClick={() => setShowCrawlModal(true)}
            style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#ffffff', fontWeight: 700 }}
          >
            <Plus size={15} /> Paste link cào truyện
          </button>
        </>
      ),

      extras: (ctx) => (
        <CrawlModal
          isOpen={showCrawlModal}
          onClose={() => setShowCrawlModal(false)}
          existingMangaList={ctx.list}
          onOpenExisting={(slug: string) => {
            setShowCrawlModal(false)
            navigate(`/truyenh/${slug}`)
          }}
          onSuccess={(manga: HManga) => {
            showToast(`🎉 Đã cào thành công truyện "${manga.title}" (${manga.totalChapters} chương)!`)
            ctx.reload()
            navigate(`/truyenh/${manga.slug}`)
          }}
        />
      ),
    }),
    // showCrawlModal đổi thì phải dựng lại config để modal mở/đóng theo.
    [showCrawlModal],
  )

  return <MangaLibraryPage config={config} />
}
