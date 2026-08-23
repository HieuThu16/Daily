import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Search, History, Download, ExternalLink } from 'lucide-react';
import { forceReloadLatestVersion } from './PwaUpdateNotification';
import { useToast } from './ToastContext';

interface ServerVersionInfo {
  version: string;
  buildTime?: string;
}

export function VersionSettingsCard({ onOpenChangelog }: { onOpenChangelog: () => void }) {
  const { showToast } = useToast();
  
  // Phiên bản được build trong mã nguồn hiện tại của client
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v2.4.0';
  const currentBuildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '2026-08-23T16:47:00.000Z';

  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [serverBuildTime, setServerBuildTime] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [hasNewUpdate, setHasNewUpdate] = useState<boolean>(false);

  const checkVersion = async (showNotification = false) => {
    setChecking(true);
    try {
      // Gọi fetch với cache-busting timestamp để không dính cache
      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const data: ServerVersionInfo = await res.json();
        setServerVersion(data.version);
        setServerBuildTime(data.buildTime || null);

        // So sánh phiên bản hoặc build time
        const isNewer = data.version !== currentVersion || 
          (data.buildTime && currentBuildTime && new Date(data.buildTime).getTime() > new Date(currentBuildTime).getTime());
        
        setHasNewUpdate(Boolean(isNewer));

        if (showNotification) {
          if (isNewer) {
            showToast(`🚀 Đã có phiên bản mới (${data.version})! Nhấn 'Cập nhật ngay' để nâng cấp.`, 'info');
          } else {
            showToast(`✅ Bạn đang dùng phiên bản mới nhất (${currentVersion})!`, 'success');
          }
        }
      }
    } catch {
      if (showNotification) {
        showToast('⚠️ Không thể kiểm tra server, vui lòng thử lại sau.', 'delete');
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void checkVersion(false);
  }, []);

  const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return '';
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.95))',
        border: hasNewUpdate ? '1.5px solid rgba(244, 63, 94, 0.6)' : '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '18px',
        padding: '16px 18px',
        color: '#f8fafc',
        boxShadow: hasNewUpdate 
          ? '0 10px 30px rgba(244, 63, 94, 0.25)' 
          : '0 8px 24px rgba(0, 0, 0, 0.25)',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: hasNewUpdate ? 'rgba(244, 63, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: hasNewUpdate 
                ? 'linear-gradient(135deg, #f43f5e, #be123c)' 
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
          >
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
              Thông tin phiên bản ứng dụng
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Quản lý và cập nhật tính năng mới nhất
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {hasNewUpdate ? (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '12px',
                background: 'rgba(244, 63, 94, 0.2)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <AlertTriangle size={12} /> Có bản mới!
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.18)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CheckCircle2 size={12} /> Bản mới nhất
            </span>
          )}
        </div>
      </div>

      {/* Version Grid Comparison */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        {/* Phiên bản máy bạn đang dùng */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
            Phiên bản đang dùng:
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
            {currentVersion}
          </div>
          {currentBuildTime && (
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
              Build: {formatDate(currentBuildTime)}
            </div>
          )}
        </div>

        {/* Phiên bản mới nhất trên Server */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
            Bản mới nhất trên máy chủ:
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: hasNewUpdate ? '#fb7185' : '#34d399', marginTop: '2px' }}>
            {serverVersion || (checking ? 'Đang kiểm tra...' : currentVersion)}
          </div>
          {serverBuildTime && (
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
              Server: {formatDate(serverBuildTime)}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* Nút Cập nhật ngay / Tải lại */}
        <button
          type="button"
          onClick={() => {
            showToast('🔄 Đang xóa sạch cache và nạp bản mới nhất từ server...', 'info');
            void forceReloadLatestVersion();
          }}
          style={{
            flex: '1 1 140px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: 'none',
            background: hasNewUpdate 
              ? 'linear-gradient(135deg, #f43f5e, #be123c)' 
              : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <RefreshCw size={14} /> {hasNewUpdate ? 'Cập nhật ngay' : 'Tải lại bản mới nhất'}
        </button>

        {/* Nút Kiểm tra server */}
        <button
          type="button"
          onClick={() => checkVersion(true)}
          disabled={checking}
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Search size={14} /> {checking ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </button>

        {/* Nút Xem lịch sử */}
        <button
          type="button"
          onClick={onOpenChangelog}
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <History size={14} /> Lịch sử
        </button>
      </div>
    </div>
  );
}
