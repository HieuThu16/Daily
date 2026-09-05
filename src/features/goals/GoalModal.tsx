import { useEffect, useRef, useState } from 'react'
import { Camera, Edit3, FolderCog, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Modal } from '../shared'
import { compressForUpload } from '../../lib/photo'
import { uploadMediaFile } from '../../lib/storageService'
import { supabase } from '../../lib/supabase'
import { useSharedCategories } from '../../lib/sharedCategories'
import type { GoalItem } from '../../types'

type GoalModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (goal: Omit<GoalItem, 'id' | 'created_at'>) => Promise<void>
  initialGoal?: GoalItem | null
}

const PHOTO_BUCKET = 'daily-photos'

const DEFAULT_COLOR_PALETTE = ['#8b5cf6', '#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1']

export function GoalModal({ isOpen, onClose, onSave, initialGoal }: GoalModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { categories, addCategory, renameCategory, deleteCategory } = useSharedCategories()

  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [categoryName, setCategoryName] = useState<string>('')
  const [targetDate, setTargetDate] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [color, setColor] = useState('#8b5cf6')
  const [icon, setIcon] = useState('🌟')

  // Quản lý thể loại
  const [manageCategoriesModal, setManageCategoriesModal] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialGoal) {
      setTitle(initialGoal.title)
      setReason(initialGoal.reason || initialGoal.description || '')
      setCategoryName(initialGoal.category_label || initialGoal.category || '')
      setTargetDate(initialGoal.target_date || '')
      setImageUrl(initialGoal.image_url || '')
      setImagePath(initialGoal.image_path || null)
      setColor(initialGoal.color || '#8b5cf6')
      setIcon(initialGoal.icon || '🌟')
    } else {
      setTitle('')
      setReason('')
      setCategoryName(categories[0]?.name || 'Phát triển bản thân')
      setTargetDate('')
      setImageUrl('')
      setImagePath(null)
      setColor('#8b5cf6')
      setIcon('🌟')
    }
  }, [initialGoal, isOpen, categories])

  if (!isOpen) return null

  const handleSelectCategory = (catName: string, index: number) => {
    setCategoryName(catName)
    const assignedColor = DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length]
    setColor(assignedColor)
  }

  const handleUploadImage = async (file: File) => {
    if (!supabase) return
    setUploading(true)
    try {
      const compressed = await compressForUpload(file)
      const fileId = `${Date.now()}_${crypto.randomUUID()}`
      const path = `goals/${fileId}.${compressed.ext}`

      const uploaded = await uploadMediaFile(compressed.blob, {
        folder: 'goals',
        fileName: fileId,
        bucketFallback: PHOTO_BUCKET,
        resourceType: 'image',
      })

      setImageUrl(uploaded.url)
      setImagePath(uploaded.url.includes('cloudinary.com') ? uploaded.url : path)
    } catch (err) {
      console.warn('Lỗi tải ảnh mục tiêu:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleAddCategoryInline = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newCatInput.trim()) return
    const added = await addCategory(newCatInput.trim())
    if (added) {
      setCategoryName(added.name)
    }
    setNewCatInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        reason: reason.trim() || null,
        description: reason.trim() || null,
        category: categoryName || 'Chung',
        category_label: categoryName || 'Mục tiêu',
        target_date: targetDate || null,
        image_url: imageUrl.trim() || null,
        image_path: imagePath || null,
        color,
        icon,
        status: initialGoal?.status || 'NOT_STARTED',
        current_value: initialGoal?.current_value || 0,
        target_value: initialGoal?.target_value || 1,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal onClose={onClose} title={initialGoal ? '✏️ Chỉnh Sửa Mục Tiêu' : '🎯 Tạo Mục Tiêu Mới'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Tên mục tiêu */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Tên mục tiêu *
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{
                  fontSize: '1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${color}22`,
                  border: `1.5px solid ${color}`,
                  flexShrink: 0,
                }}
              >
                {icon}
              </span>
              <input
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Mua nhà trước 30 tuổi, Đạt IELTS 7.5, Tiết kiệm 500 triệu…"
                style={{
                  flex: 1,
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1.5px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* 2. Thể loại mục tiêu (Đồng bộ 100% với bên Tasks) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                Phân loại thể loại (Đồng bộ với Công việc)
              </label>
              <button
                type="button"
                onClick={() => setManageCategoriesModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 0,
                  color: 'var(--primary)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <FolderCog size={13} /> Quản lý thể loại
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 150, overflowY: 'auto' }}>
              {categories.map((cat, idx) => {
                const isSelected = categoryName === cat.name
                const catColor = DEFAULT_COLOR_PALETTE[idx % DEFAULT_COLOR_PALETTE.length]
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.name, idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? catColor : 'var(--card-border)'}`,
                      background: isSelected ? `${catColor}22` : 'var(--card-bg)',
                      color: isSelected ? catColor : 'var(--text-main)',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <span>{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Lí do & Động lực */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              💡 Lí do & Động lực đạt được mục tiêu
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tại sao mục tiêu này quan trọng với bạn? Điều gì thôi thúc bạn nỗ lực mỗi ngày?…"
              style={{
                width: '100%',
                fontSize: '0.85rem',
                padding: '10px 14px',
                borderRadius: 12,
                border: '1.5px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.45,
              }}
            />
          </div>

          {/* 4. Deadline đạt được */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              📅 Deadline đạt được
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{
                width: '100%',
                fontSize: '0.85rem',
                padding: '10px 14px',
                borderRadius: 12,
                border: '1.5px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>

          {/* 5. Ảnh mục tiêu (Vision Board) */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              🖼️ Ảnh mục tiêu (Vision Board)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void handleUploadImage(file)
              }}
            />

            {imageUrl ? (
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', maxHeight: 180, background: '#000', border: '1px solid rgba(255,255,255,0.2)' }}>
                <img src={imageUrl} alt="Ảnh mục tiêu" style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('')
                    setImagePath(null)
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    border: 0,
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Gỡ ảnh"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    border: '1.5px dashed var(--primary)',
                    background: 'rgba(56, 189, 248, 0.08)',
                    color: 'var(--primary)',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {uploading ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Camera size={16} />
                  )}
                  <span>{uploading ? 'Đang tải ảnh lên…' : '📷 Tải ảnh mục tiêu từ thiết bị'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>hoặc dán link ảnh:</span>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/…"
                    style={{
                      flex: 1,
                      fontSize: '0.78rem',
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--card-border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Nút hành động */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                border: '1.5px solid var(--card-border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="tv-btn primary"
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                fontSize: '0.86rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={16} />
              <span>{saving ? 'Đang lưu…' : initialGoal ? 'Lưu Thay Đổi' : 'Khởi Tạo Mục Tiêu'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL QUẢN LÝ THỂ LOẠI DÙNG CHUNG CHO CẢ 2 BÊN */}
      {manageCategoriesModal && (
        <Modal onClose={() => setManageCategoriesModal(false)} title="⚙️ Quản Lý Thể Loại (Tasks & Goals)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Form thêm thể loại mới */}
            <form onSubmit={handleAddCategoryInline} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Tên thể loại mới (VD: 🚗 Xe cộ, 🎓 Du học…)"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!newCatInput.trim()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 0,
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: newCatInput.trim() ? 1 : 0.5,
                }}
              >
                <Plus size={14} /> Thêm
              </button>
            </form>

            {/* Danh sách thể loại hiện tại */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{cat.name}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const nextName = prompt('Nhập tên thể loại mới:', cat.name)
                        if (nextName) await renameCategory(cat.id, cat.name, nextName)
                      }}
                      style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      title="Đổi tên thể loại"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Xoá thể loại "${cat.name}"? (Các công việc và mục tiêu thuộc thể loại này sẽ được giữ lại)`)) {
                          await deleteCategory(cat.id, cat.name)
                        }
                      }}
                      style={{ background: 'none', border: 0, color: '#f43f5e', cursor: 'pointer', padding: 4 }}
                      title="Xoá thể loại"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                className="tv-btn primary"
                onClick={() => setManageCategoriesModal(false)}
                style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem' }}
              >
                Xong
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
