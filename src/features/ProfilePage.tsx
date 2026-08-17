import { useEffect, useRef, useState } from 'react'
import {
  Bell, BellOff, CheckCircle2, ChevronRight, Clock, Download,
  HardDriveDownload, History, LogOut, Settings, Sparkles,
  SunMoon, X, Zap,
} from 'lucide-react'
import type { ChangelogEntry } from '../data/changelog'
import { CHANGELOG, getUnseenLatest, markLatestSeen } from '../data/changelog'
import { exportBackup } from '../lib/backup'
import { disablePush, enablePush, pushEnabled, pushSupported } from '../lib/push'
import { supabase } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
}

const INSTALL_HINT = 'Trình duyệt này chưa cho cài tự động.\n\n• iPhone/iPad (Safari): nút Chia sẻ → "Thêm vào MH chính".\n• Android (Chrome): menu ⋮ → "Cài đặt ứng dụng".\n• Máy tính: biểu tượng cài đặt ở thanh địa chỉ.\n\nNếu đã cài rồi thì mở app từ màn hình chính nhé.'

const TYPE_META: Record<ChangelogEntry['type'], { label: string; color: string }> = {
  feature: { label: 'Tính năng mới', color: 'var(--primary)' },
  improvement: { label: 'Cải tiến', color: '#0891b2' },
  fix: { label: 'Sửa lỗi', color: '#16a34a' },
}

// ─── Global Update Toast (hiện khi vừa vào app) ───────────────────────────────

export function UpdateToast() {
  const [entry, setEntry] = useState<ChangelogEntry | null>(null)
  const [visible, setVisible] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)

  useEffect(() => {
    const unseen = getUnseenLatest()
    if (unseen) {
      // Delay nhỏ để trang load xong mới hiện
      const t = setTimeout(() => {
        setEntry(unseen)
        setVisible(true)
      }, 800)
      return () => clearTimeout(t)
    }
  }, [])

  const handleDismiss = () => {
    markLatestSeen()
    setVisible(false)
    setTimeout(() => setEntry(null), 350)
  }

  const handleViewHistory = () => {
    markLatestSeen()
    setVisible(false)
    setTimeout(() => {
      setEntry(null)
      setShowChangelog(true)
    }, 350)
  }

  if (!entry && !showChangelog) return null

  return (
    <>
      {entry && (
        <div className={`update-toast ${visible ? 'update-toast--visible' : 'update-toast--hidden'}`}>
          <div className="ut-icon">
            <Zap size={16} />
          </div>
          <div className="ut-body">
            <div className="ut-label">Cập nhật mới · {entry.version && `v${entry.version}`}</div>
            <div className="ut-title">{entry.title}</div>
            <ul className="ut-highlights">
              {entry.highlights.slice(0, 2).map((h, i) => (
                <li key={i}><CheckCircle2 size={11} />{h}</li>
              ))}
              {entry.highlights.length > 2 && (
                <li className="ut-more">+{entry.highlights.length - 2} điểm mới khác</li>
              )}
            </ul>
            <div className="ut-actions">
              <button className="ut-btn-history" onClick={handleViewHistory}>
                <History size={12} />
                Xem chi tiết
              </button>
              <button className="ut-btn-dismiss" onClick={handleDismiss}>Đã hiểu</button>
            </div>
          </div>
          <button className="ut-close" onClick={handleDismiss} aria-label="Đóng">
            <X size={14} />
          </button>
        </div>
      )}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </>
  )
}

