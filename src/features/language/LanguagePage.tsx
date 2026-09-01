import { useEffect, useMemo, useState } from 'react'
import {
  Languages,
  Search,
  Sparkles,
  Volume2,
  BookmarkPlus,
  Trash2,
  CheckCircle2,
  Circle,
  Shuffle,
  BookOpen,
  Copy,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ToastContext'
import {
  translateAndGenerateBilingual,
  playLanguageSpeech,
  type LanguageDetail,
} from '../../lib/languageAI'
import './language.css'

export type SavedLanguageCard = {
  id: string
  term: string // Tiếng Việt
  meaning: string // Tiếng Anh
  details?: LanguageDetail
  tags: string[]
  is_learned?: boolean
  created_at?: string
}

const QUICK_PROMPTS = [
  'Xin chào',
  'Cảm ơn bạn rất nhiều',
  'Tôi muốn đặt một phòng khách sạn',
  'Gửi báo giá dự án cho tôi',
  'Hẹn gặp lại bạn vào cuối tuần',
  'Món ăn này rất ngon',
  'Bạn có thể giúp tôi một việc được không',
  'Chúc bạn một ngày làm việc tốt lành',
]

const DEFAULT_TAG_OPTIONS = ['Giao tiếp', 'Công việc', 'Du lịch', 'Mua sắm', 'Ăn uống', 'Kinh doanh', 'Bạn bè']

const LOCAL_STORAGE_KEY = 'daily_language_cards_v1'

export function LanguagePage() {
  const { showToast } = useToast()

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'TRANSLATE' | 'VAULT' | 'PRACTICE'>('TRANSLATE')

  // Search & Generator State
  const [inputText, setInputText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [currentResult, setCurrentResult] = useState<LanguageDetail | null>(null)
  const [selectedTagsForSave, setSelectedTagsForSave] = useState<string[]>(['Giao tiếp'])
  const [customTagInput, setCustomTagInput] = useState('')

  // Vault State
  const [savedCards, setSavedCards] = useState<SavedLanguageCard[]>([])
  const [vaultSearch, setVaultSearch] = useState('')
  const [vaultTagFilter, setVaultTagFilter] = useState('ALL')
  const [vaultLearnedFilter, setVaultLearnedFilter] = useState<'ALL' | 'UNLEARNED' | 'LEARNED'>('ALL')
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  // Practice State
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [isPracticeFlipped, setIsPracticeFlipped] = useState(false)

  // 1. Nạp danh sách thẻ đã lưu từ Supabase & LocalStorage
  const loadSavedCards = async () => {
    let list: SavedLanguageCard[] = []
    const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (localRaw) {
      try {
        list = JSON.parse(localRaw)
      } catch {}
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('english_items')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (!error && data) {
          const remoteList: SavedLanguageCard[] = data.map((row: any) => {
            let details: LanguageDetail | undefined
            if (row.example) {
              try {
                details = JSON.parse(row.example)
              } catch {}
            }
            return {
              id: row.id,
              term: row.term || '',
              meaning: row.meaning || '',
              details,
              tags: Array.isArray(row.tags) ? row.tags : [],
              is_learned: row.is_learned ?? false,
              created_at: row.created_at,
            }
          })

          const map = new Map<string, SavedLanguageCard>()
          list.forEach((c) => map.set(c.id, c))
          remoteList.forEach((c) => map.set(c.id, c))
          list = Array.from(map.values())
        }
      } catch (err) {
        console.warn('Lỗi nạp Supabase english_items:', err)
      }
    }

    setSavedCards(list)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
  }

  useEffect(() => {
    void loadSavedCards()
  }, [])

  // 2. Xử lý Dịch & Tạo Câu Mẫu Ngữ Cảnh Đa Ngữ
  const handleTranslate = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? inputText).trim()
    if (!q) {
      showToast('Vui lòng nhập từ hoặc câu tiếng Việt cần tra cứu', 'info')
      return
    }

    setIsTranslating(true)
    try {
      const result = await translateAndGenerateBilingual(q)
      setCurrentResult(result)
      if (overrideQuery) setInputText(overrideQuery)
      showToast('✨ Đã dịch và tạo câu mẫu ngữ cảnh thành công!')
    } catch (err: any) {
      showToast(`❌ Lỗi dịch thuật: ${err?.message || err}`, 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  // 3. Lưu kết quả hiện tại vào Sổ tay
  const handleSaveToVault = async () => {
    if (!currentResult) return

    const newId = `lang-${Date.now()}`
    const finalTags = [...selectedTagsForSave]
    if (customTagInput.trim() && !finalTags.includes(customTagInput.trim())) {
      finalTags.push(customTagInput.trim())
    }

    const card: SavedLanguageCard = {
      id: newId,
      term: currentResult.vietnamese,
      meaning: currentResult.english.text,
      details: currentResult,
      tags: finalTags,
      is_learned: false,
      created_at: new Date().toISOString(),
    }

    const updated = [card, ...savedCards.filter((c) => c.term !== card.term)]
    setSavedCards(updated)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))

    if (supabase) {
      try {
        await supabase.from('english_items').insert({
          term: card.term,
          meaning: card.meaning,
          example: JSON.stringify(card.details),
          tags: card.tags,
          is_learned: false,
        })
      } catch (err) {
        console.warn('Lỗi lưu Supabase:', err)
      }
    }

    showToast('💾 Đã lưu từ/câu mẫu vào Sổ tay ngôn ngữ thành công!')
    setCustomTagInput('')
  }

  // 4. Xóa thẻ khỏi sổ tay
  const handleDeleteCard = async (cardId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa thẻ ngôn ngữ này khỏi sổ tay?')) return
    const updated = savedCards.filter((c) => c.id !== cardId)
    setSavedCards(updated)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))

    if (supabase) {
      try {
        await supabase.from('english_items').delete().eq('id', cardId)
      } catch {}
    }
    showToast('🗑️ Đã xóa thẻ ngôn ngữ.')
  }

  // 5. Đánh dấu đã thuộc / cần ôn
  const handleToggleLearned = async (cardId: string) => {
    const updated = savedCards.map((c) => (c.id === cardId ? { ...c, is_learned: !c.is_learned } : c))
    setSavedCards(updated)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))

    const target = updated.find((c) => c.id === cardId)
    if (supabase && target) {
      try {
        await supabase.from('english_items').update({ is_learned: target.is_learned }).eq('id', cardId)
      } catch {}
    }
  }

  // Copy to clipboard helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast(`Đã sao chép: "${text}"`, 'info')
  }

  // Danh sách tags duy nhất
  const allVaultTags = useMemo(() => {
    const set = new Set<string>()
    savedCards.forEach((c) => c.tags.forEach((t) => set.add(t)))
    return Array.from(set)
  }, [savedCards])

  // Lọc thẻ trong sổ tay
  const filteredCards = useMemo(() => {
    return savedCards.filter((c) => {
      if (vaultLearnedFilter === 'LEARNED' && !c.is_learned) return false
      if (vaultLearnedFilter === 'UNLEARNED' && c.is_learned) return false
      if (vaultTagFilter !== 'ALL' && !c.tags.includes(vaultTagFilter)) return false
      if (vaultSearch.trim()) {
        const q = vaultSearch.trim().toLowerCase()
        const matchVi = c.term.toLowerCase().includes(q)
        const matchEn = c.meaning.toLowerCase().includes(q)
        const matchZh = c.details?.chinese?.text?.toLowerCase().includes(q) || false
        const matchPy = c.details?.chinese?.pinyin?.toLowerCase().includes(q) || false
        if (!matchVi && !matchEn && !matchZh && !matchPy) return false
      }
      return true
    })
  }, [savedCards, vaultLearnedFilter, vaultTagFilter, vaultSearch])

  // Thống kê
  const learnedCount = useMemo(() => savedCards.filter((c) => c.is_learned).length, [savedCards])
  const unlearnedCount = savedCards.length - learnedCount

  const currentPracticeCard = filteredCards[practiceIndex] || filteredCards[0]

  return (
    <div className="lang-page-container">
      {/* 1. Header Banner */}
      <div className="lang-hero-card">
        <div className="lang-hero-header">
          <div className="lang-hero-title-group">
            <div className="lang-hero-icon-wrap">
              <Languages size={24} />
            </div>
            <div>
              <h1 className="lang-hero-title">Trợ Lý Đa Ngôn Ngữ (Anh - Trung)</h1>
              <p className="lang-hero-subtitle">
                Gõ tiếng Việt (từ hoặc câu) → Tự động tạo bản dịch Tiếng Anh & Tiếng Trung (Pinyin) kèm câu mẫu theo nhiều tình huống đời thực.
              </p>
            </div>
          </div>

          <div className="lang-hero-stats">
            <div className="lang-stat-badge">
              <BookOpen size={14} color="#8b5cf6" />
              <span>{savedCards.length} thẻ lưu</span>
            </div>
            <div className="lang-stat-badge">
              <CheckCircle2 size={14} color="#10b981" />
              <span>{learnedCount} đã thuộc</span>
            </div>
            {unlearnedCount > 0 && (
              <div className="lang-stat-badge">
                <Circle size={14} color="#f59e0b" />
                <span>{unlearnedCount} cần ôn</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="lang-nav-tabs">
        <button
          type="button"
          className={`lang-nav-tab-btn ${activeTab === 'TRANSLATE' ? 'active' : ''}`}
          onClick={() => setActiveTab('TRANSLATE')}
        >
          <Sparkles size={16} /> <span>Tra cứu & Tạo câu mẫu</span>
        </button>
        <button
          type="button"
          className={`lang-nav-tab-btn ${activeTab === 'VAULT' ? 'active' : ''}`}
          onClick={() => setActiveTab('VAULT')}
        >
          <BookOpen size={16} /> <span>Sổ tay đã lưu ({savedCards.length})</span>
        </button>
        <button
          type="button"
          className={`lang-nav-tab-btn ${activeTab === 'PRACTICE' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('PRACTICE')
            setIsPracticeFlipped(false)
            setPracticeIndex(0)
          }}
          disabled={savedCards.length === 0}
        >
          <Shuffle size={16} /> <span>Luyện Flashcards</span>
        </button>
      </div>

      {/* 3. TAB 1: TRA CỨU & TẠO CÂU MẪU (TRANSLATE & GENERATE) */}
      {activeTab === 'TRANSLATE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="lang-search-card">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleTranslate()
              }}
              className="lang-input-row"
            >
              <div className="lang-input-wrap">
                <Search size={20} className="lang-input-icon" />
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Gõ từ hoặc câu tiếng Việt (vd: xin chào, đặt phòng khách sạn, báo giá, hẹn gặp lại...)"
                  className="lang-main-input"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={isTranslating || !inputText.trim()} className="lang-submit-btn">
                {isTranslating ? (
                  <>
                    <Sparkles size={16} className="tv-spin" /> <span>Đang dịch...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> <span>Dịch & Tạo câu mẫu</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Suggestion Pills */}
            <div className="lang-quick-pills">
              <span className="lang-quick-label">Gợi ý thử nhanh:</span>
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void handleTranslate(p)}
                  className="lang-pill-btn"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Results Area */}
          {currentResult && (
            <div className="lang-result-container">
              {/* Bilingual Comparison Cards */}
              <div className="lang-bilingual-grid">
                {/* 1. Tiếng Anh */}
                <div className="lang-lang-card">
                  <div className="lang-card-header">
                    <span className="lang-card-tag en">🇺🇸 Tiếng Anh (English)</span>
                    <button
                      type="button"
                      className="lang-audio-btn"
                      onClick={() => playLanguageSpeech(currentResult.english.text, 'en')}
                      title="Phát âm tiếng Anh"
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                  <div>
                    <h3 className="lang-main-term">{currentResult.english.text}</h3>
                    {currentResult.english.phonetic && (
                      <div className="lang-phonetic-badge">{currentResult.english.phonetic}</div>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {currentResult.english.explanation}
                  </p>
                </div>

                {/* 2. Tiếng Trung */}
                <div className="lang-lang-card">
                  <div className="lang-card-header">
                    <span className="lang-card-tag zh">🇨🇳 Tiếng Trung (中文)</span>
                    <button
                      type="button"
                      className="lang-audio-btn"
                      onClick={() => playLanguageSpeech(currentResult.chinese.text, 'zh')}
                      title="Phát âm tiếng Trung"
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                  <div>
                    <h3 className="lang-main-term" style={{ fontSize: '1.8rem', color: '#f472b6' }}>
                      {currentResult.chinese.text}
                    </h3>
                    <div className="lang-pinyin-badge">Pinyin: {currentResult.chinese.pinyin}</div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {currentResult.chinese.explanation}
                  </p>
                </div>
              </div>

              {/* Situational Context Examples Section */}
              <div className="lang-examples-section">
                <h3 className="lang-examples-title">
                  <Lightbulb size={20} color="#f59e0b" />
                  <span>Các Câu Mẫu Theo Tình Huống Đời Thực ({currentResult.examples.length} trường hợp)</span>
                </h3>

                <div className="lang-examples-grid">
                  {currentResult.examples.map((ex, idx) => (
                    <div key={idx} className="lang-example-card">
                      <span className="lang-example-context">📌 {ex.context}</span>
                      
                      <div className="lang-example-vi">
                        <strong>Tiếng Việt:</strong> {ex.vietnamese}
                      </div>

                      <div className="lang-example-row">
                        <div>
                          <div className="lang-example-en">{ex.english}</div>
                        </div>
                        <button
                          type="button"
                          className="lang-audio-btn"
                          style={{ width: 28, height: 28 }}
                          onClick={() => playLanguageSpeech(ex.english, 'en')}
                          title="Phát âm câu tiếng Anh"
                        >
                          <Volume2 size={14} />
                        </button>
                      </div>

                      <div className="lang-example-row">
                        <div>
                          <div className="lang-example-zh">{ex.chinese}</div>
                          <div className="lang-example-py">{ex.chinesePinyin}</div>
                        </div>
                        <button
                          type="button"
                          className="lang-audio-btn"
                          style={{ width: 28, height: 28 }}
                          onClick={() => playLanguageSpeech(ex.chinese, 'zh')}
                          title="Phát âm câu tiếng Trung"
                        >
                          <Volume2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save to Vault Action Bar */}
                <div className="lang-save-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Chọn thẻ phân loại:</span>
                    {DEFAULT_TAG_OPTIONS.map((t) => {
                      const isSelected = selectedTagsForSave.includes(t)
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`lang-pill-btn ${isSelected ? 'active' : ''}`}
                          style={{
                            background: isSelected ? 'rgba(139, 92, 246, 0.3)' : undefined,
                            borderColor: isSelected ? '#8b5cf6' : undefined,
                          }}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTagsForSave((prev) => prev.filter((x) => x !== t))
                            } else {
                              setSelectedTagsForSave((prev) => [...prev, t])
                            }
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{t}
                        </button>
                      )
                    })}
                  </div>

                  <button type="button" onClick={handleSaveToVault} className="lang-save-btn">
                    <BookmarkPlus size={18} /> <span>Lưu vào Sổ tay ngôn ngữ</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: SỔ TAY ĐÃ LƯU (SAVED VAULT) */}
      {activeTab === 'VAULT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Toolbar & Filters */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="lang-input-wrap" style={{ maxWidth: 360 }}>
              <Search size={16} className="lang-input-icon" />
              <input
                type="text"
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                placeholder="Tìm từ, nghĩa tiếng Anh, tiếng Trung..."
                className="lang-main-input"
                style={{ padding: '10px 14px 10px 38px', fontSize: '0.88rem' }}
              />
            </div>

            {/* Tag filter */}
            {allVaultTags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`lang-pill-btn ${vaultTagFilter === 'ALL' ? 'active' : ''}`}
                  style={{ background: vaultTagFilter === 'ALL' ? '#8b5cf6' : undefined }}
                  onClick={() => setVaultTagFilter('ALL')}
                >
                  Tất cả ({savedCards.length})
                </button>
                {allVaultTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`lang-pill-btn ${vaultTagFilter === t ? 'active' : ''}`}
                    style={{ background: vaultTagFilter === t ? '#8b5cf6' : undefined }}
                    onClick={() => setVaultTagFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Learned filter */}
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button
                type="button"
                className={`lang-pill-btn ${vaultLearnedFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setVaultLearnedFilter('ALL')}
              >
                Mọi trạng thái
              </button>
              <button
                type="button"
                className={`lang-pill-btn ${vaultLearnedFilter === 'UNLEARNED' ? 'active' : ''}`}
                onClick={() => setVaultLearnedFilter('UNLEARNED')}
              >
                ⏳ Cần ôn
              </button>
              <button
                type="button"
                className={`lang-pill-btn ${vaultLearnedFilter === 'LEARNED' ? 'active' : ''}`}
                onClick={() => setVaultLearnedFilter('LEARNED')}
              >
                ✅ Đã thuộc
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredCards.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: 'var(--bg-card)',
                borderRadius: 20,
                border: '1px solid var(--card-border)',
              }}
            >
              <Languages size={44} color="#8b5cf6" style={{ margin: '0 auto 12px' }} />
              <h3>Chưa có thẻ nào trong Sổ tay</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Hãy qua tab "Tra cứu & Tạo câu mẫu" để gõ tiếng Việt và thêm các thẻ ngôn ngữ mới vào đây.
              </p>
              <button type="button" onClick={() => setActiveTab('TRANSLATE')} className="lang-submit-btn" style={{ margin: '14px auto 0' }}>
                <Sparkles size={16} /> Tra cứu ngay
              </button>
            </div>
          ) : (
            <div className="lang-vault-grid">
              {filteredCards.map((card) => {
                const isExpanded = expandedCards[card.id] || false
                return (
                  <div key={card.id} className={`lang-vault-card ${card.is_learned ? 'learned' : ''}`}>
                    <div className="lang-vault-top">
                      <div>
                        <h4 className="lang-vault-vi">{card.term}</h4>
                        {card.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            {card.tags.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  background: 'rgba(139, 92, 246, 0.15)',
                                  color: '#c4b5fd',
                                }}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleLearned(card.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        title={card.is_learned ? 'Đã thuộc (Nhấn để chuyển sang Cần ôn)' : 'Cần ôn (Nhấn để đánh dấu Đã thuộc)'}
                      >
                        {card.is_learned ? (
                          <CheckCircle2 size={20} color="#10b981" />
                        ) : (
                          <Circle size={20} color="var(--text-muted)" />
                        )}
                      </button>
                    </div>

                    {/* Bilingual Box */}
                    <div className="lang-vault-bilingual">
                      {/* Tiếng Anh */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800 }}>🇺🇸 ENGLISH</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                            {card.details?.english?.text || card.meaning}
                          </div>
                          {card.details?.english?.phonetic && (
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                              {card.details.english.phonetic}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="lang-audio-btn"
                          style={{ width: 30, height: 30 }}
                          onClick={() => playLanguageSpeech(card.details?.english?.text || card.meaning, 'en')}
                          title="Nghe phát âm tiếng Anh"
                        >
                          <Volume2 size={15} />
                        </button>
                      </div>

                      {/* Tiếng Trung */}
                      {card.details?.chinese?.text && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            paddingTop: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.72rem', color: '#f472b6', fontWeight: 800 }}>🇨🇳 中文 (CHINESE)</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f472b6' }}>
                              {card.details.chinese.text}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#f9a8d4' }}>
                              {card.details.chinese.pinyin}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="lang-audio-btn"
                            style={{ width: 30, height: 30 }}
                            onClick={() => playLanguageSpeech(card.details!.chinese.text, 'zh')}
                            title="Nghe phát âm tiếng Trung"
                          >
                            <Volume2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expandable Situational Examples */}
                    {card.details?.examples && card.details.examples.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCards((prev) => ({ ...prev, [card.id]: !isExpanded }))
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#8b5cf6',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: 0,
                          }}
                        >
                          <span>{isExpanded ? 'Thu gọn câu mẫu' : `Xem ${card.details.examples.length} câu mẫu ngữ cảnh`}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            {card.details.examples.map((ex, i) => (
                              <div
                                key={i}
                                style={{
                                  background: 'rgba(0, 0, 0, 0.25)',
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  fontSize: '0.8rem',
                                }}
                              >
                                <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 800 }}>
                                  {ex.context}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '2px 0' }}>
                                  {ex.vietnamese}
                                </div>
                                <div style={{ color: '#38bdf8', fontWeight: 600 }}>{ex.english}</div>
                                <div style={{ color: '#f472b6', fontWeight: 600 }}>{ex.chinese}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="lang-vault-actions">
                      <button
                        type="button"
                        onClick={() => handleCopy(card.meaning)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                      >
                        <Copy size={13} /> <span>Sao chép</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteCard(card.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} /> <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: LUYỆN TẬP FLASHCARDS (PRACTICE) */}
      {activeTab === 'PRACTICE' && currentPracticeCard && (
        <div className="lang-flashcard-wrap">
          <div
            className="lang-flashcard-box"
            onClick={() => setIsPracticeFlipped((prev) => !prev)}
          >
            {!isPracticeFlipped ? (
              /* Mặt trước: Tiếng Việt */
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                  MẶT TRƯỚC (TIẾNG VIỆT)
                </span>
                <h2 style={{ fontSize: '2rem', margin: '16px 0', fontWeight: 800 }}>
                  {currentPracticeCard.term}
                </h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Thẻ số {practiceIndex + 1} / {filteredCards.length}
                </div>
                <div className="lang-flashcard-hint">💡 Nhấn vào thẻ để lật xem bản dịch Tiếng Anh & Tiếng Trung</div>
              </div>
            ) : (
              /* Mặt sau: Tiếng Anh + Tiếng Trung */
              <div style={{ width: '100%' }}>
                <span style={{ fontSize: '0.8rem', color: '#10b981', textTransform: 'uppercase', fontWeight: 800 }}>
                  MẶT SAU (ANH & TRUNG)
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '20px 0', textAlign: 'left' }}>
                  {/* Anh */}
                  <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: 14, borderRadius: 16, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800 }}>🇺🇸 TIẾNG ANH</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
                      {currentPracticeCard.details?.english?.text || currentPracticeCard.meaning}
                    </div>
                    {currentPracticeCard.details?.english?.phonetic && (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {currentPracticeCard.details.english.phonetic}
                      </div>
                    )}
                    <button
                      type="button"
                      className="lang-audio-btn"
                      style={{ width: 32, height: 32, marginTop: 8 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        playLanguageSpeech(currentPracticeCard.details?.english?.text || currentPracticeCard.meaning, 'en')
                      }}
                    >
                      <Volume2 size={15} />
                    </button>
                  </div>

                  {/* Trung */}
                  {currentPracticeCard.details?.chinese?.text && (
                    <div style={{ background: 'rgba(244, 114, 182, 0.1)', padding: 14, borderRadius: 16, border: '1px solid rgba(244, 114, 182, 0.3)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#f472b6', fontWeight: 800 }}>🇨🇳 TIẾNG TRUNG</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f472b6', margin: '4px 0' }}>
                        {currentPracticeCard.details.chinese.text}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#f9a8d4', fontWeight: 600 }}>
                        {currentPracticeCard.details.chinese.pinyin}
                      </div>
                      <button
                        type="button"
                        className="lang-audio-btn"
                        style={{ width: 32, height: 32, marginTop: 8 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          playLanguageSpeech(currentPracticeCard.details!.chinese.text, 'zh')
                        }}
                      >
                        <Volume2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="lang-flashcard-hint">💡 Nhấn để lật lại mặt trước</div>
              </div>
            )}
          </div>

          {/* Practice Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="lang-pill-btn"
              onClick={() => {
                setIsPracticeFlipped(false)
                setPracticeIndex((prev) => (prev > 0 ? prev - 1 : filteredCards.length - 1))
              }}
            >
              ← Thẻ trước
            </button>

            <button
              type="button"
              className="lang-submit-btn"
              style={{ padding: '10px 20px', background: currentPracticeCard.is_learned ? '#10b981' : undefined }}
              onClick={() => void handleToggleLearned(currentPracticeCard.id)}
            >
              {currentPracticeCard.is_learned ? '✓ Đã thuộc' : 'Đánh dấu đã thuộc'}
            </button>

            <button
              type="button"
              className="lang-pill-btn"
              onClick={() => {
                setIsPracticeFlipped(false)
                setPracticeIndex((prev) => (prev < filteredCards.length - 1 ? prev + 1 : 0))
              }}
            >
              Thẻ tiếp theo →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
