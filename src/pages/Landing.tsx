import { Link } from 'react-router-dom'
import type { Markets } from '../lib/api'
import type { Currency } from '../lib/currency'
import { formatFiat } from '../lib/format'
import { Change } from '../components/Change'
import { FiatAmount } from '../components/FiatAmount'

const GITHUB_URL = 'https://github.com/p-poweska/gazewallet'

interface Props {
  currency: Currency
  markets: Markets
}

const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Track by XPUB or address',
    body: 'Paste an extended public key (xpub/ypub/zpub) or individual addresses. gazewallet derives and watches them for you.',
  },
  {
    title: 'Live fiat value',
    body: 'See your balance in USD, EUR, PLN and a dozen other currencies, with 24h / 7d / 30d price changes.',
  },
  {
    title: 'Private by design',
    body: 'Your keys never leave the browser. No accounts, no sign-up, no server storing your data.',
  },
  {
    title: 'Works offline',
    body: 'Installable as a PWA. Balances are cached, so it opens instantly and survives reloads.',
  },
]

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '1',
    title: 'Add a key or address',
    body: 'Give it a watch-only public key or single addresses — never a seed phrase or private key.',
  },
  {
    n: '2',
    title: 'Addresses derived locally',
    body: 'In your browser it derives addresses (BIP44/49/84) and follows the standard gap limit.',
  },
  {
    n: '3',
    title: 'Balances fetched & cached',
    body: 'On-chain data is read through a proxy to mempool.space, prices from CoinGecko, then cached.',
  },
]

const SAFETY: string[] = [
  'Watch-only — it can read your balance but can never move your coins.',
  'Your XPUB never leaves the browser; only individual derived addresses are queried.',
  'No accounts and no backend database — data lives in your browser, exportable anytime.',
  'Open source, so anyone can audit exactly what it does.',
]

export default function Landing({ currency, markets }: Props) {
  const market = markets['bitcoin']
  return (
    <div className="landing">
      <section className="lp-hero">
        <span className="pill">Open source · Watch-only</span>
        <h1 className="lp-title">
          Track your <span className="accent-text">Bitcoin</span>, keep your keys.
        </h1>
        <p className="lp-sub">
          A minimalist, private portfolio tracker. Add a public key or addresses and watch your
          balance — nothing can be spent, nothing is stored on a server.
        </p>

        <div className="lp-price card">
          <div className="lp-price-head">
            <span className="lp-price-label">BTC price</span>
            {market && (
              <div className="stats">
                <Change label="24h" value={market.change24h} />
                <Change label="7d" value={market.change7d} />
                <Change label="30d" value={market.change30d} />
              </div>
            )}
          </div>
          <div className="lp-price-value">
            {market ? <FiatAmount value={market.price} currency={currency} /> : '—'}
          </div>
          {market && (market.low24h !== null || market.high24h !== null) && (
            <div className="lp-range">
              24h range {formatFiat(market.low24h ?? 0, currency)} –{' '}
              {formatFiat(market.high24h ?? 0, currency)}
            </div>
          )}
        </div>

        <div className="lp-cta">
          <Link to="/app" className="primary btn-link">
            Open wallet
          </Link>
          <a className="ghost btn-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            View on GitHub
          </a>
        </div>
      </section>

      <section className="lp-section">
        <h2>What you can do</h2>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="card lp-feature">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>How it works</h2>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="card lp-step">
              <span className="lp-step-n">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>Is it safe?</h2>
        <ul className="lp-safety card">
          {SAFETY.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="lp-section lp-os card">
        <div>
          <h2>Open source</h2>
          <p>
            gazewallet is free and open source. Bitcoin today; Ethereum and other chains are
            planned. Contributions and audits welcome.
          </p>
        </div>
        <a className="ghost btn-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </section>

      <div className="lp-cta lp-cta-bottom">
        <Link to="/app" className="primary btn-link">
          Open wallet
        </Link>
      </div>
    </div>
  )
}
