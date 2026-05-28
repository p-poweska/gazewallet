import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMarket } from './lib/api'
import { fetchWalletBalance, formatBtc, formatFiat, formatPercent } from './lib/wallet'
import {
  exportJson,
  importJson,
  loadEntries,
  makeEntry,
  saveEntries,
  type WatchEntry,
} from './lib/store'
import { ACCENTS, loadAccent, saveAccent } from './lib/theme'
import { CURRENCIES, loadCurrency, saveCurrency, type Currency } from './lib/currency'

function Change({ label, value }: { label: string; value: number | null }) {
  const cls = value === null ? '' : value >= 0 ? 'up' : 'down'
  return (
    <div className={`stat ${cls}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{formatPercent(value)}</span>
    </div>
  )
}

export default function App() {
  const [entries, setEntries] = useState<WatchEntry[]>(() => loadEntries())
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [accent, setAccent] = useState<string>(() => loadAccent())
  const [currency, setCurrency] = useState<Currency>(() => loadCurrency())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  function changeAccent(color: string) {
    setAccent(color)
    saveAccent(color)
  }

  function changeCurrency(c: Currency) {
    setCurrency(c)
    saveCurrency(c)
  }

  const marketQuery = useQuery({
    queryKey: ['market', currency],
    queryFn: () => fetchMarket(currency),
  })

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
  const market = marketQuery.data
  const price = market?.price ?? 0
  const loading = balanceQueries.some((q) => q.isLoading)
  const fetching = balanceQueries.some((q) => q.isFetching) || marketQuery.isFetching
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
    <div className="page">
      <main className="app">
        <header className="header">
          <div className="brand">
            <span className="logo" aria-hidden />
            <div>
              <h1>gazewallet</h1>
              <p className="subtitle">Watch-only · data stays local</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={() => setFaqOpen(true)}
              aria-label="FAQ"
              title="How it works"
            >
              ?
            </button>
            <button
              className="icon-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </header>

        <section className="hero">
          <span className="hero-label">Total balance</span>
          <div className={`hero-btc ${loading ? 'pulse' : ''}`}>
            {formatBtc(totalSat)}
            <span className="unit">BTC</span>
          </div>
          {price > 0 && (
            <div className="hero-fiat">≈ {formatFiat((totalSat / 1e8) * price, currency)}</div>
          )}
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
                  <button
                    className="remove"
                    onClick={() => removeEntry(entry.id)}
                    aria-label="Remove"
                  >
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
      </main>

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Settings</h2>
              <button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="setting">
              <span className="setting-label">Accent color</span>
              <div className="accents">
                {ACCENTS.map((a) => (
                  <button
                    key={a.color}
                    className={`swatch ${accent === a.color ? 'active' : ''}`}
                    style={{ background: a.color }}
                    onClick={() => changeAccent(a.color)}
                    title={a.name}
                    aria-label={a.name}
                  />
                ))}
                <label className="swatch custom" title="Custom color">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => changeAccent(e.target.value)}
                    aria-label="Custom color"
                  />
                </label>
              </div>
            </div>

            <div className="setting">
              <span className="setting-label">Conversion currency</span>
              <select
                className="select"
                value={currency}
                onChange={(e) => changeCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {faqOpen && (
        <div className="modal-overlay" onClick={() => setFaqOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>How it works</h2>
              <button className="icon-btn" onClick={() => setFaqOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="faq">
              <details>
                <summary>What is gazewallet?</summary>
                <p>
                  A watch-only Bitcoin tracker. You add a public key (XPUB) or individual
                  addresses and it shows your balance. It can only read the blockchain — it can
                  never spend your coins.
                </p>
              </details>
              <details>
                <summary>What is an XPUB and is it safe to paste?</summary>
                <p>
                  An XPUB (also ypub/zpub) is your wallet's extended <em>public</em> key. It lets
                  the app derive all your addresses to compute a balance, but it cannot sign
                  transactions. Note: anyone holding your XPUB can see your full balance and
                  history, so treat it as private. It never leaves your browser.
                </p>
              </details>
              <details>
                <summary>Where is my data stored?</summary>
                <p>
                  Everything is kept locally in your browser (localStorage), never on a server.
                  There are no accounts. Use Export backup to save a copy, and Import to restore
                  it on another device.
                </p>
              </details>
              <details>
                <summary>How are balances calculated?</summary>
                <p>
                  For an XPUB the app derives addresses following the BIP44 “gap limit”: it scans
                  consecutive addresses until it finds 20 empty ones in a row, then stops. The
                  “active addr” count is how many addresses actually have transaction history —
                  the same number your hardware wallet shows.
                </p>
              </details>
              <details>
                <summary>Is it private? Who sees my addresses?</summary>
                <p>
                  Address data comes from mempool.space and prices from CoinGecko, both via a
                  same-origin proxy. The proxy talks to those services so they never see your IP
                  directly. Your XPUB itself is never sent anywhere — only individual derived
                  addresses are queried.
                </p>
              </details>
              <details>
                <summary>Why does it scan so many addresses?</summary>
                <p>
                  The 20-address gap limit is a safety margin so funds on later addresses are
                  never missed. It does not mean you own that many addresses. Results are cached,
                  so a page reload won't re-query everything.
                </p>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
