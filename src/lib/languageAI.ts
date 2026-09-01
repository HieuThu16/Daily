import { apiFetch } from './apiFetch'

export type LanguageExample = {
  context: string
  english: string
  chinese: string
  chinesePinyin: string
  vietnamese: string
}

export type LanguageDetail = {
  vietnamese: string
  english: {
    text: string
    phonetic?: string
    partOfSpeech?: string
    explanation?: string
  }
  chinese: {
    text: string
    pinyin: string
    traditional?: string
    partOfSpeech?: string
    explanation?: string
  }
  examples: LanguageExample[]
  notes?: string
}

/** Tải dữ liệu phát âm và dịch tự do qua Google Translate GTX Endpoint */
async function fetchGtxTranslate(text: string, sourceLang: string, targetLang: string): Promise<{ translated: string; pinyin?: string }> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=rm&q=${encodeURIComponent(text)}`
    let res = await fetch(url)
    if (!res.ok) {
      // Fallback qua proxy nếu bị CORS
      const proxyUrl = `/api/link-preview?url=${encodeURIComponent(url)}&raw=1`
      res = await apiFetch(proxyUrl)
    }

    if (res.ok) {
      const data = await res.json()
      let translated = ''
      let pinyin = ''

      if (Array.isArray(data) && Array.isArray(data[0])) {
        translated = data[0].map((item: any) => item[0] || '').join('')
        // Pinyin nằm ở phần tử cuối cùng của data[0] nếu có
        for (const item of data[0]) {
          if (Array.isArray(item) && item.length > 3 && item[3]) {
            pinyin = item[3]
          }
        }
      }
      return { translated: translated.trim(), pinyin: pinyin.trim() }
    }
  } catch (err) {
    console.warn('[languageAI] Lỗi fetch GTX Translate:', err)
  }
  return { translated: '' }
}

/** Tra cứu phiên âm IPA tiếng Anh */
async function fetchEnglishPhonetic(word: string): Promise<{ phonetic?: string; partOfSpeech?: string }> {
  const cleanWord = word.trim().toLowerCase().split(' ')[0]
  if (!cleanWord || cleanWord.length < 2) return {}
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0]
        const phonetic = item.phonetic || item.phonetics?.find((p: any) => p.text)?.text || ''
        const partOfSpeech = item.meanings?.[0]?.partOfSpeech || ''
        return { phonetic, partOfSpeech }
      }
    }
  } catch {}
  return {}
}

/**
 * Tạo danh sách các tình huống phong phú cho câu mẫu
 */
function buildSituationalPrompts(input: string, _englishTerm?: string): { context: string; viSentence: string }[] {
  const q = input.trim()
  const lower = q.toLowerCase()

  // Phân tích từ khoá để chọn ngữ cảnh thông minh
  if (lower.includes('chào') || lower.includes('hẹn gặp') || lower.includes('tạm biệt')) {
    return [
      { context: 'Giao tiếp hàng ngày (Daily)', viSentence: `${q}, hôm nay bạn thế nào?` },
      { context: 'Công việc & Đối tác (Work & Business)', viSentence: `${q}, rất vui được gặp và hợp tác với quý công ty.` },
      { context: 'Thân mật bạn bè (Casual Friends)', viSentence: `${q} nha! Cuối tuần này rảnh không đi cà phê?` },
      { context: 'Lần đầu gặp mặt (First Meeting)', viSentence: `${q}, tôi rất hân hạnh được làm quen với bạn.` },
    ]
  }

  if (lower.includes('cảm ơn') || lower.includes('biết ơn')) {
    return [
      { context: 'Đời sống thường nhật (Daily)', viSentence: `Cảm ơn bạn rất nhiều vì đã giúp đỡ tôi hôm nay.` },
      { context: 'Công việc & Khách hàng (Business)', viSentence: `Chúng tôi chân thành cảm ơn sự tin tưởng và hỗ trợ của quý đối tác.` },
      { context: 'Nhận quà / Lời khen (Social)', viSentence: `Cảm ơn bạn, món quà này thật sự rất ý nghĩa với tôi!` },
    ]
  }

  if (lower.includes('ăn') || lower.includes('uống') || lower.includes('quán') || lower.includes('món')) {
    return [
      { context: 'Gọi món tại nhà hàng (Dining Out)', viSentence: `Cho tôi xem thực đơn và gọi món này được không?` },
      { context: 'Hỏi sở thích ăn uống (Casual Chat)', viSentence: `Bạn có muốn cùng tôi đi ăn món này vào tối nay không?` },
      { context: 'Thanh toán & Đánh giá (Payment)', viSentence: `Món ăn này rất ngon, vui lòng cho tôi xin hoá đơn tính tiền.` },
    ]
  }

  if (lower.includes('phòng') || lower.includes('khách sạn') || lower.includes('vé') || lower.includes('du lịch') || lower.includes('sân bay')) {
    return [
      { context: 'Đặt phòng & Đặt chỗ (Booking)', viSentence: `Tôi muốn đặt phòng cho hai người vào cuối tuần này.` },
      { context: 'Hỏi đường & Di chuyển (Travel Navigation)', viSentence: `Làm ơn cho tôi hỏi đường đi đến địa điểm này nhanh nhất?` },
      { context: 'Thủ tục nhận phòng (Check-in)', viSentence: `Tôi đã đặt phòng trước, đây là thông tin xác nhận của tôi.` },
    ]
  }

  // Mặc định: Tạo 4 tình huống tiêu chuẩn đa dạng
  return [
    { context: 'Giao tiếp đời sống (Daily Conversation)', viSentence: `Trong cuộc sống hàng ngày, chúng ta thường cần ${q}.` },
    { context: 'Công việc & Chuyên môn (Work & Professional)', viSentence: `Chúng ta cần tập trung vào ${q} để nâng cao hiệu quả công việc.` },
    { context: 'Bày tỏ quan điểm (Expressing Opinion)', viSentence: `Theo tôi thấy, ${q} là một yếu tố vô cùng quan trọng.` },
    { context: 'Câu hỏi / Thảo luận (Discussion)', viSentence: `Bạn nghĩ như thế nào về ${q} trong tình huống hiện tại?` },
  ]
}

/**
 * Chức năng dịch và tạo câu mẫu ngữ cảnh Đa Ngữ (Tiếng Việt -> Tiếng Anh + Tiếng Trung)
 */
export async function translateAndGenerateBilingual(vietnameseInput: string): Promise<LanguageDetail> {
  const input = vietnameseInput.trim()
  if (!input) {
    throw new Error('Vui lòng nhập từ hoặc câu tiếng Việt cần tra cứu.')
  }

  // 1. Dịch thuật ngữ chính sang Tiếng Anh
  const enRes = await fetchGtxTranslate(input, 'vi', 'en')
  const englishText = enRes.translated || input

  // 2. Dịch thuật ngữ chính sang Tiếng Trung & lấy Pinyin
  const zhRes = await fetchGtxTranslate(input, 'vi', 'zh-CN')
  let chineseText = zhRes.translated || input
  let chinesePinyin = zhRes.pinyin || ''

  // Nếu chưa có Pinyin thì lấy riêng
  if (!chinesePinyin && chineseText) {
    const pyRes = await fetchGtxTranslate(chineseText, 'zh-CN', 'en')
    chinesePinyin = pyRes.pinyin || ''
  }

  // 3. Tra cứu phiên âm IPA tiếng Anh
  const { phonetic, partOfSpeech } = await fetchEnglishPhonetic(englishText)

  // 4. Sinh các câu mẫu ngữ cảnh theo trường hợp
  const promptScenarios = buildSituationalPrompts(input, englishText)
  const examples: LanguageExample[] = []

  for (const s of promptScenarios) {
    const [enExampleRes, zhExampleRes] = await Promise.all([
      fetchGtxTranslate(s.viSentence, 'vi', 'en'),
      fetchGtxTranslate(s.viSentence, 'vi', 'zh-CN'),
    ])

    let zhPinyin = zhExampleRes.pinyin || ''
    if (!zhPinyin && zhExampleRes.translated) {
      const p = await fetchGtxTranslate(zhExampleRes.translated, 'zh-CN', 'en')
      zhPinyin = p.pinyin || ''
    }

    examples.push({
      context: s.context,
      vietnamese: s.viSentence,
      english: enExampleRes.translated || '',
      chinese: zhExampleRes.translated || '',
      chinesePinyin: zhPinyin,
    })
  }

  return {
    vietnamese: input,
    english: {
      text: englishText,
      phonetic: phonetic || undefined,
      partOfSpeech: partOfSpeech || undefined,
      explanation: `Bản dịch tiếng Anh tương đương của "${input}"`,
    },
    chinese: {
      text: chineseText,
      pinyin: chinesePinyin,
      explanation: `Bản dịch chữ Hán giản thể và phiên âm Pinyin của "${input}"`,
    },
    examples,
  }
}

/** Phát âm âm thanh bằng Speech Synthesis chuẩn theo ngôn ngữ */
export function playLanguageSpeech(text: string, lang: 'en' | 'zh' | 'vi') {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  if (lang === 'en') {
    utterance.lang = 'en-US'
    utterance.rate = 0.95
  } else if (lang === 'zh') {
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
  } else {
    utterance.lang = 'vi-VN'
    utterance.rate = 1
  }

  // Tìm giọng đọc tối ưu nếu có
  const voices = window.speechSynthesis.getVoices()
  const matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith(utterance.lang.toLowerCase()))
  if (matchingVoice) utterance.voice = matchingVoice

  window.speechSynthesis.speak(utterance)
}
