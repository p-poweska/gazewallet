import { formatPercent } from '../lib/wallet'

export function Change({ label, value }: { label: string; value: number | null }) {
  const cls = value === null ? '' : value >= 0 ? 'up' : 'down'
  return (
    <div className={`stat ${cls}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{formatPercent(value)}</span>
    </div>
  )
}
