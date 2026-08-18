// Rút thẻ kiến thức hỏi-đáp từ một video YouTube bằng Gemini.
// Deploy: supabase functions deploy video-lesson
// Secret cần đặt: GEMINI_API_KEY
//
// Để ở server vì khoá Gemini không được lọt vào bundle của trình duyệt.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

/**
 * Thử lần lượt: hết hạn mức ngày của model đầu thì tụt xuống model sau.
 * Model càng về sau hạn mức free càng thoáng, chất lượng tóm tắt video kém hơn chút.
 */
const MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'Chưa đặt GEMINI_API_KEY' }, 500)

  const { videoId, startSec, endSec } = await req.json().catch(() => ({}))
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) return json({ error: 'Thiếu videoId hợp lệ' }, 400)

  // Chỉ xem một khúc video khi nơi gọi chia nhỏ để lách trần token mỗi phút.
  const videoMetadata =
    Number.isFinite(startSec) && Number.isFinite(endSec)
      ? { startOffset: `${Math.max(0, Math.floor(startSec))}s`, endOffset: `${Math.floor(endSec)}s` }
      : undefined

  const callGemini = (model: string) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` }, ...(videoMetadata ? { videoMetadata } : {}) },
              {
                text:
                  (videoMetadata
                    ? `Đây chỉ là khúc ${Math.floor(startSec / 60)}-${Math.floor(endSec / 60)} phút của video; thẻ tóm tắt hãy ghi rõ khoảng phút này.` + '\n'
                    : '') +
                  'Xem kỹ video và trả về mảng cards bằng tiếng Việt.\n' +
                  'Thẻ ĐẦU TIÊN bắt buộc là thẻ tóm tắt:\n' +
                  '  question: "Tóm tắt toàn bộ nội dung video"\n' +
                  '  answer: 8-12 câu, đi theo mạch video từ đầu đến cuối, nêu đủ ý chính, lập luận và kết luận;\n' +
                  '  giữ lại số liệu, ví dụ, tên riêng mà video nhắc tới.\n' +
                  'Tiếp theo là 5-6 thẻ hỏi-đáp đi sâu vào từng ý riêng biệt:\n' +
                  '  question: câu hỏi cụ thể, đọc rời vẫn hiểu (đừng dùng "video này", "diễn giả").\n' +
                  '  answer: 4-6 câu, giải thích đủ CÁI GÌ - TẠI SAO - ÁP DỤNG THẾ NÀO, kèm ví dụ hoặc\n' +
                  '  con số video đưa ra. Không trả lời một câu chung chung.\n' +
                  'Mỗi thẻ một ý khác nhau, không trùng lặp. Chỉ dựa trên nội dung video, không bịa.',
              },
            ],
          },
        ],
        generationConfig: {
          // Rút kiến thức thì nghe là chính, không cần nhìn rõ hình.
          // Độ phân giải thấp tốn ~66 token/giây thay vì ~300 — vừa rẻ vừa lọt trần token/phút.
          mediaResolution: 'MEDIA_RESOLUTION_LOW',
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              cards: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } },
                  required: ['question', 'answer'],
                },
              },
            },
            required: ['cards'],
          },
        },
      }),
    }
  )

  // 429/503 là quá tải hoặc chạm nhịp tạm thời — thử lại vài lần trước khi bỏ cuộc.
  let res!: Response
  for (const model of MODELS) {
    res = await callGemini(model)
    for (let attempt = 1; attempt <= 3 && (res.status === 503 || res.status === 429); attempt++) {
      // 429 do hết hạn mức NGÀY thì thử lại chỉ đốt thêm lượt — chỉ chờ khi là nhịp mỗi phút.
      if (res.status === 429 && /per.?day|PerDay/i.test(await res.clone().text())) break
      await new Promise((r) => setTimeout(r, attempt * 4000))
      res = await callGemini(model)
    }
    if (res.status !== 429) break // chỉ hết hạn mức mới đáng đổi model
  }

  if (!res.ok) {
    const detail = await res.text()
    // 429 vì hết hạn mức ngày thì thử lại bao nhiêu lần cũng vô ích — nói thẳng cho người dùng.
    if (res.status === 429) {
      return json(
        {
          error:
            'Hết hạn mức Gemini miễn phí ở cả ' +
            MODELS.join(', ') +
            '. Chờ reset (0h giờ Thái Bình Dương) hoặc bật billing trong Google AI Studio.',
          detail,
        },
        429
      )
    }
    return json({ error: `Gemini lỗi ${res.status}`, detail }, 502)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return json({ error: 'Gemini không trả về nội dung' }, 502)

  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed?.cards) || parsed.cards.length === 0) {
      return json({ error: 'Gemini không rút được thẻ nào' }, 502)
    }
    return json({ cards: parsed.cards })
  } catch {
    return json({ error: 'Gemini trả về JSON hỏng' }, 502)
  }
})
