import type { DataStatusResult } from '../lib/data-status'

export function DataStatus({ status, compact = false }: { status: DataStatusResult; compact?: boolean }) {
  if (status.kind === 'empty') return null
  const date = status.oldestUpdatedAt > 0 ? new Date(status.oldestUpdatedAt) : null

  return (
    <div className={`data-status data-status--${status.kind} ${compact ? 'data-status--compact' : ''}`} role="status">
      <span className="data-status-label">{status.label}</span>
      {!compact && status.message && <span>{status.message}</span>}
      {!compact && !status.complete && (
        <span className="data-status-warning">
          Partial valuation
          {status.missingBalances > 0 && ` · ${status.missingBalances} missing balance${status.missingBalances === 1 ? '' : 's'}`}
          {status.missingPrices > 0 && ` · ${status.missingPrices} missing price${status.missingPrices === 1 ? '' : 's'}`}
        </span>
      )}
      {!compact && date && (
        <span>
          Oldest data: <time dateTime={date.toISOString()}>{date.toLocaleString('en-US')}</time>
        </span>
      )}
    </div>
  )
}
