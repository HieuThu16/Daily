import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Play,
  Pause,
  Volume2,
  BookmarkPlus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Tv,
  Languages,
  BookOpen,
  Repeat,
} from 'lucide-react'
import { InteractiveSentence } from './InteractiveSentence'
import { QuickWordLookupModal } from './QuickWordLookupModal'
import { useToast } from '../ToastContext'
import { playLanguageSpeech, type LanguageDetail } from '../../lib/languageAI'

export type SubtitleCue = {
  start: number
  end: number
  text: string
  vi?: string
  pinyin?: string
}

export type CuratedLesson = {
  id: string
  title: string
  videoId: string
  lang: 'en' | 'zh'
  level: 'Cơ bản' | 'Trung cấp' | 'Nâng cao'
  category: string
  thumbnail?: string
  isOfficial?: boolean
  cues: SubtitleCue[]
}

const CURATED_LESSONS: CuratedLesson[] = [
  {
    id: 'en-coffee-order',
    title: 'Giao tiếp gọi đồ uống tại quán Cafe (Coffee Shop English)',
    videoId: '2e_xH0e1-v8',
    lang: 'en',
    level: 'Cơ bản',
    category: 'Giao tiếp đời sống',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: 'Hi there! What can I get started for you today?', vi: 'Xin chào! Hôm nay tôi có thể lấy món gì cho bạn?' },
      { start: 4.5, end: 9.0, text: 'Could I please get a medium iced caramel latte with oat milk?', vi: 'Cho tôi một ly latte caramel đá cỡ vừa với sữa yến mạch được không?' },
      { start: 9.0, end: 13.5, text: 'Sure thing! Would you like any extra syrup or whipped cream on top?', vi: 'Chắc chắn rồi! Bạn có muốn thêm si-rô hay kem tươi ở trên không?' },
      { start: 13.5, end: 18.0, text: 'No, thank you. Just the standard sweetness is perfect.', vi: 'Dạ không, cảm ơn. Độ ngọt tiêu chuẩn là hoàn hảo rồi.' },
      { start: 18.0, end: 23.0, text: 'Great! Is that for here or to go? Your total comes to four fifty.', vi: 'Tuyệt! Bạn dùng ở đây hay mang đi? Tổng cộng của bạn là 4 đô 50.' },
      { start: 23.0, end: 28.0, text: 'To go, please. Can I pay with Apple Pay or credit card?', vi: 'Mang đi giúp tôi nhé. Tôi có thể thanh toán bằng Apple Pay hoặc thẻ tín dụng không?' },
      { start: 28.0, end: 34.0, text: 'Of course! Just tap your card right here. It will be ready in a minute.', vi: 'Tất nhiên rồi! Bạn cứ chạm thẻ vào đây. Đồ uống sẽ xong ngay sau một phút.' },
    ],
  },
  {
    id: 'zh-restaurant-order',
    title: 'Giao tiếp gọi món tại nhà hàng Trung Quốc (餐厅点餐口语)',
    videoId: 'v1y87n9KzY0',
    lang: 'zh',
    level: 'Cơ bản',
    category: 'Ẩm thực & Mua sắm',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.0, text: '服务员，请问可以看一下菜单吗？', pinyin: 'Fú wù yuán, qǐng wèn kě yǐ kàn yī xià cài dān ma?', vi: 'Phục vụ ơi, tôi có thể xem qua thực đơn một chút được không?' },
      { start: 4.0, end: 8.5, text: '好的，这是我们的特色菜单，请问您几位？', pinyin: 'Hǎo de, zhè shì wǒ men de tè sè cài dān, qǐng wèn nín jǐ wèi?', vi: 'Dạ được, đây là thực đơn đặc biệt của chúng tôi, xin hỏi anh chị đi mấy người ạ?' },
      { start: 8.5, end: 13.0, text: '我们两位。请问有什么推荐的招牌菜吗？', pinyin: 'Wǒ men liǎng wèi. Qǐng wèn yǒu shén me tuī jiàn de zhāo pái cài ma?', vi: 'Chúng tôi có hai người. Cho hỏi quán có món đặc trưng nào gợi ý không?' },
      { start: 13.0, end: 18.0, text: '我们的宫保鸡丁和麻婆豆腐都很受欢迎。', pinyin: 'Wǒ men de gōng bǎo jī dīng hé má pó dòu fu dōu hěn shòu huān yíng.', vi: 'Món Gà xào Cung Bảo và Đậu phụ Ma Bà của chúng tôi rất được ưa chuộng.' },
      { start: 18.0, end: 23.5, text: '那就要一份麻婆豆腐，少放点辣椒，谢谢！', pinyin: 'Nà jiù yào yī fèn má pó dòu fu, shǎo fàng diǎn là jiāo, xiè xie!', vi: 'Vậy cho một phần Đậu phụ Ma Bà, ít cay một chút nhé, cảm ơn!' },
      { start: 23.5, end: 29.0, text: '好的，没问题！主食需要米饭还是面条？', pinyin: 'Hǎo de, méi wèn tí! Zhǔ shí xū yào mǐ fàn hái shì miàn tiáo?', vi: 'Dạ vâng không vấn đề! Món chính anh chị dùng cơm hay mì ạ?' },
    ],
  },
  {
    id: 'en-ted-habit',
    title: 'Bí quyết rèn luyện thói quen mỗi ngày (Atomic Habits & Success)',
    videoId: 'AdKUJxjn-R8',
    lang: 'en',
    level: 'Trung cấp',
    category: 'Phát triển bản thân',
    isOfficial: true,
    cues: [
      { start: 0, end: 5.0, text: 'Small habits don’t add up, they compound over time.', vi: 'Những thói quen nhỏ không chỉ cộng dồn, chúng tạo nên cấp số nhân theo thời gian.' },
      { start: 5.0, end: 10.5, text: 'If you can get 1% better each day for one year, you’ll end up 37 times better.', vi: 'Nếu bạn có thể tiến bộ 1% mỗi ngày trong một năm, bạn sẽ giỏi hơn gấp 37 lần.' },
      { start: 10.5, end: 16.0, text: 'The most effective way to change your habits is to focus on who you wish to become.', vi: 'Cách hiệu quả nhất để thay đổi thói quen là tập trung vào hình mẫu bạn muốn trở thành.' },
      { start: 16.0, end: 22.0, text: 'Your identity emerges out of your habits. Every action is a vote for the type of person you want to be.', vi: 'Bản sắc của bạn nảy sinh từ thói quen. Mỗi hành động là một lá phiếu bầu cho con người bạn muốn trở thành.' },
    ],
  },
  {
    id: 'zh-travel-taxi',
    title: 'Bắt xe taxi & hỏi đường tại Bắc Kinh (北京打车与问路)',
    videoId: '3JZ_D3ELwOQ',
    lang: 'zh',
    level: 'Cơ bản',
    category: 'Du lịch & Di chuyển',
    isOfficial: true,
    cues: [
      { start: 0, end: 4.5, text: '师傅，您好！去三里屯大概需要多长时间？', pinyin: 'Shī fu, nín hǎo! Qù Sān lǐ tún dà gài xū yào duō cháng shí jiān?', vi: 'Bác tài ơi, đi Tam Lý Đồn mất khoảng bao lâu ạ?' },
      { start: 4.5, end: 9.0, text: '现在有点堵车，大概需要二十多分钟吧。', pinyin: 'Xiàn zài yǒu diǎn dǔ chē, dà gài xū yào èr shí duō fēn zhōng ba.', vi: 'Bây giờ hơi kẹt xe một chút, mất khoảng hơn 20 phút nhé.' },
      { start: 9.0, end: 14.0, text: '好的，请打表计费，到路口请靠边停一下。', pinyin: 'Hǎo de, qǐng dǎ biǎo jì fèi, dào lù kǒu qǐng kào biān tíng yī xià.', vi: 'Dạ được, bác bật đồng hồ tính cước giúp cháu, đến ngã tư cho cháu tấp lề đỗ lại nhé.' },
      { start: 14.0, end: 19.5, text: '到了，一共三十五块钱。微信还是支付宝？', pinyin: 'Dào le, yī gòng sān shí wǔ kuài qián. Wēi xìn hái shì Zhī fù bǎo?', vi: 'Đến nơi rồi, tổng cộng 35 tệ. Cháu trả qua WeChat hay Alipay?' },
    ],
  },
]

