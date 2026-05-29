import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Markets } from '../lib/api'
import type { AccountView } from '../lib/chains/types'
import { getAdapter, isChainId } from '../lib/portfolio'
import type { Currency } from '../lib/currency'
import { formatAmount, formatFiat } from '../lib/format'
import { Change } from '../components/Change'
import { FiatAmount } from '../components/FiatAmount'

interface Props {
  views: AccountView[]
  markets: Markets
  currency: Currency
  fetching: boolean
  onAdd: (input: string) => string | null
  onRemove: (id: string) => void
  onRefresh: () => void
}

export default function ChainDetail({
  views,
  markets,
  currency,
  fetching,
  onAdd,
  onRemove,
  onRefresh,
}: Props) {
  const { chain } = useParams()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const valid = isChainId(chain)
  const chainViews = useMemo(
    () => (valid ? views.filter((v) => v.account.chain === chain) : []),
    [views, chain, valid],
  )
  const amount = useMemo(
    () => chainViews.reduce((s, v) => s + (v.balance?.amount ?? 0), 0),
    [chainViews],
  )

  if (!valid) {
    return (
      <section className="hero">
        <p className="error">Unknown chain.</p>
        <Link to="/app" className="back-link">
          ← Back to portfolio
        </Link>
      </section>
    )
  }

  const adapter = getAdapter(chain)
  const market = markets[adapter.coingeckoId]
  const price = market?.price ?? 0
  const loading = chainViews.some((v) => v.isLoading)

  function add() {
    setError(null)
    const value = input.trim()
    if (value && adapter.detect(value) === null) {
      setError(`That doesn't look like a ${adapter.name} key or address`)
      return
    }
    const err = onAdd(input)
    if (err) setError(err)
    else setInput('')
  }

  return (
    <>
      <Link to="/app" className="back-link">
        ← Portfolio
      </Link>

      <section className="hero">
        <span className="hero-label">{adapter.name}</span>
        {price > 0 && (
          <div className="hero-fiat">
            <FiatAmount value={amount * price} currency={currency} />
          </div>
        )}
        <div className={`hero-btc ${loading ? 'pulse' : ''}`}>
          {formatAmount(amount, adapter.displayDecimals)}
          <span className="unit">{adapter.symbol}</span>
        </div>

        {price > 0 && (
          <div className="hero-price">
            1 {adapter.symbol} = {formatFiat(price, currency)}
          </div>
        )}
        {market && (
          <div className="stats">
            <Change label="24h" value={market.change24h} />
            <Change label="7d" value={market.change7d} />
            <Change label="30d" value={market.change30d} />
          </div>
        )}
        {chainViews.length > 0 && (
          <div className="hero-refresh">
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
          placeholder={
            chain === 'btc' ? 'xpub / ypub / zpub or bc1… address' : '0x… address'
          }
          spellCheck={false}
          autoCapitalize="off"
        />
        <button className="primary" onClick={add}>
          Add
        </button>
      </section>
      {error && <p className="error">{error}</p>}

      <ul className="list">
        {chainViews.map((v) => (
          <li key={v.account.id} className="item">
            <div className="item-main">
              <span className="badge">{v.account.kind === 'xpub' ? 'XPUB' : 'ADDRESS'}</span>
              <code className="value">{v.account.value}</code>
              {v.balance && v.account.kind === 'xpub' && (
                <span className="meta">
                  {v.balance.usedCount} active addr · {v.balance.txCount} tx
                </span>
              )}
            </div>
            <div className="item-right">
              <span className="bal">
                {v.balance ? (
                  <>
                    {formatAmount(v.balance.amount, adapter.displayDecimals)}{' '}
                    <span className="unit">{adapter.symbol}</span>
                  </>
                ) : v.isError ? (
                  <span className="bal-error">error</span>
                ) : (
                  <span className="skeleton" />
                )}
              </span>
              <button
                className="remove"
                onClick={() => onRemove(v.account.id)}
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {chainViews.length === 0 && (
          <li className="empty">No {adapter.name} accounts yet. Add one above.</li>
        )}
      </ul>
    </>
  )
}
