import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  X, UploadCloud, Images, Trash2, Check,
  Search, ChevronDown, Sparkles, Loader2
} from 'lucide-react'
import {
  fetchHMangaList,
  getCustomHMangaList,
  getHMangaHistory,
  type HManga
} from './hMangaService'
import { saveHMangaScreenshot, type HMangaScreenshot } from './hMangaScreenshot'
import { uploadMediaFile } from '../../lib/storageService'
import { useToast } from '../ToastContext'
import { Z } from '../../lib/zLayers'

interface SelectedFileItem {
  id: string
  file: File
  previewUrl: string
  dataUrl?: string
}

export function UploadMangaScreenshotModal({
  isOpen,
  onClose,
  onUploaded,
  defaultSlug,
}: {
  isOpen: boolean
  onClose: () => void
  onUploaded: (newShots: HMangaScreenshot[]) => void
  defaultSlug?: string | null
}) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([])
  const [selectedManga, setSelectedManga] = useState<{ slug: string; title: string; chapterNum: number; chapterName: string } | null>(null)
  const [chapterNameInput, setChapterNameInput] = useState('Ảnh kỷ niệm')
  const [mangaSearch, setMangaSearch] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savingProgress, setSavingProgress] = useState({ current: 0, total: 0 })

  const [allManga, setAllManga] = useState<HManga[]>([])
  const [historyMap, setHistoryMap] = useState<Record<string, any>>({})

  // Tải danh sách truyện và lịch sử đọc
  useEffect(() => {
    if (!isOpen) return
    const custom = getCustomHMangaList()
    const history = getHMangaHistory()
    setHistoryMap(history)

    void fetchHMangaList().then((list) => {
      const map = new Map<string, HManga>()
      for (const m of custom) if (m?.slug) map.set(m.slug, m)
      for (const m of list) if (m?.slug && !map.has(m.slug)) map.set(m.slug, m)
      setAllManga(Array.from(map.values()))
    })
  }, [isOpen])

  // Danh sách truyện có ưu tiên các bộ trong "Đang đọc" lên đầu
  const sortedMangaOptions = useMemo(() => {
    const historySlugs = Object.keys(historyMap)

    const inHistory: Array<{ slug: string; title: string; isHistory: boolean; lastChapter?: number }> = []
    const others: Array<{ slug: string; title: string; isHistory: boolean }> = []

    const seen = new Set<string>()

    // Ưu tiên truyện trong lịch sử đọc
    for (const slug of historySlugs) {
      const m = allManga.find((item) => item.slug === slug)
      const title = m?.title || historyMap[slug]?.title || slug
      inHistory.push({
        slug,
        title,
        isHistory: true,
        lastChapter: historyMap[slug]?.chapterNumber || 1,
      })
      seen.add(slug)
    }

    // Các truyện còn lại
    for (const m of allManga) {
      if (!seen.has(m.slug)) {
        others.push({
          slug: m.slug,
          title: m.title,
          isHistory: false,
        })
        seen.add(m.slug)
      }
    }

    const combined = [...inHistory, ...others]
    if (!mangaSearch.trim()) return combined

    const q = mangaSearch.toLowerCase().trim()
    return combined.filter((item) => item.title.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q))
  }, [allManga, historyMap, mangaSearch])

  // Chọn mặc định nếu có defaultSlug hoặc tự chọn bộ đầu tiên trong history
  useEffect(() => {
    if (!selectedManga && sortedMangaOptions.length > 0) {
      if (defaultSlug) {
        const found = sortedMangaOptions.find((o) => o.slug === defaultSlug)
        if (found) {
          setSelectedManga({
            slug: found.slug,
            title: found.title,
            chapterNum: found.isHistory ? (historyMap[found.slug]?.chapterNumber || 1) : 1,
            chapterName: found.isHistory ? `Chapter ${historyMap[found.slug]?.chapterNumber || 1}` : 'Ảnh từ máy',
          })
          return
        }
      }

      const first = sortedMangaOptions[0]
      setSelectedManga({
        slug: first.slug,
        title: first.title,
        chapterNum: first.isHistory ? (historyMap[first.slug]?.chapterNumber || 1) : 1,
        chapterName: first.isHistory ? `Chapter ${historyMap[first.slug]?.chapterNumber || 1}` : 'Ảnh từ máy',
      })
    }
  }, [sortedMangaOptions, defaultSlug, selectedManga, historyMap])

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isDropdownOpen])

  if (!isOpen) return null

  // Chọn file từ máy
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newItems: SelectedFileItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newItems.push({
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })
      }
    }

    setSelectedFiles((prev) => [...prev, ...newItems])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Xóa 1 ảnh khỏi danh sách chọn
  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => {
      const item = prev.find((f) => f.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  // Nén ảnh sang base64 data URL
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          const maxDim = 1600

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(String(e.target?.result))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.88))
        }
        img.onerror = () => resolve(String(e.target?.result))
        img.src = String(e.target?.result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Thực hiện lưu toàn bộ ảnh đã chọn
  const handleSave = async () => {
    if (selectedFiles.length === 0) {
      showToast('⚠️ Vui lòng chọn ít nhất 1 ảnh từ máy', 'delete')
      return
    }
    if (!selectedManga) {
      showToast('⚠️ Vui lòng chọn bộ truyện cho ảnh', 'delete')
      return
    }

    setIsSaving(true)
    setSavingProgress({ current: 0, total: selectedFiles.length })

    const savedList: HMangaScreenshot[] = []

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const item = selectedFiles[i]
        setSavingProgress({ current: i + 1, total: selectedFiles.length })

        const dataUrl = await compressImage(item.file)
        let finalUrl = dataUrl
        try {
          const uploaded = await uploadMediaFile(item.file, {
            folder: 'manga-screenshots',
            fileName: `${selectedManga.slug}_${Date.now()}_${i}`,
            bucketFallback: 'daily-photos',
            resourceType: 'image',
          })
          if (uploaded?.url) {
            finalUrl = uploaded.url
          }
        } catch {
          // Fallback to dataUrl
        }

        const shot = await saveHMangaScreenshot({
          mangaSlug: selectedManga.slug,
          mangaTitle: selectedManga.title,
          chapterNumber: selectedManga.chapterNum || 1,
          chapterName: chapterNameInput.trim() || selectedManga.chapterName || 'Ảnh từ máy',
          imageData: finalUrl,
        })
        savedList.push(shot)
      }

      onUploaded(savedList)
      showToast(`🎉 Đã tải lên thành công ${savedList.length} ảnh vào kho!`)
      onClose()
    } catch (err: any) {
      console.error('Lỗi khi tải ảnh:', err)
      showToast(`❌ Lỗi khi lưu ảnh: ${err?.message || err}`, 'delete')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: Z.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '22px',
          color: '#f4f4f5',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
              }}
            >
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Tải ảnh từ bộ sưu tập máy</h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#a1a1aa' }}>
                Chọn một hoặc nhiều ảnh lưu vào kho ảnh chụp Truyện H
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              color: '#a1a1aa',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── 1. COMBOBOX CHỌN BỘ TRUYỆN (ƯU TIÊN ĐANG ĐỌC) ── */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: '#e4e4e7' }}>
            Thuộc bộ truyện <span style={{ color: '#f43f5e' }}>*</span>
          </label>

          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f4f4f5',
                fontSize: '0.86rem',
                fontWeight: 600,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedManga?.slug && historyMap[selectedManga.slug] && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(244, 63, 94, 0.25)',
                      color: '#fb7185',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    Đang đọc
                  </span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedManga?.title || 'Chọn bộ truyện...'}
                </span>
              </div>
              <ChevronDown size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  maxHeight: '260px',
                  backgroundColor: '#27272a',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  borderRadius: '14px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                  zIndex: 100,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Search input in dropdown */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input
                      type="text"
                      placeholder="Tìm tên truyện..."
                      value={mangaSearch}
                      onChange={(e) => setMangaSearch(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        color: '#f4f4f5',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Items List */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
                  {sortedMangaOptions.map((opt) => {
                    const isSelected = selectedManga?.slug === opt.slug
                    return (
                      <button
                        key={opt.slug}
                        type="button"
                        onClick={() => {
                          setSelectedManga({
                            slug: opt.slug,
                            title: opt.title,
                            chapterNum: opt.isHistory ? (historyMap[opt.slug]?.chapterNumber || 1) : 1,
                            chapterName: opt.isHistory ? `Chapter ${historyMap[opt.slug]?.chapterNumber || 1}` : 'Ảnh từ máy',
                          })
                          setIsDropdownOpen(false)
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: isSelected ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                          color: isSelected ? '#f472b6' : '#f4f4f5',
                          border: 'none',
                          fontSize: '0.82rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          {opt.isHistory ? (
                            <span
                              style={{
                                fontSize: '0.64rem',
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: '#f43f5e',
                                color: '#fff',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              Đang đọc
                            </span>
                          ) : (
                            <Sparkles size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opt.title}
                          </span>
                        </div>
                        {isSelected && <Check size={14} style={{ color: '#f472b6', flexShrink: 0 }} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ghi chú / Tên Chapter */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: '#e4e4e7' }}>
            Tên chương / Ghi chú ảnh
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Chapter 15, Ảnh bìa đẹp, Khoảnh khắc yêu thích..."
            value={chapterNameInput}
            onChange={(e) => setChapterNameInput(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f4f4f5',
              fontSize: '0.86rem',
              outline: 'none',
            }}
          />
        </div>

        {/* ── 2. KHU VỰC CHỌN ẢNH TỪ MÁY (MULTIPLE) ── */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e4e4e7' }}>
              Danh sách ảnh ({selectedFiles.length} ảnh) <span style={{ color: '#f43f5e' }}>*</span>
            </label>
            {selectedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFiles([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Xóa tất cả
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Button Trigger Chọn ảnh */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(236, 72, 153, 0.4)',
              borderRadius: '14px',
              padding: '20px 16px',
              textAlign: 'center',
              backgroundColor: 'rgba(236, 72, 153, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: selectedFiles.length > 0 ? '12px' : '0',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#ec4899',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 8px',
              }}
            >
              <Images size={22} />
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f4f4f5' }}>
              Bấm để chọn ảnh từ bộ sưu tập máy
            </div>
            <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: 4 }}>
              Hỗ trợ chọn nhiều ảnh cùng lúc (JPG, PNG, WEBP)
            </div>
          </div>

          {/* Grid Preview các ảnh đã chọn */}
          {selectedFiles.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 8,
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '4px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 12,
              }}
            >
              {selectedFiles.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '3/4',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#000',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: 3,
                      fontSize: '0.62rem',
                      background: 'rgba(0,0,0,0.75)',
                      color: '#fff',
                      padding: '1px 4px',
                      borderRadius: 4,
                      fontWeight: 800,
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFile(item.id)
                    }}
                    style={{
                      position: 'absolute',
                      top: 3,
                      right: 3,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'rgba(239, 68, 68, 0.85)',
                      color: '#fff',
                      border: 'none',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || selectedFiles.length === 0}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              border: 'none',
              color: '#fff',
              fontSize: '0.86rem',
              fontWeight: 800,
              cursor: isSaving || selectedFiles.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isSaving || selectedFiles.length === 0 ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="tv-spin" />
                <span>Đang lưu ({savingProgress.current}/{savingProgress.total})...</span>
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                <span>Lưu {selectedFiles.length > 0 ? `${selectedFiles.length} ảnh` : ''} vào kho</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
