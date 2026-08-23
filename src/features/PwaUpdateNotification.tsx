import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X, ArrowUpCircle } from 'lucide-react';

export function PwaUpdateNotification() {
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v2.4.0';
  const currentBuildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

  const [newServerVersion, setNewServerVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const {
    needRefresh: [swNeedRefresh, setSwNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl?: string, r?: ServiceWorkerRegistration) {
      if (r) {
        // Tự động kiểm tra ServiceWorker mỗi 20 giây
        setInterval(() => {
          r.update().catch(() => {});
        }, 20_000);
      }
    },
    onRegisterError(error: unknown) {
      console.warn('[PWA Register error]', error);
    },
  });

  // Polling /version.json để phát hiện ngay khi có bản build mới trên Vercel
  useEffect(() => {
    const checkServerVersion = async () => {
      try {
        const res = await fetch(`/version.json?_t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.version && data.version !== currentVersion) {
            setNewServerVersion(data.version);
          } else if (data?.buildTime && currentBuildTime && new Date(data.buildTime).getTime() > new Date(currentBuildTime).getTime()) {
            setNewServerVersion(data.version || 'Mới nhất');
          }
        }
      } catch {}
    };

    void checkServerVersion();
    const interval = setInterval(checkServerVersion, 20_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkServerVersion();
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then((reg) => {
            reg?.update().catch(() => {});
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentVersion, currentBuildTime]);

  const hasUpdate = Boolean((swNeedRefresh || newServerVersion) && !dismissed);

  if (!hasUpdate) return null;

  const handleUpdate = () => {
    try {
      void updateServiceWorker(true);
    } catch {}
    void forceReloadLatestVersion();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        maxWidth: '92vw',
        width: '430px',
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
            Đã có phiên bản mới {newServerVersion ? `(${newServerVersion})` : ''}!
          </div>
          <div style={{ fontSize: '0.74rem', color: '#c7d2fe', marginTop: '1px' }}>
            Nhấn cập nhật để tải tính năng mới nhất
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleUpdate}
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
          onClick={() => {
            setDismissed(true);
            setSwNeedRefresh(false);
          }}
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
  // Bước 1: Hủy đăng ký tất cả Service Workers
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (e) {
    console.warn('[forceReload] SW unregister error', e);
  }

  // Bước 2: Xóa tất cả Cache Storage (workbox precache, runtime cache...)
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn('[forceReload] cache delete error', e);
  }

  // Bước 3: Hard reload — bỏ qua mọi tầng cache trình duyệt
  // Dùng window.location.replace để tránh vòng lặp lịch sử
  // Timestamp param ép proxy/CDN/ISP cache trả về bản mới
  setTimeout(() => {
    const base = window.location.origin + window.location.pathname;
    window.location.replace(base + '?_bust=' + Date.now());
  }, 300);
}
