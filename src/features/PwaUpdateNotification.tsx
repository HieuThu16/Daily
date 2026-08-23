import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export function PwaUpdateNotification() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl?: string, r?: ServiceWorkerRegistration) {
      if (r) {
        // Tự động kiểm tra bản build mới mỗi 30 giây
        setInterval(() => {
          r.update().catch(() => {});
        }, 30_000);
      }
    },
    onRegisterError(error: unknown) {
      console.warn('[PWA Register error]', error);
    },
  });


  // Khi người dùng quay lại tab ứng dụng, lập tức kiểm tra cập nhật mới
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.update().catch(() => {});
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        maxWidth: '92vw',
        width: '420px',
        background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '12px 16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(129, 140, 248, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        animation: 'pwaSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Sparkles size={18} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Đã có phiên bản mới!
          </div>
          <div style={{ fontSize: '0.74rem', color: '#c7d2fe', marginTop: '1px' }}>
            Bấm cập nhật để nạp tính năng mới nhất
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => {
            void updateServiceWorker(true);
          }}
          style={{
            padding: '7px 14px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <RefreshCw size={13} /> Cập nhật
        </button>

        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#c7d2fe',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Đóng"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** Hàm gọi chủ động để xóa sạch cache cũ và ép nạp bản mới nhất */
export async function forceReloadLatestVersion() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) {
        await caches.delete(key);
      }
    }
  } catch (e) {
    console.warn('[forceReloadLatestVersion error]', e);
  }
  // Thêm query timestamp để vượt qua mọi proxy / ISP cache
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.href = url.toString();
}
