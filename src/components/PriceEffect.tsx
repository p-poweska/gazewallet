import { formatFiat, formatPercent } from '../lib/format'
import { usePrivacy } from './Privacy'

export function PriceEffect({ effect, currency }: { effect: { percent: number; delta: number } | null; currency: string }) {
  const { hidden } = usePrivacy()
  if (hidden || !effect) return null
  return (
    <div className={`price-effect ${effect.delta >= 0 ? 'positive' : 'negative'}`}>
      <span className="price-effect-label">24h price effect</span>
      <div><strong>{formatPercent(effect.percent)}</strong><span>{effect.delta > 0 ? '+' : ''}{formatFiat(effect.delta, currency)}</span></div>
      <span className="price-effect-note">At current holdings · not investment return</span>
    </div>
  )
}
