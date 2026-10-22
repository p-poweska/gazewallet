import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Markets } from '../lib/api'
import type { AccountView } from '../lib/chains/types'
import { allocShade, groupByChain, portfolioPriceEffect24h, totalFiat } from '../lib/portfolio'
import type { Currency } from '../lib/currency'
import { formatAmount } from '../lib/format'
import { Change } from '../components/Change'
import { FiatAmount } from '../components/FiatAmount'
import { DataStatus } from '../components/DataStatus'
import { getDataStatus, type MarketQueryState } from '../lib/data-status'
import { PrivateValue, usePrivacy } from '../components/Privacy'
import { PortfolioHistory } from '../components/PortfolioHistory'
import type { PortfolioHistoryState } from '../hooks/use-portfolio-history'
import { AddAccount } from '../components/AddAccount'
import { portfolioOverlapWarning } from '../lib/account-overlap'
import { PriceEffect } from '../components/PriceEffect'
import { BackupControls } from '../components/BackupControls'
import type { BackupPayload, BackupSettings } from '../lib/backup'
import { IrisDial, type IrisSegment } from '../components/IrisDial'

interface Props {
  accent: string
  history: PortfolioHistoryState
  views: AccountView[]
  markets: Markets
  currency: Currency
  marketState: MarketQueryState
  /** Any price or balance request in flight; drives the iris scan sweep. */
  scanning: boolean
  dataEnvironment: { online: boolean; now: number }
  onAdd: (input: string, label?: string) => string | null
  backupSettings: BackupSettings
  onImport: (backup: BackupPayload, mode: 'merge' | 'replace', restoreSettings: boolean) => void
}

export default function Dashboard({ accent, history, views, markets, currency, marketState, scanning, dataEnvironment, onAdd, backupSettings, onImport }: Props) {
  const { hidden } = usePrivacy()

  const groups = useMemo(() => groupByChain(views, markets), [views, markets])
  const total = useMemo(() => totalFiat(groups), [groups])
  const status = getDataStatus(groups, marketState, dataEnvironment.online, dataEnvironment.now)
  const priceEffect = status.complete ? portfolioPriceEffect24h(groups, markets) : null
  const loading = views.some((v) => v.isLoading)
  const overlap = portfolioOverlapWarning(views)
  // Allocation (iris colours + legend) only for a complete, visible valuation.
  const showAllocation = !hidden && status.complete && total > 0
  const segments: IrisSegment[] = showAllocation
    ? groups.map((g, i) => ({ id: g.adapter.id, share: (g.fiat ?? 0) / total, color: allocShade(i) }))
    : []

  return (
    <>
      <section className="hero">
        <IrisDial segments={segments} scanning={scanning}>
          <span className="hero-label">{status.complete ? 'Total portfolio' : 'Known portfolio value'}</span>
          <div className="hero-fiat">
            <PrivateValue>
            {status.hasValue ? <FiatAmount value={total} currency={currency} roll /> : '—'}
            </PrivateValue>
          </div>
        </IrisDial>
        <PriceEffect effect={priceEffect} currency={currency} />

        {showAllocation && (
          <ul className="alloc-legend">
            {segments.map((s, i) => (
              <li key={s.id} className="alloc-item">
                <span className="alloc-dot" style={{ background: s.color }} />
                <span className="alloc-sym">{groups[i].adapter.symbol}</span>
                <span className="alloc-pct">{(s.share * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        )}

        <DataStatus status={status} />
      </section>

      {overlap && <p className="overlap-warning" role="status">{overlap}</p>}
      <AddAccount views={views} onAdd={onAdd} />

      <div className="assets">
        {groups.map((g) => {
          const m = markets[g.adapter.coingeckoId]
          const groupStatus = getDataStatus([g], marketState, dataEnvironment.online, dataEnvironment.now)
          return (
            <Link key={g.adapter.id} to={`/app/${g.adapter.id}`} className="card asset-card">
              <div className="asset-head">
                <span className="asset-icon" aria-hidden>
                  {g.adapter.glyph}
                </span>
                <div className="asset-id">
                  <span className="asset-name">{g.adapter.name}</span>
                  <span className="asset-count">
                    {g.views.length} {g.views.length === 1 ? 'account' : 'accounts'}
                  </span>
                </div>
                {m && <Change label="24h" value={m.change24h} />}
              </div>
              <div className="asset-amounts">
                <span className="asset-fiat">
                  <PrivateValue>
                  {groupStatus.hasValue && g.fiat != null ? <FiatAmount value={g.fiat} currency={currency} roll /> : '—'}
                  </PrivateValue>
                </span>
                <span className={`asset-crypto ${g.isLoading ? 'pulse' : ''}`}>
                  <PrivateValue>
                  {g.views.some((v) => v.balance) ? formatAmount(g.amount, g.adapter.displayDecimals) : '—'} {g.adapter.symbol}
                  </PrivateValue>
                </span>
              </div>
              {!groupStatus.complete && <span className="data-status-warning">Partial valuation</span>}
              <DataStatus status={groupStatus} compact />
            </Link>
          )
        })}
        {views.length === 0 && (
          <div className="empty card">
            Add an XPUB or address to start tracking your portfolio.
          </div>
        )}
        {views.length > 0 && groups.length === 0 && !loading && (
          <div className="empty card">No balances found yet.</div>
        )}
      </div>

      <PortfolioHistory history={history} accent={accent} />

      <BackupControls accounts={views.map((v) => v.account)} settings={backupSettings} onImport={onImport} />
    </>
  )
}
