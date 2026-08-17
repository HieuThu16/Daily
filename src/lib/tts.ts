/** Đọc tiếng Anh bằng giọng máy có sẵn của trình duyệt / hệ điều hành. */

/** Ưu tiên giọng neural / online (mượt hơn nhiều so với giọng mặc định). */
const PREFERRED = ['google', 'natural', 'neural', 'aria', 'jenny', 'samantha', 'zira']

/** Chọn giọng Anh nghe tự nhiên nhất trong danh sách trình duyệt đưa ra. */
export function pickEnglishVoice<T extends { name: string; lang: string; localService?: boolean }>(
  voices: T[],
): T | null {
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  if (en.length === 0) return null
  const score = (v: T) => {
    const name = v.name.toLowerCase()
    const rank = PREFERRED.findIndex((p) => name.includes(p))
    return (rank === -1 ? PREFERRED.length : rank) + (v.localService === false ? -0.5 : 0)
  }
  return [...en].sort((a, b) => score(a) - score(b))[0]
}

let cached: SpeechSynthesisVoice | null = null

/** Đọc to một từ / câu tiếng Anh. Không làm gì nếu trình duyệt không hỗ trợ. */
// ponytail: dùng SpeechSynthesis của trình duyệt (miễn phí, offline). Đổi sang API TTS
// (ElevenLabs / OpenAI) trong hàm này nếu cần giọng thật mượt hơn.
export function speakEnglish(text: string, rate = 0.92) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  if (!synth || !text.trim()) return
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  cached = cached ?? pickEnglishVoice(synth.getVoices())
  if (cached) utter.voice = cached
  utter.lang = cached?.lang ?? 'en-US'
  utter.rate = rate
  synth.speak(utter)
}
