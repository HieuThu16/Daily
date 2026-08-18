import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared'
import {
  CategoryOverrides,
  REVIEW_CATEGORIES,
  TVSHOW_CATEGORIES,
  VideoCategoryType,
  detectVideoCategories,
} from '../../lib/videoCategorizer'

/**
 * Hộp thoại sửa tay thể loại cho 1 hoặc nhiều video cùng lúc.
 * Ghi vào bảng video_category_overrides, bỏ chọn hết = ép về "Tổng hợp & Khác".
 */
export function CategoryEditModal({
  videos,
  type,
  overrides,
  onClose,
  onSaved,
}: {
  videos: { video_id: string; title: string }[]
  type: VideoCategoryType
  overrides: CategoryOverrides
  onClose: () => void
  onSaved: (videoIds: string[], ids: string[] | null) => void
}) {
  const categories = type === 'tvshow' ? TVSHOW_CATEGORIES : REVIEW_CATEGORIES
  const isBulk = videos.length > 1
  const first = videos[0]
  const isManual = videos.some((v) => overrides[v.video_id])
  const [selected, setSelected] = useState<string[]>(
    // Nhiều video: mở với danh sách rỗng để người dùng chọn thể loại chung
    isBulk ? [] : overrides[first.video_id] ?? detectVideoCategories(first.title, type).map((c) => c.id)
  )
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const save = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    await supabase
      ?.from('video_category_overrides')
      .upsert(
        videos.map((v) => ({ video_id: v.video_id, type, category_ids: selected, updated_at: now })),
        { onConflict: 'video_id,type' }
      )
    onSaved(videos.map((v) => v.video_id), selected)
    setSaving(false)
    onClose()
  }

  // Xoá bản sửa tay -> quay lại nhận diện tự động từ tiêu đề
  const reset = async () => {
    setSaving(true)
    await supabase
      ?.from('video_category_overrides')
      .delete()
      .in('video_id', videos.map((v) => v.video_id))
      .eq('type', type)
    onSaved(videos.map((v) => v.video_id), null)
    setSaving(false)
    onClose()
  }

  return (
    <Modal title={isBulk ? `Gán thể loại cho ${videos.length} video` : 'Sửa thể loại video'} onClose={onClose}>
      <div className="tv-cat-edit">
        <div className="tv-cat-edit-title">
          {isBulk ? `${first.title}${videos.length > 1 ? ` … và ${videos.length - 1} video khác` : ''}` : first.title}
        </div>
        <div className="tv-cat-edit-hint">
          {isBulk
            ? 'Thể loại đã chọn sẽ ghi đè cho toàn bộ video đang chọn.'
            : isManual
              ? 'Video này đang dùng thể loại bạn tự chọn.'
              : 'Đang dùng thể loại tự nhận diện từ tiêu đề. Chọn lại để ghi đè.'}
        </div>

        <div className="tv-cat-edit-list">
          {categories.map((c) => {
            const on = selected.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                className={`tv-cat-edit-chip${on ? ' on' : ''}`}
                style={on ? { borderColor: c.color, color: c.color } : undefined}
                onClick={() => toggle(c.id)}
              >
                <span>{c.icon}</span> {c.name}
              </button>
            )
          })}
        </div>

        <div className="tv-cat-edit-actions">
          {isManual && (
            <button type="button" className="tv-btn" disabled={saving} onClick={() => void reset()}>
              Về tự động
            </button>
          )}
          <button type="button" className="tv-btn" disabled={saving} onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className="tv-btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Đang lưu…' : `Lưu ${selected.length} thể loại`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
