import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { enablePush, pushEnabled, pushSupported } from '../lib/push'
import { usePendingNudge } from '../lib/pushNudge'
import { useToast } from './ToastContext'

/**
 * Bảng nhắc bật thông báo, hiện khi có người bấm “Nhắc bật” cho mình.
 *
 * Phải là bảng TRONG APP chứ không phải thông báo đẩy: người chưa bật thông báo
 * thì không đẩy tới họ được — đó chính là lý do cần nhắc.
 */
export function PushNudgeBanner() {
  const { showToast } = useToast()
  /** null = chưa biết; tránh loé bảng rồi biến mất khi hoá ra đã bật. */
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const { nudge, dismiss } = usePendingNudge(enabled)

  useEffect(() => {
    if (!pushSupported()) {
      // Máy này không bật được thì nhắc cũng vô ích — coi như xong.
      setEnabled(true)
      return
    }
    void pushEnabled().then(setEnabled)
  }, [])

  if (!nudge) return null

  const turnOn = async () => {
    setBusy(true)
    try {
      await enablePush()
      setEnabled(true)
      dismiss()
      showToast('🔔 Đã bật thông báo — từ giờ tắt app vẫn nhận được')
    } catch (err) {
      showToast(`❌ ${err instanceof Error ? err.message : 'Không bật được thông báo.'}`, 'delete')
    } finally {
      setBusy(false)
    }
  }

  const who = nudge.from_email.split('@')[0]

  return (
    <div className="nudge-banner" role="status">
      <span className="nudge-banner-icon"><BellRing size={17} /></span>
      <span className="nudge-banner-text">
        <b>{who} nhắc bạn bật thông báo</b>
        <span>Bật để nhận được khi có người gửi kỷ niệm hay mục xem chung, kể cả lúc đã tắt app.</span>
      </span>
      <button type="button" className="nudge-banner-cta" disabled={busy} onClick={() => void turnOn()}>
        {busy ? 'Đang bật…' : 'Bật ngay'}
      </button>
      <button type="button" className="nudge-banner-close" aria-label="Để sau" onClick={dismiss}>
        <X size={15} />
      </button>
    </div>
  )
}
