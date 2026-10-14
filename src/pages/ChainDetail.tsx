import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Markets } from '../lib/api'
import type { Account, AccountView } from '../lib/chains/types'
import { getAdapter, groupByChain, isChainId } from '../lib/portfolio'
import type { Currency } from '../lib/currency'
import { formatAmount, formatFiat } from '../lib/format'
import { Change } from '../components/Change'
import { FiatAmount } from '../components/FiatAmount'
import { DataStatus } from '../components/DataStatus'
import { getDataStatus, type MarketQueryState } from '../lib/data-status'
import { PrivateValue, usePrivacy } from '../components/Privacy'

interface Props {
  views: AccountView[]
  markets: Markets
  currency: Currency
  marketState: MarketQueryState
  dataEnvironment: { online: boolean; now: number }
  onAdd: (input: string) => string | null
  onRemove: (id: string) => void
  onRename: (id: string, label: string) => void
  onRetry: (account: Account) => void
}

export default function ChainDetail({
  views,
  markets,
  currency,
  marketState,
  dataEnvironment,
  onAdd,
  onRemove,
  onRename,
  onRetry,
}: Props) {
  const { chain } = useParams()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const { hidden } = usePrivacy()

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
  const status = getDataStatus(groupByChain(chainViews, markets), marketState, dataEnvironment.online, dataEnvironment.now)
  const hasBalance = chainViews.some((v) => v.balance)

  function add() {
    setError(null)
    const value = input.trim()
    if (value && adapter.detect(value) === null) {
      setError(`That doesn't look like a valid ${adapter.name} key or address`)
      return
    }
    const err = onAdd(input)
    if (err) setError(err)
    else setInput('')
  }

  function startEdit(account: Account) {
    setEditingId(account.id)
    setEditValue(account.label ?? '')
  }

  function commitEdit(id: string) {
    onRename(id, editValue)
    setEditingId(null)
    setEditValue('')
  }

  return (
    <>
      <Link to="/app" className="back-link">
        ← Portfolio
      </Link>

      <section className="hero">
        <span className="hero-label">{adapter.name}</span>
        {!status.complete && chainViews.length > 0 && <div className="data-status-warning">Known balance only</div>}
        <div className="hero-fiat">
          <PrivateValue>
          {status.hasValue ? (
            <FiatAmount value={amount * price} currency={currency} />
          ) : '—'}
          </PrivateValue>
        </div>
        <div className={`hero-btc ${loading ? 'pulse' : ''}`}>
          <PrivateValue>
          {hasBalance ? formatAmount(amount, adapter.displayDecimals) : '—'}
          <span className="unit">{adapter.symbol}</span>
          </PrivateValue>
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
        <DataStatus status={status} />
      </section>

      <section className="add">
        <input
          type={hidden ? 'password' : 'text'}
          autoComplete="off"
          aria-label="Public key or address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={chain === 'btc' ? 'xpub / ypub / zpub or bc1… address' : '0x… address'}
          spellCheck={false}
          autoCapitalize="off"
        />
        <button className="primary" onClick={add}>
          Add
        </button>
      </section>
      {error && <p className="error">{error}</p>}

      <ul className="list">
        {chainViews.map((v) => {
          const fiat = v.balance && price > 0 ? v.balance.amount * price : null
          return (
            <li key={v.account.id} className="item">
              <div className="item-main">
                {editingId === v.account.id ? (
                  <input
                    className="label-input"
                    autoFocus
                    value={editValue}
                    placeholder="Label (e.g. Cold wallet)"
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(v.account.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(v.account.id)
                      if (e.key === 'Escape') {
                        setEditingId(null)
                        setEditValue('')
                      }
                    }}
                  />
                ) : (
                  <button
                    className={`label-name ${v.account.label ? '' : 'placeholder'}`}
                    onClick={() => startEdit(v.account)}
                    title="Edit label"
                  >
                    {v.account.label || 'Add label'}
                  </button>
                )}
                <div className="item-sub">
                  <span className="badge">{v.account.kind === 'xpub' ? 'XPUB' : 'ADDRESS'}</span>
                  <code className="value"><PrivateValue>{v.account.value}</PrivateValue></code>
                  {v.balance && v.account.kind === 'xpub' && (
                    <span className="meta">
                      {v.balance.usedCount} active addr · {v.balance.txCount} tx
                    </span>
                  )}
                  <DataStatus
                    status={getDataStatus(groupByChain([v], markets), marketState, dataEnvironment.online, dataEnvironment.now)}
                    compact
                  />
                </div>
              </div>
              <div className="item-right">
                <span className="bal">
                  {v.balance ? (
                    <>
                      <span className="bal-crypto">
                        <PrivateValue>
                        {formatAmount(v.balance.amount, adapter.displayDecimals)}{' '}
                        <span className="unit">{adapter.symbol}</span>
                        </PrivateValue>
                      </span>
                      {fiat !== null && (
                        <span className="bal-fiat"><PrivateValue>≈ {formatFiat(fiat, currency)}</PrivateValue></span>
                      )}
                    </>
                  ) : v.isError || !dataEnvironment.online ? (
                    <span className="bal-error-text">Balance unavailable</span>
                  ) : (
                    <span className="skeleton" aria-label="Loading balance" />
                  )}
                  {v.isError && (
                    <button className="bal-error" disabled={!dataEnvironment.online || v.isFetching} onClick={() => onRetry(v.account)}>
                      {v.isFetching ? 'Retrying...' : 'Retry balance'}
                    </button>
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
          )
        })}
        {chainViews.length === 0 && (
          <li className="empty">No {adapter.name} accounts yet. Add one above.</li>
        )}
      </ul>
    </>
  )
}
