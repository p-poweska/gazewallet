import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMarkets } from './lib/api'
import { ADAPTERS, getAdapter, makeAccount } from './lib/chains'
import type { Account, AccountView } from './lib/chains/types'
import { loadAccounts, saveAccounts } from './lib/store'
import { ACCENTS, loadAccent, saveAccent } from './lib/theme'
import { CURRENCIES, loadCurrency, saveCurrency, type Currency } from './lib/currency'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import ChainDetail from './pages/ChainDetail'

// CoinGecko ids for every supported chain — small list, fetched in one call.
const COIN_IDS = ADAPTERS.map((a) => a.coingeckoId)

export default function App() {
  const [accent, setAccent] = useState<string>(() => loadAccent())
  const [currency, setCurrency] = useState<Currency>(() => loadCurrency())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts())
  const queryClient = useQueryClient()

  useEffect(() => {
    saveAccounts(accounts)
  }, [accounts])

  function changeAccent(color: string) {
    setAccent(color)
    saveAccent(color)
  }

  function changeCurrency(c: Currency) {
    setCurrency(c)
    saveCurrency(c)
  }

  const marketsQuery = useQuery({
    queryKey: ['markets', currency],
    queryFn: () => fetchMarkets(currency, COIN_IDS),
  })
  const markets = marketsQuery.data ?? {}

  // One balance query per account, keyed by chain+value so caches survive reorders.
  const balanceQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ['balance', account.chain, account.value],
      queryFn: () => getAdapter(account.chain).fetchBalance(account),
    })),
  })

  // Join each account with its async balance state.
  const views: AccountView[] = useMemo(
    () =>
      accounts.map((account, i) => {
        const q = balanceQueries[i]
        return {
          account,
          balance: q.data,
          isLoading: q.isLoading,
          isError: q.isError,
          dataUpdatedAt: q.dataUpdatedAt,
        }
      }),
    [accounts, balanceQueries],
  )

  const fetching =
    balanceQueries.some((q) => q.isFetching) || marketsQuery.isFetching

  function addAccount(input: string): string | null {
    try {
      const account = makeAccount(input)
      if (accounts.some((a) => a.chain === account.chain && a.value === account.value)) {
        return 'This key/address is already on the list'
      }
      setAccounts((prev) => [...prev, account])
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid value'
    }
  }

  function removeAccount(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  function replaceAccounts(next: Account[]) {
    setAccounts(next)
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    queryClient.invalidateQueries({ queryKey: ['markets'] })
  }

  return (
    <div className="page">
      <main className="app">
        <header className="header">
          <Link to="/" className="brand">
            <span className="logo" aria-hidden />
            <div>
              <h1>gazewallet</h1>
              <p className="subtitle">Watch-only · data stays local</p>
            </div>
          </Link>
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

        <Routes>
          <Route path="/" element={<Landing currency={currency} markets={markets} />} />
          <Route
            path="/app"
            element={
              <Dashboard
                views={views}
                markets={markets}
                currency={currency}
                fetching={fetching}
                onAdd={addAccount}
                onRemove={removeAccount}
                onReplace={replaceAccounts}
                onRefresh={refresh}
              />
            }
          />
          <Route
            path="/app/:chain"
            element={
              <ChainDetail
                views={views}
                markets={markets}
                currency={currency}
                fetching={fetching}
                onAdd={addAccount}
                onRemove={removeAccount}
                onRefresh={refresh}
              />
            }
          />
        </Routes>
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
                  A watch-only crypto tracker. You add a public key (XPUB) or individual addresses
                  and it shows your balance across Bitcoin and Ethereum. It can only read the
                  blockchain — it can never spend your coins.
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
                  For a Bitcoin XPUB the app derives addresses following the BIP44 “gap limit”: it
                  scans consecutive addresses until it finds 20 empty ones in a row, then stops.
                  The “active addr” count is how many addresses actually have transaction history —
                  the same number your hardware wallet shows. Ethereum balances come from a single
                  account address.
                </p>
              </details>
              <details>
                <summary>Is it private? Who sees my addresses?</summary>
                <p>
                  On-chain data comes from mempool.space (BTC) and Blockscout (ETH), and prices
                  from CoinGecko — all via a same-origin proxy. The proxy talks to those services
                  so they never see your IP directly. Your XPUB itself is never sent anywhere —
                  only individual derived addresses are queried.
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
