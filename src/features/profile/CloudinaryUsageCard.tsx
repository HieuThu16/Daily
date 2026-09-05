import { useEffect, useState, useCallback } from 'react'
import { Cloud, RefreshCw, HardDrive, Globe, FileImage, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getCloudinaryUsage, type CloudinaryUsageData } from '../../lib/storageService'

function formatBytes(bytes: number = 0): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function CloudinaryUsageCard() {
  const [data, setData] = useState<CloudinaryUsageData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUsage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCloudinaryUsage()
      setData(res)
    } catch {
      setData({ configured: false, error: 'Lỗi tải thông tin' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsage()
  }, [loadUsage])

  if (loading && !data) {
    return (
      <div style={{
        padding: '16px',
        borderRadius: '16px',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-secondary, #64748b)',
        fontSize: '14px',
      }}>
        <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        <span>Đang kiểm tra dung lượng Cloudinary...</span>
      </div>
    )
  }

  const isConfigured = data?.configured

  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: '16px',
      background: 'var(--bg-card, #ffffff)',
      border: isConfigured ? '1px solid #0284c740' : '1px solid #f59e0b40',
      marginBottom: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: isConfigured ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isConfigured ? '#ffffff' : '#d97706',
          }}>
            <Cloud size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Kho lưu trữ Cloudinary</span>
              {isConfigured ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <CheckCircle2 size={12} /> Đã kết nối ({data?.cloudName})
                </span>
              ) : (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#fef3c7',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <AlertCircle size={12} /> Chưa cấu hình
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
              {isConfigured ? `Gói: ${data?.plan || 'Free Tier'} (Hạn mức 25 Credits/tháng)` : 'Lưu trữ ảnh & video miễn phí không giới hạn băng thông'}
            </div>
          </div>
        </div>

        <button
          onClick={loadUsage}
          disabled={loading}
          title="Làm mới thống kê"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            color: 'var(--text-secondary, #64748b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {!isConfigured ? (
        /* Unconfigured banner */
        <div style={{
          padding: '12px 14px',
          background: '#fffbeb',
          borderRadius: '10px',
          border: '1px solid #fde68a',
          fontSize: '13px',
          color: '#92400e',
          lineHeight: '1.5',
        }}>
          <strong>Chưa thêm khóa Cloudinary trong .env:</strong>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px' }}>
            Vui lòng mở file <code>.env</code> và thêm:
          </p>
          <pre style={{
            background: '#ffffff',
            padding: '8px 10px',
            borderRadius: '6px',
            margin: '8px 0 0 0',
            fontSize: '11px',
            color: '#1e293b',
            overflowX: 'auto',
            border: '1px solid #e2e8f0',
          }}>
{`CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret`}
          </pre>
          <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#b45309' }}>
            (Sau khi thêm, mọi ảnh/video sẽ tự động lưu sang Cloudinary và hiển thị dung lượng tại đây)
          </p>
        </div>
      ) : (
        /* Configured statistics */
        <div>
          {/* Credit Progress Bar */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary, #64748b)' }}>
                Credits đã dùng: <strong>{(data?.credits?.used || 0).toFixed(2)}</strong> / {data?.credits?.limit || 25} credits
              </span>
              <span style={{ fontWeight: 600, color: (data?.credits?.percent || 0) > 80 ? '#dc2626' : '#0284c7' }}>
                {(data?.credits?.percent || 0).toFixed(1)}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              borderRadius: '999px',
              background: '#e2e8f0',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, data?.credits?.percent || 0)}%`,
                background: (data?.credits?.percent || 0) > 80 ? '#dc2626' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* 3 Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'var(--bg-card-subtle, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginBottom: '4px' }}>
                <HardDrive size={13} style={{ color: '#0284c7' }} />
                <span>Dung lượng</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                {formatBytes(data?.storage?.usedBytes)}
              </div>
            </div>

            <div style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'var(--bg-card-subtle, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginBottom: '4px' }}>
                <Globe size={13} style={{ color: '#10b981' }} />
                <span>Băng thông</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                {formatBytes(data?.bandwidth?.usedBytes)}
              </div>
            </div>

            <div style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'var(--bg-card-subtle, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginBottom: '4px' }}>
                <FileImage size={13} style={{ color: '#8b5cf6' }} />
                <span>Số tệp</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                {data?.objects?.count || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
