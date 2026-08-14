// Bóng đèn ý tưởng: vẽ nét → tim đèn sáng → tia sáng bung ra, lặp lại (kiểu lordicon wired-flat bulb).
export function BulbIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="bulb-anim"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="bulb-rays">
        <line x1="12" y1="1.6" x2="12" y2="0.2" />
        <line x1="4.8" y1="4.8" x2="3.7" y2="3.7" />
        <line x1="19.2" y1="4.8" x2="20.3" y2="3.7" />
        <line x1="2.2" y1="10" x2="0.8" y2="10" />
        <line x1="21.8" y1="10" x2="23.2" y2="10" />
      </g>
      <path className="bulb-glass" d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path className="bulb-glass" d="M9 18h6" />
      <path className="bulb-glass" d="M10 22h4" />
      <path className="bulb-filament" d="M10 11.4c.7-1.1 1.3-1.1 2 0s1.3 1.1 2 0" />
    </svg>
  )
}
