import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPriceUsd } from './lib/api'
import { fetchWalletBalance, formatBtc, formatUsd } from './lib/wallet'
import {
  exportJson,
  importJson,
  loadEntries,
  makeEntry,
  saveEntries,
  type WatchEntry,
} from './lib/store'
import { ACCENTS, loadAccent, saveAccent } from './lib/theme'

export default function App() {
  const [entries, setEntries] = useState<WatchEntry[]>(() => loadEntries())
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [accent, setAccent] = useState<string>(() => loadAccent())
  const queryClient = useQueryClient()

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

  function changeAccent(color: string) {
    setAccent(color)
    saveAccent(color)
  }

  const priceQuery = useQuery({ queryKey: ['price'], queryFn: fetchPriceUsd })

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
  const price = priceQuery.data ?? 0
  const loading = balanceQueries.some((q) => q.isLoading)
  const fetching = balanceQueries.some((q) => q.isFetching) || priceQuery.isFetching
  const lastUpdated = useMemo(() => {
    const times = balanceQueries.map((q) => q.dataUpdatedAt).filter(Boolean)
    return times.length ? Math.max(...times) : 0
  }, [balanceQueries])

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    queryClient.invalidateQueries({ queryKey: ['price'] })
  }

  function addEntry() {
    setError(null)
    try {
      const entry = makeEntry(input)
      if (entries.some((e) => e.value === entry.value)) {
        setError('Ten klucz/adres już jest na liście')
        return
      }
      setEntries((prev) => [...prev, entry])
      setInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nieprawidłowa wartość')
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
        setError('Nie udało się wczytać pliku kopii')
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
              <p className="subtitle">Watch-only · dane lokalnie</p>
            </div>
          </div>
          <div className="accents" role="group" aria-label="Kolor przewodni">
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
            <label className="swatch custom" title="Własny kolor">
              <input
                type="color"
                value={accent}
                onChange={(e) => changeAccent(e.target.value)}
                aria-label="Własny kolor"
              />
            </label>
          </div>
        </header>

        <section className="hero">
          <span className="hero-label">Łączne saldo</span>
          <div className={`hero-btc ${loading ? 'pulse' : ''}`}>
            {formatBtc(totalSat)}
            <span className="unit">BTC</span>
          </div>
          {price > 0 && <div className="hero-fiat">≈ {formatUsd((totalSat / 1e8) * price)}</div>}
          {price > 0 && <div className="hero-price">1 BTC = {formatUsd(price)}</div>}
          {entries.length > 0 && (
            <div className="hero-refresh">
              {lastUpdated > 0 && (
                <span className="updated">
                  Aktualizacja {new Date(lastUpdated).toLocaleTimeString('pl-PL')}
                </span>
              )}
              <button className="refresh" onClick={refresh} disabled={fetching}>
                {fetching ? 'Odświeżanie…' : 'Odśwież'}
              </button>
            </div>
          )}
        </section>

        <section className="add">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="xpub / ypub / zpub lub adres bc1…"
            spellCheck={false}
            autoCapitalize="off"
          />
          <button className="primary" onClick={addEntry}>
            Dodaj
          </button>
        </section>
        {error && <p className="error">{error}</p>}

        <ul className="list">
          {entries.map((entry, i) => {
            const q = balanceQueries[i]
            return (
              <li key={entry.id} className="item">
                <div className="item-main">
                  <span className="badge">{entry.kind === 'xpub' ? 'XPUB' : 'ADRES'}</span>
                  <code className="value">{entry.value}</code>
                  {q.data && entry.kind === 'xpub' && (
                    <span className="meta">{q.data.addressCount} adr. · {q.data.txCount} tx</span>
                  )}
                </div>
                <div className="item-right">
                  <span className="bal">
                    {q.isLoading ? (
                      <span className="skeleton" />
                    ) : q.isError ? (
                      <span className="bal-error">błąd</span>
                    ) : (
                      <>
                        {formatBtc(q.data!.balanceSat)} <span className="unit">BTC</span>
                      </>
                    )}
                  </span>
                  <button
                    className="remove"
                    onClick={() => removeEntry(entry.id)}
                    aria-label="Usuń"
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
          {entries.length === 0 && (
            <li className="empty">Dodaj XPUB lub adres, aby śledzić saldo.</li>
          )}
        </ul>

        <footer className="footer">
          <button onClick={handleExport} disabled={entries.length === 0}>
            Eksport kopii
          </button>
          <label className="import">
            Import kopii
            <input type="file" accept="application/json" onChange={handleImport} hidden />
          </label>
        </footer>
      </main>
    </div>
  )
}
