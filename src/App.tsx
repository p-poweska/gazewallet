import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
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
import { useDataEnvironment } from './hooks/use-data-environment'
import { PrivacyProvider, PrivacyToggle, usePrivacy } from './components/Privacy'
import { usePortfolioHistory } from './hooks/use-portfolio-history'
import { accountIdentity } from './lib/account-overlap'
import { mergeAccounts, type BackupPayload } from './lib/backup'
import { marketUpdatedAt, remainingPriceFreshness } from './lib/market-freshness'
import { DATA_FRESHNESS_MS } from './lib/data-status'
import { EyeLogo } from './components/EyeLogo'
import { Sky } from './components/Sky'

// CoinGecko ids for every supported chain — small list, fetched in one call.
const COIN_IDS = ADAPTERS.map((a) => a.coingeckoId)

export default function App() {
  return <PrivacyProvider><AppContent /></PrivacyProvider>
}

function AppContent() {
  const [accent, setAccent] = useState<string>(() => loadAccent())
  const [currency, setCurrency] = useState<Currency>(() => loadCurrency())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts())
  const queryClient = useQueryClient()
  const dataEnvironment = useDataEnvironment()
  const privacy = usePrivacy()

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
    staleTime: (query) => remainingPriceFreshness(query.state.data, query.state.dataUpdatedAt, query.state.dataUpdatedAt),
    refetchInterval: (query) => query.state.status === 'error' ? DATA_FRESHNESS_MS :
      Math.max(15000, remainingPriceFreshness(query.state.data, query.state.dataUpdatedAt, Date.now())),
  })
  const markets = marketsQuery.data ?? {}
  const marketState = {
    isFetching: marketsQuery.isFetching,
    isError: marketsQuery.isError,
    dataUpdatedAt: marketUpdatedAt(markets, marketsQuery.dataUpdatedAt),
  }

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
          isFetching: q.isFetching,
          isError: q.isError,
          dataUpdatedAt: q.dataUpdatedAt,
        }
      }),
    [accounts, balanceQueries],
  )
  const history = usePortfolioHistory(views, markets, marketState, currency, dataEnvironment.online)
  const busy = marketsQuery.isFetching || balanceQueries.some((q) => q.isFetching)

  function addAccount(input: string, label?: string): string | null {
    try {
      const account = makeAccount(input, label)
      if (accounts.length >= 1000) return 'Maximum 1000 watched accounts'
      if (accounts.some((a) => accountIdentity(a) === accountIdentity(account))) {
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

  function renameAccount(id: string, label: string) {
    const trimmed = label.trim().slice(0, 120)
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, label: trimmed || undefined } : a)),
    )
  }

  function restoreBackup(backup: BackupPayload, mode: 'merge' | 'replace', restoreSettings: boolean) {
    const next = mode === 'merge' ? mergeAccounts(accounts, backup.accounts) : backup.accounts
    const settings = restoreSettings ? backup.settings : undefined
    try {
      saveAccounts(next)
      if (settings) { saveCurrency(settings.currency); saveAccent(settings.accent) }
    } catch {
      try { saveAccounts(accounts); saveCurrency(currency); saveAccent(accent) } catch { /* Storage may remain unavailable. */ }
      throw new Error('Could not save the backup in this browser. Check available storage and retry.')
    }
    setAccounts(next)
    if (settings) { setCurrency(settings.currency); setAccent(settings.accent); privacy.setHidden(settings.privacyHidden) }
  }

  function retryAccount(account: Account) {
    queryClient.invalidateQueries({ queryKey: ['balance', account.chain, account.value] })
  }

  return (
    <div className="page">
      <Sky dim={!dataEnvironment.online || marketsQuery.isError} />
      <main className="app">
        <header className="header">
          <Link to="/" className="brand">
            <EyeLogo closed={privacy.hidden} busy={busy} />
            <div>
              <h1>gazewallet</h1>
              <p className="subtitle">Watch-only · data stays local</p>
            </div>
          </Link>
          <div className="header-actions">
            <PrivacyToggle />
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
                accent={accent}
                history={history}
                views={views}
                markets={markets}
                currency={currency}
                marketState={marketState}
                scanning={busy}
                dataEnvironment={dataEnvironment}
                onAdd={addAccount}
                backupSettings={{ currency, accent, privacyHidden: privacy.hidden }}
                onImport={restoreBackup}
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
                marketState={marketState}
                dataEnvironment={dataEnvironment}
                onAdd={addAccount}
                onRemove={removeAccount}
                onRename={renameAccount}
                onRetry={retryAccount}
              />
            }
          />
        </Routes>
        <footer className="site-footer">
          <a className="author-credit" href="https://poweska.dev/" target="_blank" rel="noopener noreferrer" aria-label="Built by Paweł Powęska (opens in a new tab)">
            Built by Paweł Powęska
          </a>
          <a href="https://github.com/p-poweska/gazewallet/issues/new/choose" target="_blank" rel="noopener noreferrer">
            <MessageSquare size={15} aria-hidden="true" />
            Report a bug or suggest a feature
          </a>
          <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer">
            Prices powered by CoinGecko
          </a>
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
                <summary>How do recent transactions work?</summary>
                <p>Recent transactions are combined across the watched addresses and deduplicated by transaction ID. Amounts show net movements, including fees paid by watched addresses. Transfers between watched addresses are marked as internal. Bitcoin transactions with mixed inputs show only the watched net movement, not the entire transaction fee.</p>
                <p>Ethereum lists native transactions and gas fees, not ERC-20 or contract-internal transfers. This is a recent activity view, not a complete transaction archive.</p>
              </details>
              <details>
                <summary>What is the 24h price effect?</summary>
                <p>It compares the value of your current holdings at current prices with their value at prices 24 hours ago. It does not account for purchases, deposits or withdrawals during that period and is not investment return or profit.</p>
              </details>
              <details>
                <summary>How do QR scanning and backups protect my data?</summary>
                <p>QR images and camera frames are decoded locally. Camera permission is requested only when you choose Use camera, and the camera stops when the scanner closes. Payment QR codes are read only for their destination; no transaction is sent.</p>
                <p>Backups contain accounts, labels and settings, not history or API caches. You can encrypt a backup with a password using AES-256-GCM and PBKDF2-SHA256. The password never leaves your browser and cannot be recovered. Imports are validated and previewed before you choose Merge or Replace.</p>
              </details>
              <details>
                <summary>How does portfolio history work?</summary>
                <p>
                  History begins with your first complete, up-to-date valuation. At most one
                  observation is kept per five-minute interval while the app is open. Missing,
                  offline and failed updates are not recorded. Gaps are not backfilled.
                </p>
                <p>
                  Each currency and list of watched accounts has its own series, so changing
                  currency or adding/removing accounts does not rewrite past values. Renaming
                  an account does not start a new series. Changes include deposits and withdrawals;
                  they are not investment returns.
                </p>
                <p>
                  Observations are stored in IndexedDB on this device for up to 400 days and are
                  not included in account backups. Clearing browser data removes them. The trash
                  button deletes history without removing your watched accounts.
                </p>
              </details>
              <details>
                <summary>What does privacy mode hide?</summary>
                <p>
                  The eye button hides your balances, addresses, allocation and portfolio history
                  on every screen. Your choice is remembered on this device. It is a visual privacy
                  setting, not encryption or a password lock. Account backups still contain your public keys and addresses.
                </p>
              </details>
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
