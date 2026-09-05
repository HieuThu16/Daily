import { useMemo, useState } from 'react'
import { Clipboard, Trash2 } from 'lucide-react'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { supabase } from '../../lib/supabase'
import type { KnowledgeItem } from '../../types'
import {
  DEFAULT_CATEGORY,
  lessonRows,
  normalizeCategory,
  parseLessonText,
  type LessonEntry,
} from './knowledge'
import { YoutubeVideoPicker } from './YoutubeVideoPicker'
import { KnowledgeAnswerItem } from './KnowledgeAnswerItem'

export function PasteLessonModal({
  initialCategory,
  initialVideoId,
  categories,
  onClose,
  onOpenManualEditor,
  onSaved,
}: {
  initialCategory: string
  initialVideoId?: string | null
  categories: string[]
  onClose: () => void
  onOpenManualEditor: (lesson: { category: string; sourceVideoId?: string | null; entries: LessonEntry[] }) => void
  onSaved: (newItems: KnowledgeItem[], category: string) => void
}) {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [category, setCategory] = useState(initialCategory)
  const [sourceVideoId, setSourceVideoId] = useState<string | null>(initialVideoId ?? null)
  const [stripQuestionNumbers, setStripQuestionNumbers] = useState(false)
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(
    () => parseLessonText(text, { stripQuestionNumbers }),
    [text, stripQuestionNumbers],
  )

  const handlePasteClipboard = async () => {
    try {
      const clip = await navigator.clipboard?.readText()
      if (clip && clip.trim()) {
        setText(clip)
        showToast('Đã dán nội dung từ bộ nhớ tạm!', 'success')
      } else {
        showToast('Bộ nhớ tạm trống. Vui lòng bấm Ctrl+V để dán.', 'info')
      }
    } catch {
      showToast('Không thể đọc trực tiếp clipboard. Hãy nhấn giữ ô nhập để Dán (Paste).', 'info')
    }
  }

  const handleSave = async () => {
    if (!supabase || parsed.entries.length === 0) return
    const targetCat = normalizeCategory(category || parsed.suggestedCategory || DEFAULT_CATEGORY)
    const rows = lessonRows(parsed.entries, targetCat, sourceVideoId)
    if (!rows.length) return

    setBusy(true)
    const { data, error } = await supabase.from('knowledge_items').insert(rows).select()
    setBusy(false)

    if (error) {
      showToast('❌ Chưa lưu được bài học — kiểm tra kết nối mạng.', 'delete')
      return
    }

    showToast(`Đã thêm thành công ${rows.length} thẻ bài học!`, 'success')
    onSaved((data ?? []) as KnowledgeItem[], targetCat)
    onClose()
  }

  const handleOpenEditor = () => {
    if (parsed.entries.length === 0) {
      showToast('Vui lòng dán nội dung bài học trước.', 'info')
      return
    }
    const targetCat = normalizeCategory(category || parsed.suggestedCategory || DEFAULT_CATEGORY)
    onOpenManualEditor({
      category: targetCat,
      sourceVideoId,
      entries: parsed.entries,
    })
    onClose()
  }

  return (
    <Modal title="Dán bài học (NotebookLM, AI, Ghi chú)" onClose={onClose}>
      <label>
        Tên bài học (thể loại)
        <input
          list="kn-paste-categories"
          placeholder={parsed.suggestedCategory ? `Gợi ý: "${parsed.suggestedCategory}"` : `Mặc định "${DEFAULT_CATEGORY}"`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="kn-paste-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      {parsed.suggestedCategory && !category && (
        <div style={{ marginTop: 4, marginBottom: 8, fontSize: '0.78rem' }}>
          <span className="muted">Gợi ý từ nội dung: </span>
          <button
            type="button"
            className="kn-manage-btn"
            style={{ fontSize: '0.74rem', padding: '2px 8px' }}
            onClick={() => setCategory(parsed.suggestedCategory!)}
          >
            Sử dụng &ldquo;{parsed.suggestedCategory}&rdquo;
          </button>
        </div>
      )}

      {/* Gắn video YouTube nguồn nếu có */}
      <YoutubeVideoPicker
        selectedVideoId={sourceVideoId}
        onSelectVideo={(id) => setSourceVideoId(id)}
      />

      {/* Khu vực dán văn bản */}
      <div style={{ marginTop: 12 }}>
        <div className="kn-paste-actions-top">
          <label style={{ margin: 0, fontWeight: 700, fontSize: '0.84rem' }}>
            Nội dung bài học
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="kn-manage-btn"
              onClick={handlePasteClipboard}
              title="Dán nhanh từ bộ nhớ tạm"
            >
              <Clipboard size={13} /> Dán từ Clipboard
            </button>
            {text && (
              <button
                type="button"
                className="kn-manage-btn is-danger"
                onClick={() => setText('')}
                title="Xoá nội dung"
              >
                <Trash2 size={13} /> Xoá
              </button>
            )}
          </div>
        </div>

        <textarea
          className="kn-paste-textarea"
          rows={6}
          placeholder={`Dán nội dung từ NotebookLM, ChatGPT hoặc tài liệu vào đây...

Ví dụ mẫu:
### 1. Sự kiên trì và kỷ luật từ những việc nhỏ nhất
Bomman chia sẻ rằng ngay cả khi trượt môn... [1, 2]
* Xây dựng thói quen tốt: Loi choi đi học đầy đủ... [2-4]
* Sức mạnh của cộng đồng: Mở rộng quan hệ... [5]

Hệ thống sẽ tự động bóc tách các ý và lọc sạch trích dẫn [1, 2], footnote, định dạng markdown.`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </div>

      {/* Xem trước kết quả bóc tách */}
      {parsed.entries.length > 0 && (
        <div className="kn-paste-preview">
          <div className="kn-paste-preview-header">
            <span className="kn-paste-badge">
              🎯 Đã nhận diện {parsed.entries.length} thẻ kiến thức
            </span>
            <label className="kn-paste-toggle">
              <input
                type="checkbox"
                checked={stripQuestionNumbers}
                onChange={(e) => setStripQuestionNumbers(e.target.checked)}
              />
              <span>Bỏ số thứ tự (ví dụ: &ldquo;1. Sự kiên trì&rdquo; ➔ &ldquo;Sự kiên trì&rdquo;)</span>
            </label>
          </div>

          <div className="kn-paste-cards">
            {parsed.entries.map((entry, idx) => (
              <div key={idx} className="kn-paste-card">
                <div className="kn-paste-card-q">
                  <span className="kn-paste-card-idx">#{idx + 1}</span>
                  <strong>{entry.question}</strong>
                </div>
                {entry.answers.length > 0 ? (
                  <div className="kn-paste-card-answers">
                    {entry.answers.map((ans, aidx) => (
                      <KnowledgeAnswerItem key={aidx} text={ans} />
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: '0.74rem', paddingLeft: 6 }}>
                    (Chưa có nội dung trả lời)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {text && parsed.entries.length === 0 && (
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
          ⚠️ Chưa nhận diện được câu hỏi hay ý chính nào. Hãy đảm bảo nội dung có tiêu đề dạng &ldquo;1. ...&rdquo;, &ldquo;### ...&rdquo; hoặc các gạch đầu dòng.
        </p>
      )}

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button type="button" onClick={onClose}>Huỷ</button>
        <button
          type="button"
          onClick={handleOpenEditor}
          disabled={parsed.entries.length === 0}
          title="Chuyển sang màn hình tự soạn để tuỳ chỉnh từng thẻ"
        >
          Sửa trong trình soạn
        </button>
        <button
          type="button"
          className="primary"
          onClick={handleSave}
          disabled={busy || parsed.entries.length === 0}
        >
          {busy ? 'Đang lưu…' : `Lưu ngay (${parsed.entries.length} thẻ)`}
        </button>
      </div>
    </Modal>
  )
}
