import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Markets } from '../lib/api'
import type { Account, AccountView } from '../lib/chains/types'
import { groupByChain, totalFiat } from '../lib/portfolio'
import { exportJson, importJson } from '../lib/store'
import type { Currency } from '../lib/currency'
import { formatAmount } from '../lib/format'
import { Change } from '../components/Change'
import { FiatAmount } from '../components/FiatAmount'

interface Props {
  views: AccountView[]
  markets: Markets
  currency: Currency
  fetching: boolean
  onAdd: (input: string) => string | null
  onRemove: (id: string) => void
  onReplace: (accounts: Account[]) => void
  onRefresh: () => void
}

export default function Dashboard({
  views,
  markets,
  currency,
  fetching,
  onAdd,
  onReplace,
  onRefresh,
}: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const groups = useMemo(() => groupByChain(views, markets), [views, markets])
  const total = useMemo(() => totalFiat(groups), [groups])
  const loading = views.some((v) => v.isLoading)
  const lastUpdated = useMemo(() => {
    const times = views.map((v) => v.dataUpdatedAt).filter(Boolean)
    return times.length ? Math.max(...times) : 0
  }, [views])

  function add() {
    setError(null)
    const err = onAdd(input)
    if (err) setError(err)
    else setInput('')
  }

  function handleExport() {
    const accounts = views.map((v) => v.account)
    const blob = new Blob([exportJson(accounts)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gazewallet-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      try {
        onReplace(importJson(text))
      } catch {
        setError('Could not read the backup file')
      }
    })
    e.target.value = ''
  }

  return (
    <>
      <section className="hero">
        <span className="hero-label">Total portfolio</span>
        <div className="hero-fiat">
          {total > 0 ? <FiatAmount value={total} currency={currency} /> : '—'}
        </div>

        {groups.length > 0 && (
          <div className="alloc">
            <div className="alloc-bar">
              {groups.map((g, i) => {
                const pct = total > 0 ? ((g.fiat ?? 0) / total) * 100 : 0
                return (
                  <span
                    key={g.adapter.id}
                    className="alloc-seg"
                    style={{ width: `${pct}%`, opacity: Math.max(1 - i * 0.32, 0.4) }}
                    title={`${g.adapter.name} ${pct.toFixed(1)}%`}
                  />
                )
              })}
            </div>
          </div>
        )}

        {views.length > 0 && (
          <div className="hero-refresh">
            {lastUpdated > 0 && (
              <span className="updated">
                Updated {new Date(lastUpdated).toLocaleTimeString('en-US')}
              </span>
            )}
            <button className="refresh" onClick={onRefresh} disabled={fetching}>
              {fetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
      </section>

      <section className="add">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="xpub / bc1… (BTC) or 0x… (ETH)"
          spellCheck={false}
          autoCapitalize="off"
        />
        <button className="primary" onClick={add}>
          Add
        </button>
      </section>
      {error && <p className="error">{error}</p>}

      <div className="assets">
        {groups.map((g) => {
          const m = markets[g.adapter.coingeckoId]
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
                  {g.fiat != null ? <FiatAmount value={g.fiat} currency={currency} /> : '—'}
                </span>
                <span className={`asset-crypto ${g.isLoading ? 'pulse' : ''}`}>
                  {formatAmount(g.amount, g.adapter.displayDecimals)} {g.adapter.symbol}
                </span>
              </div>
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

      <footer className="footer">
        <button onClick={handleExport} disabled={views.length === 0}>
          Export backup
        </button>
        <label className="import">
          Import backup
          <input type="file" accept="application/json" onChange={handleImport} hidden />
        </label>
      </footer>
    </>
  )
}
