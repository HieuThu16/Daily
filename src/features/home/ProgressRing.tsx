type Props = {
  percent: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: React.ReactNode
}

/** Vòng tròn tiến độ dùng cho banner chào và cột "hôm nay" trong dải tuần. */
export function ProgressRing({
  percent,
  size = 64,
  stroke = 6,
  color = 'var(--primary)',
  track = 'var(--card-border)',
  children,
}: Props) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  const dash = (clamped / 100) * circumference
  const center = size / 2

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {children ? <div className="progress-ring-label">{children}</div> : null}
    </div>
  )
}
