import { useState } from 'react'

/** Mặt đồng hồ 24h: vòng ngoài 1–12, vòng trong 13–00; phút bước 1 phút, nhãn mỗi 5 phút. */
const SIZE = 220
const CENTER = SIZE / 2
const OUTER = 88
const INNER = 58

function pointOnDial(index: number, steps: number, radius: number) {
  const angle = (index / steps) * 2 * Math.PI - Math.PI / 2
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function ClockTimeInput({
  label,
  value,
  onChange,
  size = 145,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  size?: number
}) {
  const [mode, setMode] = useState<'hour' | 'minute'>('hour')
  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText) || 0
  const minute = Number(minuteText) || 0

  function pick(event: React.PointerEvent<SVGSVGElement>) {
    if (event.type === 'pointermove' && event.buttons === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * SIZE - CENTER
    const y = ((event.clientY - box.top) / box.height) * SIZE - CENTER
    const turns = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1
    if (mode === 'minute') {
      onChange(`${pad(hour)}:${pad(Math.round(turns * 60) % 60)}`)
      return
    }
    const index = Math.round(turns * 12) % 12
    const isInner = Math.hypot(x, y) < (OUTER + INNER) / 2
    onChange(`${pad(isInner ? (index === 0 ? 0 : index + 12) : index === 0 ? 12 : index)}:${pad(minute)}`)
  }

  const handRadius = mode === 'hour' && (hour === 0 || hour > 12) ? INNER : OUTER
  const handTip = mode === 'hour' ? pointOnDial(hour % 12, 12, handRadius) : pointOnDial(minute, 60, OUTER)

  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
      <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>{label}</small>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        <button
          type="button"
          aria-label={`${label}: chọn giờ`}
          aria-pressed={mode === 'hour'}
          onClick={() => setMode('hour')}
          style={{ border: 0, background: 'none', font: 'inherit', color: mode === 'hour' ? '#6366f1' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
        >
          {pad(hour)}
        </button>
        <span style={{ color: 'var(--text-muted)' }}>:</span>
        <button
          type="button"
          aria-label={`${label}: chọn phút`}
          aria-pressed={mode === 'minute'}
          onClick={() => setMode('minute')}
          style={{ border: 0, background: 'none', font: 'inherit', color: mode === 'minute' ? '#6366f1' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
        >
          {pad(minute)}
        </button>
      </div>
      <svg
        role="application"
        aria-label={`Mặt đồng hồ ${label}`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={size}
        height={size}
        onPointerDown={pick}
        onPointerMove={pick}
        style={{ touchAction: 'none', userSelect: 'none', cursor: 'pointer', width: size, height: size }}
      >
        <circle cx={CENTER} cy={CENTER} r={OUTER + 18} fill="rgba(99,102,241,.08)" />
        <line x1={CENTER} y1={CENTER} x2={handTip.x} y2={handTip.y} stroke="#6366f1" strokeWidth={2} />
        <circle cx={handTip.x} cy={handTip.y} r={16} fill="#6366f1" />
        <circle cx={CENTER} cy={CENTER} r={3} fill="#6366f1" />
        {mode === 'hour'
          ? [OUTER, INNER].map((radius) =>
              Array.from({ length: 12 }, (_, index) => {
                const labelValue = radius === OUTER ? (index === 0 ? 12 : index) : index === 0 ? 0 : index + 12
                const spot = pointOnDial(index, 12, radius)
                return (
                  <text key={`${radius}-${index}`} x={spot.x} y={spot.y} textAnchor="middle" dominantBaseline="central" fontSize={radius === OUTER ? 15 : 12} fontWeight={700} fill={hour === labelValue ? '#fff' : 'var(--text-main, #334155)'}>
                    {pad(labelValue)}
                  </text>
                )
              }),
            )
          : Array.from({ length: 12 }, (_, index) => {
              const labelValue = index * 5
              const spot = pointOnDial(index, 12, OUTER)
              return (
                <text key={labelValue} x={spot.x} y={spot.y} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill={minute === labelValue ? '#fff' : 'var(--text-main, #334155)'}>
                  {pad(labelValue)}
                </text>
              )
            })}
      </svg>
      <input
        type="time"
        aria-label={`${label} (nhập tay)`}
        value={value}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        style={{ width: 95, textAlign: 'center', fontSize: '0.78rem', padding: '2px 4px', borderRadius: 6, border: '1px solid var(--line)' }}
      />
    </div>
  )
}
