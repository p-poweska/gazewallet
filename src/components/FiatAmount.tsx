import type { CSSProperties } from 'react'
import { useAfterFirstPaint } from '../hooks/use-after-first-paint'

const DIGITS = Array.from({ length: 10 }, (_, n) => <span key={n}>{n}</span>)

// Renderuje kwotę fiat z mniejszą, szarą częścią po przecinku (grosze/cents).
// Używa Intl.formatToParts, więc działa dla każdej waluty — także tych
// z symbolem po liczbie (np. "1 234,56 zł").
// `roll` zamienia cyfry w bębny licznika, które przewijają się przy zmianie kwoty.
export function FiatAmount({
  value,
  currency,
  className,
  roll = false,
}: {
  value: number
  currency: string
  className?: string
  roll?: boolean
}) {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).formatToParts(value)

  if (roll) return <RollingAmount parts={parts} className={className} />

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === 'decimal' || p.type === 'fraction' ? (
          <span key={i} className="cents">
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  )
}

function RollingAmount({ parts, className }: { parts: Intl.NumberFormatPart[]; className?: string }) {
  const painted = useAfterFirstPaint()
  const text = parts.map((p) => p.value).join('')
  const chars = parts.flatMap((p) => [...p.value].map((ch) => ({ ch, cents: p.type === 'decimal' || p.type === 'fraction' })))
  let digitsLeft = chars.filter(({ ch }) => /\d/.test(ch)).length

  // Keys count from the right so existing reels keep rolling when the amount gains a digit.
  // The rightmost digit moves first, like a real odometer.
  const cells = chars.map(({ ch, cents }, i) => {
    const key = chars.length - i
    const cls = cents ? ' cents' : ''
    if (!/\d/.test(ch)) return <span key={key} className={`odo-sep${cls}`}>{ch}</span>
    const delay = --digitsLeft * 45
    const n = painted ? Number(ch) : 0
    return (
      <span key={key} className={`odo-digit${cls}`}>
        <span className="odo-reel" style={{ transform: `translateY(calc(var(--odo-h) * ${-n}))`, transitionDelay: `${delay}ms` }}>
          {DIGITS}
        </span>
      </span>
    )
  })

  return (
    <span className={`odo ${className ?? ''}`} style={{ '--chars': text.length } as CSSProperties}>
      <span className="sr-only">{text}</span>
      <span className="odo-track" aria-hidden="true">{cells}</span>
    </span>
  )
}