type VideoSubtitleLearnViewProps = {
  onSaveWordToVault?: (term: string, meaning: string, details?: LanguageDetail) => void
  onSearchWordGlobal?: (word: string) => void
}

export function VideoSubtitleLearnView({
  onSaveWordToVault,
  onSearchWordGlobal,
}: VideoSubtitleLearnViewProps) {
  const { showToast } = useToast()

  // Selected Lesson
  const [selectedLesson, setSelectedLesson] = useState<CuratedLesson>(CURATED_LESSONS[0])
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('')
  const [isLoadingCues, setIsLoadingCues] = useState(false)
  const [activeLangFilter, setActiveLangFilter] = useState<'ALL' | 'en' | 'zh'>('ALL')

  // Playback & Subtitle State
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loopingIndex, setLoopingIndex] = useState<number | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)

  // Interactive Quick Lookup Modal State
  const [lookupWord, setLookupWord] = useState<{ word: string; lang: 'en' | 'zh' | 'vi' } | null>(null)

  // Cues list currently active
  const [currentCues, setCurrentCues] = useState<SubtitleCue[]>(selectedLesson.cues)
  const [isOfficialSubs, setIsOfficialSubs] = useState(selectedLesson.isOfficial ?? true)

  const activeCueIndex = useMemo(() => {
    return currentCues.findIndex((c) => currentTime >= c.start && currentTime < c.end)
  }, [currentCues, currentTime])

  const activeCueRef = useRef<HTMLDivElement | null>(null)
  const playerIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Auto-scroll to active cue
  useEffect(() => {
    if (autoScroll && activeCueRef.current) {
      activeCueRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeCueIndex, autoScroll])

  // Update cues when lesson changes
  useEffect(() => {
    setCurrentCues(selectedLesson.cues)
    setIsOfficialSubs(selectedLesson.isOfficial ?? true)
    setCurrentTime(0)
    setLoopingIndex(null)
  }, [selectedLesson])

  // Simulated playback timer for smooth time sync
  useEffect(() => {
    let timer: any
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.25 * playbackSpeed
          // If looping a specific line
          if (loopingIndex !== null && currentCues[loopingIndex]) {
            const cue = currentCues[loopingIndex]
            if (next >= cue.end) {
              return cue.start
            }
          }
          return next
        })
      }, 250)
    }
    return () => clearInterval(timer)
  }, [isPlaying, playbackSpeed, loopingIndex, currentCues])

  // Parse YouTube video ID from URL
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
    return match ? match[1] : null
  }

  // Handle Fetching Subtitles from YouTube URL
  const handleFetchYoutubeSubs = async () => {
    const vid = extractVideoId(youtubeInputUrl.trim())
    if (!vid) {
      showToast('⚠️ Vui lòng nhập link YouTube hợp lệ!', 'info')
      return
    }

    setIsLoadingCues(true)
    try {
      const res = await fetch(`/api/youtube-transcript?v=${encodeURIComponent(vid)}&sl=en&tl=vi`)
      if (!res.ok) {
        throw new Error('Không lấy được phụ đề')
      }
      const data = await res.json()
      if (Array.isArray(data.cues) && data.cues.length > 0) {
        const customLesson: CuratedLesson = {
          id: `custom-${vid}`,
          title: `Video YouTube (${vid})`,
          videoId: vid,
          lang: data.sourceLang?.startsWith('zh') ? 'zh' : 'en',
          level: 'Trung cấp',
          category: 'Video Tự Chọn',
          isOfficial: Boolean(data.isOfficial),
          cues: data.cues,
        }
        setSelectedLesson(customLesson)
        showToast('🎉 Đã nạp thành công phụ đề song ngữ!', 'success')
      } else {
        showToast('Video này không có sẵn phụ đề văn bản.', 'info')
      }
    } catch {
      showToast('Không lấy được phụ đề tự động. Bạn thử các video mẫu có sẵn nhé!', 'info')
    } finally {
      setIsLoadingCues(false)
    }
  }

  // Seek video to specific timestamp
  const handleSeek = (timeSec: number, index?: number) => {
    setCurrentTime(timeSec)
    setIsPlaying(true)
    if (index !== undefined && loopingIndex === index) {
      setLoopingIndex(null)
    }
  }

  // Toggle looping for a cue
  const handleToggleLoopCue = (index: number) => {
    if (loopingIndex === index) {
      setLoopingIndex(null)
      showToast('Đã tắt chế độ lặp câu', 'info')
    } else {
      setLoopingIndex(index)
      setCurrentTime(currentCues[index].start)
      setIsPlaying(true)
      showToast(`Đang lặp câu #${index + 1} để luyện nói`, 'success')
    }
  }

  // Filter lessons
  const filteredLessons = useMemo(() => {
    if (activeLangFilter === 'ALL') return CURATED_LESSONS
    return CURATED_LESSONS.filter((l) => l.lang === activeLangFilter)
  }, [activeLangFilter])

  return (
    <div className="video-learn-container">
      {/* 1. Header Toolbar & YouTube Link Input Bar */}
      <div className="video-learn-toolbar">
        <div className="video-learn-input-wrap">
          <Tv size={16} color="var(--purple, #a855f7)" />
          <input
            type="text"
            className="video-learn-input"
            value={youtubeInputUrl}
            onChange={(e) => setYoutubeInputUrl(e.target.value)}
            placeholder="Dán link YouTube (Anh/Trung) để lấy phụ đề song ngữ…"
          />
          <button
            type="button"
            className="video-learn-fetch-btn"
            onClick={handleFetchYoutubeSubs}
            disabled={isLoadingCues || !youtubeInputUrl.trim()}
          >
            {isLoadingCues ? <Loader2 size={13} className="tv-spin" /> : <Sparkles size={13} />}
            <span>Nạp Video</span>
          </button>
        </div>
      </div>

      {/* 2. Curated Lesson Selector Pills */}
      <div className="video-preset-section">
        <div className="video-preset-header">
          <span className="video-preset-title">
            <BookOpen size={13} color="#ec4899" />
            <span>Bài Học Video Mẫu ({filteredLessons.length})</span>
          </span>

          <div className="video-lang-filter-group">
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('ALL')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'en' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('en')}
            >
              🇺🇸 Tiếng Anh
            </button>
            <button
              type="button"
              className={`video-lang-pill ${activeLangFilter === 'zh' ? 'active' : ''}`}
              onClick={() => setActiveLangFilter('zh')}
            >
              🇨🇳 Tiếng Trung
            </button>
          </div>
        </div>

        <div className="video-preset-carousel">
          {filteredLessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              className={`video-preset-card ${selectedLesson.id === lesson.id ? 'is-active' : ''}`}
              onClick={() => setSelectedLesson(lesson)}
            >
              <div className="video-preset-meta">
                <span className="video-preset-tag">{lesson.category}</span>
                <span className="video-preset-badge">
                  {lesson.lang === 'zh' ? '🇨🇳 Trung' : '🇺🇸 Anh'}
                </span>
              </div>
              <h4 className="video-preset-name">{lesson.title}</h4>
              <div className="video-preset-footer">
                <span>{lesson.cues.length} câu phụ đề</span>
                <span className="video-preset-level">{lesson.level}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Video Player & Synchronized Subtitles Grid */}
      <div className="video-player-subtitles-layout">
        {/* Left/Top: YouTube Player */}
        <div className="video-player-frame-box">
          <div className="video-aspect-wrapper">
            <iframe
              ref={playerIframeRef}
              src={`https://www.youtube.com/embed/${selectedLesson.videoId}?enablejsapi=1&autoplay=0&rel=0`}
              title={selectedLesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="video-iframe"
            />
          </div>

          {/* Player Mini Controls */}
          <div className="video-player-mini-bar">
            <button
              type="button"
              className="video-mini-play-btn"
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
            </button>

            <button
              type="button"
              className="video-mini-speed-btn"
              onClick={() => {
                const next = playbackSpeed === 1 ? 0.75 : playbackSpeed === 0.75 ? 1.25 : 1
                setPlaybackSpeed(next)
                showToast(`Tốc độ: ${next}x`, 'info')
              }}
            >
              ⚡ {playbackSpeed}x
            </button>

            <label className="video-autoscroll-toggle">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              <span>Tự cuộn</span>
            </label>

            {loopingIndex !== null && (
              <button
                type="button"
                className="video-looping-badge"
                onClick={() => setLoopingIndex(null)}
                title="Nhấn để tắt lặp câu"
              >
                <Repeat size={12} /> Lặp câu #{loopingIndex + 1} ✕
              </button>
            )}
          </div>

          {/* Subtitle Source Quality Note */}
          <div className="video-subs-quality-note">
            {isOfficialSubs ? (
              <span className="quality-badge official">
                <CheckCircle2 size={13} /> Phụ đề chuẩn gốc từ Video
              </span>
            ) : (
              <span className="quality-badge ai">
                <Sparkles size={13} /> Phụ đề song ngữ tự động qua AI
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              💡 Nhấn vào từng từ trong phụ đề để tra nghĩa nhanh
            </span>
          </div>
        </div>

        {/* Right/Bottom: Synchronized Interactive Subtitles Transcript */}
        <div className="video-transcript-box">
          <div className="video-transcript-header">
            <span className="video-transcript-title">
              <Languages size={14} color="var(--purple, #a855f7)" />
              <span>Phụ Đề Song Ngữ Khớp Lời ({currentCues.length})</span>
            </span>
            <span className="video-transcript-hint">Bấm câu để nhảy tới đoạn nói</span>
          </div>

          <div className="video-transcript-list">
            {currentCues.map((cue, index) => {
              const isActive = index === activeCueIndex
              const isLooping = index === loopingIndex
              const min = Math.floor(cue.start / 60)
              const sec = Math.floor(cue.start % 60)
              const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`

              return (
                <div
                  key={index}
                  ref={isActive ? activeCueRef : null}
                  className={`transcript-cue-item ${isActive ? 'is-active' : ''} ${isLooping ? 'is-looping' : ''}`}
                  onClick={() => handleSeek(cue.start, index)}
                >
                  <div className="transcript-cue-head">
                    <span className="transcript-time-badge">{timeStr}</span>
                    <div className="transcript-cue-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`cue-action-btn ${isLooping ? 'active' : ''}`}
                        onClick={() => handleToggleLoopCue(index)}
                        title="Lặp lại câu này để luyện nói"
                      >
                        <Repeat size={12} />
                      </button>

                      <button
                        type="button"
                        className="cue-action-btn"
                        onClick={() => playLanguageSpeech(cue.text, selectedLesson.lang)}
                        title="Nghe phát âm chuẩn"
                      >
                        <Volume2 size={12} />
                      </button>

                      {onSaveWordToVault && (
                        <button
                          type="button"
                          className="cue-action-btn"
                          onClick={() => {
                            onSaveWordToVault(cue.vi || cue.text, cue.text)
                            showToast('Đã lưu câu vào Sổ tay!', 'success')
                          }}
                          title="Lưu câu này vào Sổ tay"
                        >
                          <BookmarkPlus size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Original Text with Interactive Clickable Words */}
                  <div className="transcript-orig-text">
                    <InteractiveSentence
                      text={cue.text}
                      lang={selectedLesson.lang}
                      onWordClick={(w, l) => setLookupWord({ word: w, lang: l })}
                    />
                  </div>

                  {/* Pinyin (for Chinese) */}
                  {cue.pinyin && <div className="transcript-pinyin-text">{cue.pinyin}</div>}

                  {/* Vietnamese Meaning */}
                  {cue.vi && <div className="transcript-vi-text">{cue.vi}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quick Word Lookup Modal Popup */}
      {lookupWord && (
        <QuickWordLookupModal
          word={lookupWord.word}
          lang={lookupWord.lang}
          onClose={() => setLookupWord(null)}
          onFullSearch={onSearchWordGlobal}
          onSaveToVault={onSaveWordToVault}
        />
      )}
    </div>
  )
}
