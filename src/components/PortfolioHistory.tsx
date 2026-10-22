import { lazy, Suspense, useMemo, useState } from 'react'
import { EyeOff, RotateCcw, Trash2 } from 'lucide-react'
import type { PortfolioHistoryState } from '../hooks/use-portfolio-history'
import { HISTORY_RANGES, historyChange, selectHistory, type HistoryRange } from '../lib/history'
import { formatFiat, formatPercent } from '../lib/format'
import { usePrivacy } from './Privacy'
import { FiatAmount } from './FiatAmount'

const HistoryChart = lazy(() => import('./HistoryChart'))

export function PortfolioHistory({ history, accent }: { history: PortfolioHistoryState; accent: string }) {
  const { hidden } = usePrivacy()
  const [range, setRange] = useState<HistoryRange>('7d')
  const [clearing, setClearing] = useState(false)
  const [clearFailed, setClearFailed] = useState(false)
  const points = useMemo(() => selectHistory(history.samples, history.key, history.currency, range, history.now), [history.samples, history.key, history.currency, range, history.now])
  const last = points[points.length - 1]
  const change = historyChange(points)

  async function clear() {
    if (!window.confirm('Delete all locally recorded portfolio history, in every currency? Your watched accounts will stay. This cannot be undone.')) return
    setClearing(true)
    setClearFailed(false)
    try { await history.clear() } catch { setClearFailed(true) }
    finally { setClearing(false) }
  }

  return (
    <section className="history-section" aria-labelledby="history-title">
      <div className="history-heading">
        <h2 id="history-title">Portfolio history</h2>
        <button className="icon-btn history-clear" type="button" onClick={clear} disabled={clearing} aria-label="Delete local history" title="Delete local history">
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
      {hidden ? (
        <div className="history-placeholder"><EyeOff size={23} aria-hidden /><span>History hidden</span></div>
      ) : (
        <>
          <div className="history-toolbar">
            <div className="history-ranges" role="group" aria-label="History range">
              {(Object.keys(HISTORY_RANGES) as HistoryRange[]).map((r) => (
                <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
            <span className="history-meta">{points.length} observations · {history.currency}</span>
          </div>
          {last && (
            <div className="history-summary">
              <div><span className="history-meta">Last recorded</span><div className="history-value"><FiatAmount value={last.total} currency={history.currency} /></div></div>
              {change && (
                <div className={`history-change ${change.delta >= 0 ? 'up' : 'down'}`}>
                  <span className="history-meta">Recorded change</span>
                  <span>{change.delta > 0 ? '+' : ''}{formatFiat(change.delta, history.currency)}</span>
                  <span>{formatPercent(change.percent)}</span>
                </div>
              )}
            </div>
          )}
          {points.length >= 2 ? (
            <Suspense fallback={<div className="history-placeholder">Loading chart...</div>}>
              <HistoryChart samples={points} currency={history.currency} accent={accent} />
            </Suspense>
          ) : (
            <div className="history-placeholder">
              {history.loading ? 'Loading local history...' : last ? 'First observation saved. Waiting for the next update.' : 'No observations in this period yet.'}
            </div>
          )}
          {points.length > 0 && <p className="history-meta">Recorded since {new Date(points[0].timestamp).toLocaleString('en-US')}</p>}
          {points.length >= 2 && (
            <details className="history-observations">
              <summary>Latest observations</summary>
              <table><thead><tr><th scope="col">Date</th><th scope="col">Value ({history.currency})</th></tr></thead>
                <tbody>{points.slice(-20).reverse().map((p) => <tr key={p.id}><td><time dateTime={new Date(p.timestamp).toISOString()}>{new Date(p.timestamp).toLocaleString('en-US')}</time></td><td>{formatFiat(p.total, history.currency)}</td></tr>)}</tbody>
              </table>
            </details>
          )}
          <p className="history-note">Local observations only, while the app is open. Gaps are not filled in. Value changes include deposits and withdrawals, not just price movements.</p>
        </>
      )}
      {(history.error || clearFailed) && (
        <div className="history-warning" role="status">
          <span>{clearFailed ? 'Could not delete local history.' : 'Local history storage is unavailable. Your wallet still works.'}</span>
          <button type="button" onClick={() => { setClearFailed(false); history.retry() }}><RotateCcw size={14} aria-hidden />Retry storage</button>
        </div>
      )}
    </section>
  )
}
