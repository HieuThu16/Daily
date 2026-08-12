import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { PersonDailyPhoto } from '../../types'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'

const BUCKET = 'person-photos'

type Props = { personId: string; date: string }

/** Ảnh kèm nhật ký của một người trong một ngày — upload lên Supabase Storage. */
export function DailyLogPhotos({ personId, date }: Props) {
  const { showToast } = useToast()
  const [photos, setPhotos] = useState<PersonDailyPhoto[]>([])
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PersonDailyPhoto | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!supabase) return setPhotos([])
    let alive = true
    supabase
      .from('person_daily_photos')
      .select('*')
      .eq('person_id', personId)
      .eq('log_date', date)
      .order('created_at')
      .then(({ data }) => {
        if (alive) setPhotos((data ?? []) as PersonDailyPhoto[])
      })
    return () => {
      alive = false
    }
  }, [personId, date])

  const upload = async (files: FileList) => {
    if (!supabase) return
    setBusy(true)
    const added: PersonDailyPhoto[] = []

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${personId}/${date}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
      if (uploadError) {
        showToast('Tải ảnh lên thất bại')
        continue
      }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      const { data, error } = await supabase
        .from('person_daily_photos')
        .insert({ person_id: personId, log_date: date, url, storage_path: path })
        .select()
        .single()
      if (!error && data) added.push(data as PersonDailyPhoto)
    }

    if (added.length) {
      setPhotos((prev) => [...prev, ...added])
      showToast(`Đã thêm ${added.length} ảnh`)
    }
    setBusy(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  const remove = async (photo: PersonDailyPhoto) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    setPreview(null)
    if (!supabase) return
    await supabase.from('person_daily_photos').delete().eq('id', photo.id)
    if (photo.storage_path) await supabase.storage.from(BUCKET).remove([photo.storage_path])
  }

  return (
    <div className="log-photos">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Chọn ảnh"
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={!supabase || busy}
        title={supabase ? undefined : 'Cần cấu hình Supabase để lưu ảnh'}
      >
        <ImagePlus size={14} /> {busy ? 'Đang tải…' : 'Thêm ảnh'}
      </button>

      {!supabase && <span className="log-photos-note">Chưa cấu hình Supabase nên chưa lưu được ảnh.</span>}

      {photos.length > 0 && (
        <div className="log-photo-grid">
          {photos.map((photo) => (
            <button key={photo.id} type="button" onClick={() => setPreview(photo)} aria-label="Xem ảnh">
              <img src={photo.url} alt={`Ảnh ngày ${date}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {preview && (
        <Modal title={`Ảnh ngày ${date}`} onClose={() => setPreview(null)}>
          <img src={preview.url} alt={`Ảnh ngày ${date}`} style={{ width: '100%', borderRadius: 12 }} />
          <button className="text-danger" onClick={() => remove(preview)} style={{ marginTop: 10 }}>
            <Trash2 size={14} /> Xoá ảnh
          </button>
        </Modal>
      )}
    </div>
  )
}
