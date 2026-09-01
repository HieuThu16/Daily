import { useMemo } from 'react'

type InteractiveSentenceProps = {
  text: string
  lang: 'en' | 'zh' | 'vi'
  className?: string
  onWordClick: (word: string, lang: 'en' | 'zh' | 'vi') => void
}

export function InteractiveSentence({
  text,
  lang,
  className = '',
  onWordClick,
}: InteractiveSentenceProps) {
  const tokens = useMemo(() => {
    if (!text) return []

    if (lang === 'zh') {
      // Đối với tiếng Trung, tách theo từng ký tự hoặc cụm từ 1-2 chữ
      const result: { text: string; isWord: boolean }[] = []
      const chars = Array.from(text)
      for (const char of chars) {
        const isChinese = /[\u4e00-\u9fa5]/.test(char)
        result.push({ text: char, isWord: isChinese })
      }
      return result
    }

    // Đối với tiếng Anh / Tiếng Việt: tách theo từ và giữ nguyên dấu câu
    const regex = /([\w'-]+|[^\w\s]+|\s+)/g
    const matches = text.match(regex) || []
    return matches.map((token) => {
      const isWord = /[\w]/.test(token)
      return { text: token, isWord }
    })
  }, [text, lang])

  return (
    <span className={`interactive-sentence ${className}`}>
      {tokens.map((token, index) => {
        if (!token.isWord) {
          return <span key={index} className="interactive-punct">{token.text}</span>
        }

        return (
          <span
            key={index}
            role="button"
            tabIndex={0}
            className="interactive-word-token"
            onClick={(e) => {
              e.stopPropagation()
              onWordClick(token.text, lang)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onWordClick(token.text, lang)
              }
            }}
            title={`Nhấn để tra từ "${token.text}"`}
          >
            {token.text}
          </span>
        )
      })}
    </span>
  )
}
