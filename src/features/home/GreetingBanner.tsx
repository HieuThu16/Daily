import { ChevronRight } from 'lucide-react'
import { greetingFor, type CompletionSummary } from '../../lib/homeProgress'
import { ProgressRing } from './ProgressRing'

export function GreetingBanner({ completion, onOpen }: { completion: CompletionSummary; onOpen: () => void }) {
  const greeting = greetingFor(new Date().getHours())

  return (
    <button type="button" className="greeting-banner" onClick={onOpen}>
      <span className="greeting-emoji">{greeting.emoji}</span>
      <span className="greeting-text">
        <strong>{greeting.text}</strong>
        <span>
          {completion.remaining > 0 ? (
            <>Hôm nay bạn có <b>{completion.remaining}</b> việc cần làm</>
          ) : (
            <>Hôm nay bạn đã xong hết việc rồi ✨</>
          )}
        </span>
      </span>
      <ProgressRing percent={completion.percent} size={72} stroke={7}>
        <strong>{completion.percent}%</strong>
        <span>Hoàn thành</span>
      </ProgressRing>
      <ChevronRight size={20} color="var(--text-muted)" />
    </button>
  )
}
