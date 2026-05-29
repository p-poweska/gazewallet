import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { BtcMarket } from '../lib/api'
import { fetchWalletBalance, formatBtc, formatFiat } from '../lib/wallet'
import {
  exportJson,
  importJson,
  loadEntries,
  makeEntry,
  saveEntries,
  type WatchEntry,
} from '../lib/store'
import type { Currency } from '../lib/currency'
import { Change } from '../components/Change'
import { FiatAmount } from '../components/FiatAmount'

interface Props {
  currency: Currency
  market?: BtcMarket
  marketFetching: boolean
}

export default function Wallet({ currency, market, marketFetching }: Props) {
  const [entries, setEntries] = useState<WatchEntry[]>(() => loadEntries())
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  const balanceQueries = useQueries({
    queries: entries.map((entry) => ({
      queryKey: ['balance', entry.value],
      queryFn: () => fetchWalletBalance(entry),
    })),
  })

  const totalSat = useMemo(
    () => balanceQueries.reduce((sum, q) => sum + (q.data?.balanceSat ?? 0), 0),
    [balanceQueries],
  )
  const price = market?.price ?? 0
  const loading = balanceQueries.some((q) => q.isLoading)
  const fetching = balanceQueries.some((q) => q.isFetching) || marketFetching
  const lastUpdated = useMemo(() => {
    const times = balanceQueries.map((q) => q.dataUpdatedAt).filter(Boolean)
    return times.length ? Math.max(...times) : 0
  }, [balanceQueries])

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    queryClient.invalidateQueries({ queryKey: ['market'] })
  }

  function addEntry() {
    setError(null)
    try {
      const entry = makeEntry(input)
      if (entries.some((e) => e.value === entry.value)) {
        setError('This key/address is already on the list')
        return
      }
      setEntries((prev) => [...prev, entry])
      setInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid value')
    }
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function handleExport() {
    const blob = new Blob([exportJson(entries)], { type: 'application/json' })
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
        setEntries(importJson(text))
      } catch {
        setError('Could not read the backup file')
      }
    })
    e.target.value = ''
  }

  return (
    <>
      <section className="hero">
        <span className="hero-label">Total balance</span>
        {price > 0 && (
          <div className="hero-fiat">
            <FiatAmount value={(totalSat / 1e8) * price} currency={currency} />
          </div>
        )}
        <div className={`hero-btc ${loading ? 'pulse' : ''}`}>
          {formatBtc(totalSat)}
          <span className="unit">BTC</span>
        </div>

        {price > 0 && <div className="hero-price">1 BTC = {formatFiat(price, currency)}</div>}
        {market && (
          <div className="stats">
            <Change label="24h" value={market.change24h} />
            <Change label="7d" value={market.change7d} />
            <Change label="30d" value={market.change30d} />
          </div>
        )}
        {entries.length > 0 && (
          <div className="hero-refresh">
            {lastUpdated > 0 && (
              <span className="updated">
                Updated {new Date(lastUpdated).toLocaleTimeString('en-US')}
              </span>
            )}
            <button className="refresh" onClick={refresh} disabled={fetching}>
              {fetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
      </section>

      <section className="add">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          placeholder="xpub / ypub / zpub or bc1… address"
          spellCheck={false}
          autoCapitalize="off"
        />
        <button className="primary" onClick={addEntry}>
          Add
        </button>
      </section>
      {error && <p className="error">{error}</p>}

      <ul className="list">
        {entries.map((entry, i) => {
          const q = balanceQueries[i]
          return (
            <li key={entry.id} className="item">
              <div className="item-main">
                <span className="badge">{entry.kind === 'xpub' ? 'XPUB' : 'ADDRESS'}</span>
                <code className="value">{entry.value}</code>
                {q.data && entry.kind === 'xpub' && (
                  <span className="meta">
                    {q.data.usedCount} active addr · {q.data.txCount} tx
                  </span>
                )}
              </div>
              <div className="item-right">
                <span className="bal">
                  {q.data ? (
                    <>
                      {formatBtc(q.data.balanceSat)} <span className="unit">BTC</span>
                    </>
                  ) : q.isError ? (
                    <span className="bal-error">error</span>
                  ) : (
                    <span className="skeleton" />
                  )}
                </span>
                <button className="remove" onClick={() => removeEntry(entry.id)} aria-label="Remove">
                  ✕
                </button>
              </div>
            </li>
          )
        })}
        {entries.length === 0 && (
          <li className="empty">Add an XPUB or address to start tracking.</li>
        )}
      </ul>

      <footer className="footer">
        <button onClick={handleExport} disabled={entries.length === 0}>
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