// ─── Changelog Modal ──────────────────────────────────────────────────────────

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="changelog-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="changelog-modal" role="dialog" aria-modal="true" aria-label="Lịch sử cập nhật">
        <div className="changelog-modal-head">
          <div className="changelog-modal-title">
            <History size={20} />
            <span>Lịch sử cập nhật</span>
          </div>
          <button className="icon" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className="changelog-modal-body">
          {CHANGELOG.map((entry, idx) => {
            const meta = TYPE_META[entry.type]
            return (
              <div key={entry.id} className={`cl-entry ${idx === 0 ? 'cl-entry--latest' : ''}`}>
                <div className="cl-entry-dot" style={{ background: meta.color }} />
                <div className="cl-entry-content">
                  <div className="cl-entry-meta">
                    <span className="cl-entry-badge" style={{ color: meta.color, background: meta.color + '18' }}>
                      {meta.label}
                    </span>
                    {entry.version && <span className="cl-entry-version">v{entry.version}</span>}
                    {idx === 0 && <span className="cl-entry-new-badge">Mới</span>}
                  </div>
                  <div className="cl-entry-title">{entry.title}</div>
                  <div className="cl-entry-date">
                    <Clock size={12} />
                    {fmtDate(entry.date)}
                  </div>
                  <p className="cl-entry-desc">{entry.description}</p>
                  <ul className="cl-entry-highlights">
                    {entry.highlights.map((h, i) => (
                      <li key={i}>
                        <ChevronRight size={13} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Settings Page ───────────────────────────────────────────────────────────

interface SettingsPageProps {
  user: { email?: string | null; full_name?: string | null; avatar_url?: string | null; created_at?: string | null }
  dark: boolean
  onToggleDark: () => void
  canInstall: boolean
  onInstallPWA: () => void
}

export function SettingsPage({ user, dark, onToggleDark, canInstall, onInstallPWA }: SettingsPageProps) {
  const [showChangelog, setShowChangelog] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    void pushEnabled().then(setPushOn)
  }, [])

  const togglePush = async () => {
    setPushBusy(true)
    try {
      if (pushOn) { await disablePush(); setPushOn(false) }
      else { await enablePush(); setPushOn(true) }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không bật được thông báo.')
    } finally { setPushBusy(false) }
  }

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const backup = await exportBackup()
      if (backup.failed.length) alert(`Đã tải bản sao lưu. Bỏ qua bảng chưa có: ${backup.failed.join(', ')}`)
    } catch {
      alert('Chưa sao lưu được — kiểm tra kết nối Supabase.')
    }
    setBackingUp(false)
  }

  const displayName = user.full_name || user.email?.split('@')[0] || 'Người dùng'
  const joinDate = localStorage.getItem('daily_joined_at')
  const memberDays = joinDate ? Math.max(1, Math.floor((Date.now() - new Date(joinDate).getTime()) / 86_400_000)) : null

  return (
    <div className="settings-page">
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      <div className="settings-page-container">
        {/* Header */}
        <div className="settings-page-head">
          <div className="settings-head-icon">
            <Settings size={20} />
          </div>
          <span className="settings-page-title">Cài đặt</span>
        </div>

        <div className="settings-page-body">

            {/* Thông tin cá nhân */}
            <div className="settings-section">
              <div className="settings-section-label">Cá nhân</div>
              <div className="settings-group">
                <div className="settings-profile-card-inline">
                  <div className="spc-avatar">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={displayName} referrerPolicy="no-referrer" />
                    ) : (
                      <span>{displayName[0]?.toUpperCase() ?? '?'}</span>
                    )}
                  </div>
                  <div className="spc-info">
                    <div className="spc-name">{displayName}</div>
                    {user.email && <div className="spc-email">{user.email}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Lịch sử cập nhật */}
            <div className="settings-section">
              <div className="settings-section-label">Cập nhật ứng dụng</div>
              <div className="settings-group">
                <button className="settings-row" onClick={() => setShowChangelog(true)}>
                  <div className="sr-icon sr-icon--emerald"><History size={16} /></div>
                  <span className="sr-label">Lịch sử cập nhật</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Dữ liệu & Tải về */}
            <div className="settings-section">
              <div className="settings-section-label">Dữ liệu & thiết bị</div>
              <div className="settings-group">

                {/* Tải dữ liệu về máy */}
                <button className="settings-row" onClick={handleBackup} disabled={backingUp}>
                  <div className="sr-icon sr-icon--amber"><HardDriveDownload size={16} /></div>
                  <span className="sr-label">{backingUp ? 'Đang tải…' : 'Tải dữ liệu về máy'}</span>
                  <ChevronRight size={15} />
                </button>

                {/* Cài app PWA — luôn hiện; trình duyệt không hỗ trợ prompt thì chỉ dẫn thủ công */}
                <button
                  className="settings-row settings-row--highlight"
                  onClick={() => (canInstall ? onInstallPWA() : alert(INSTALL_HINT))}
                >
                  <div className="sr-icon sr-icon--primary"><Download size={16} /></div>
                  <div className="sr-label-group">
                    <span className="sr-label">Cài Daily về máy</span>
                    <span className="sr-sub">Dùng như app thật, không cần trình duyệt</span>
                  </div>
                  <ChevronRight size={15} />
                </button>

              </div>
            </div>

            {/* Giao diện & Thông báo */}
            <div className="settings-section">
              <div className="settings-section-label">Giao diện & thông báo</div>
              <div className="settings-group">

                {/* Dark mode */}
                <button className="settings-row" onClick={onToggleDark}>
                  <div className="sr-icon sr-icon--cyan"><SunMoon size={16} /></div>
                  <span className="sr-label">{dark ? 'Giao diện tối' : 'Giao diện sáng'}</span>
                  <div className={`sr-toggle ${dark ? 'sr-toggle--on' : ''}`}>
                    <div className="sr-toggle-thumb" />
                  </div>
                </button>

                {/* Push notifications */}
                {pushSupported() && (
                  <button className="settings-row" onClick={() => void togglePush()} disabled={pushBusy}>
                    <div className="sr-icon sr-icon--rose">
                      {pushOn ? <Bell size={16} /> : <BellOff size={16} />}
                    </div>
                    <span className="sr-label">{pushOn ? 'Nhắc việc: Đang bật' : 'Nhắc việc: Tắt'}</span>
                    <div className={`sr-toggle ${pushOn ? 'sr-toggle--on' : ''}`}>
                      <div className="sr-toggle-thumb" />
                    </div>
                  </button>
                )}

              </div>
            </div>

            {/* Tài khoản */}
            <div className="settings-section">
              <div className="settings-group">
                <button className="settings-row settings-row--danger" onClick={() => supabase?.auth.signOut()}>
                  <div className="sr-icon sr-icon--danger"><LogOut size={16} /></div>
                  <span className="sr-label">Đăng xuất</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
  )
}

// ─── Settings Trigger Button ───────────────────────────────────────────────────
// Dùng để export icon nút Cài đặt, dùng trong Shell

export { Settings as SettingsIcon }
