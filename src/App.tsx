import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
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

export default function App() {
  const [entries, setEntries] = useState<WatchEntry[]>(() => loadEntries())
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

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
    <main className="app">
      <header className="header">
        <h1>gazewallet</h1>
        <p className="subtitle">Watch-only portfel BTC — dane trzymane lokalnie</p>
      </header>

      <section className="total">
        <div className="total-btc">{formatBtc(totalSat)} BTC</div>
        {price > 0 && <div className="total-fiat">{formatUsd((totalSat / 1e8) * price)}</div>}
      </section>

      <section className="add">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          placeholder="xpub / ypub / zpub lub adres bc1..."
          spellCheck={false}
          autoCapitalize="off"
        />
        <button onClick={addEntry}>Dodaj</button>
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
              </div>
              <div className="item-right">
                <span className="bal">
                  {q.isLoading
                    ? '…'
                    : q.isError
                      ? 'błąd'
                      : `${formatBtc(q.data!.balanceSat)} BTC`}
                </span>
                <button className="remove" onClick={() => removeEntry(entry.id)} aria-label="Usuń">
                  ✕
                </button>
              </div>
            </li>
          )
        })}
        {entries.length === 0 && <li className="empty">Dodaj XPUB lub adres, aby śledzić saldo.</li>}
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
  )
}
