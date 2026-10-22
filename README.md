# gazewallet

A minimalist, open-source, watch-only Bitcoin and Ethereum portfolio tracker.
No account required. Portfolio data is stored in your browser.

**Public beta** | [Open app](https://gazewallet.pages.dev) | [Report a bug or suggest a feature](https://github.com/p-poweska/gazewallet/issues/new/choose)

## Features

- Track Bitcoin using an account-level xpub, ypub or zpub, or individual mainnet addresses; track native ETH using Ethereum mainnet addresses.
- See a combined portfolio, asset allocation and per-asset details in USD, EUR, PLN and other supported currencies.
- View percentage and fiat 24-hour price effects at current holdings. These are not investment returns.
- Browse recent transactions with confirmation status and explorer links. Bitcoin transactions are deduplicated across watched addresses.
- Add labels, scan a QR code using a camera or local image, and receive warnings about potentially overlapping accounts.
- Hide balances, addresses, allocation and history with privacy mode.
- Keep local portfolio value history with 7-day, 30-day and 1-year views.
- Export accounts, labels and settings, optionally password-encrypted; preview imports and choose merge or replace.
- Customize the accent color and install the app as a PWA. Cached data remains available offline after an initial online load.

## Privacy and limitations

This app cannot sign transactions or spend funds. Never enter a seed phrase or private key.

- XPUB derivation and QR decoding happen in the browser. XPUBs are not sent to the API providers, but individual watched or derived addresses are queried through Cloudflare Pages Functions.
- Cloudflare handles client requests and can see the client IP and requested addresses. Upstream blockchain providers see the queried addresses and the proxy IP; they may log or correlate requests. This is not anonymous blockchain access.
- Accounts, settings and cached results use localStorage; portfolio history uses IndexedDB. Browser storage can be cleared or evicted. Privacy mode only masks the interface and does not encrypt stored data.
- Storage is specific to the browser and origin. Export before moving between a `pages.dev` URL and a custom domain, then import on the new domain.
- Optional backup encryption uses AES-256-GCM with PBKDF2-SHA256 (600,000 iterations). A forgotten password cannot be recovered. Backups do not include portfolio history or API caches.
- History records complete, fresh observations while the app is open, at most once per five-minute interval, for up to 400 days. It does not fetch past portfolio values. Currency or account-list changes start a separate series. Deposits and withdrawals affect observed value.
- BTC discovery checks receive and change branches with a 20-unused-address gap limit. Nonstandard derivation paths and funds beyond the gap can be missed. Overlap warnings do not automatically correct double-counted balances.
- ETH activity covers native transactions and gas, not ERC-20 tokens or contract-internal transfers. Recent activity is not a complete transaction archive.
- APIs may return delayed data, rate limits or errors. Balances and prices normally refresh every five minutes while the app is active; offline values are cached observations, not live balances.

## Run locally

Use Node.js 22 LTS and npm.

```sh
git clone https://github.com/p-poweska/gazewallet.git
cd gazewallet
npm ci
```

Set `CG_DEMO_KEY` in the process environment, then start Vite. For example, in bash or zsh, this prompts without putting the key itself in shell history:

```sh
printf 'CoinGecko Demo API key: '
read -rs CG_DEMO_KEY
printf '\n'
export CG_DEMO_KEY
npm run dev
```

Open the local URL printed by Vite. Its dev proxy forwards blockchain and pricing requests. The current config reads the key from the process environment, not automatically from a `.env` file. Never prefix the secret with `VITE_` or commit it.

```sh
npm test           # Unit tests
npm run typecheck  # TypeScript checks
npm run build      # Production SPA + PWA files in dist/
npm run preview    # Static build preview only
```

`vite preview` does not run the Pages Functions or the development API proxy. To test production API routes locally, use Wrangler Pages dev from the repository root after building:

```sh
npx wrangler pages dev dist
```

For that command, supply `CG_DEMO_KEY` in a local `.dev.vars` file (ignored by Git). Use the Cloudflare emulator or a Pages deployment to verify production behavior, including headers and API routes.

## Deploy to Cloudflare Pages

1. Connect this repository to a **Pages** project, not a Workers project.
2. Choose the branch to deploy. `develop` contains ongoing work; `main` is the stable line.
3. Set the build command to `npm run build` and output directory to `dist`, with the repository root as the project root. Use Node.js 22.
4. Add a secret named `CG_DEMO_KEY` in the Pages project's environment settings for Production and Preview as needed.
5. Create a new deployment after changing secrets. Existing deployments do not pick them up retroactively.

Pages deploys `functions/` alongside the static build. No database is required. Keep `public/_headers`, `public/_redirects` and `wrangler.toml` in the project. Camera access and service workers require a secure context (HTTPS or localhost).

The app shell is precached by the service worker. API results use the persisted query cache; successful proxy responses have a short HTTP cache lifetime, and non-200 responses use `no-store`. A response's `Cache-Control` header alone does not guarantee shared caching at Cloudflare's edge.

## Architecture and data sources

React + TypeScript + Vite, React Router, TanStack Query, uPlot, ZXing and vite-plugin-pwa.

| Location | Responsibility |
| --- | --- |
| `src/lib/chains/` | Chain adapters, address validation and balances |
| `src/lib/derive.ts` | Local Bitcoin address derivation |
| `src/lib/transactions.ts` | Transaction normalization and deduplication |
| `src/lib/backup.ts` | Backup validation, merging and encryption |
| `src/pages/` | Landing, portfolio dashboard and asset details |
| `src/components/` | Shared UI, history, activity, QR and backups |
| `functions/` | Same-origin API proxies for Cloudflare Pages |
| `tests/` | Account, valuation, history, backup and transaction tests |

| Route | Provider | Purpose |
| --- | --- | --- |
| `/api/*` | [mempool.space](https://mempool.space/docs/api/rest) | Bitcoin balances and activity |
| `/eth/*` | [Blockscout](https://eth.blockscout.com/api-docs) | Ethereum balances and activity |
| `/cg/*` | [CoinGecko API](https://www.coingecko.com/en/api) | Prices and market changes |

Prices powered by CoinGecko. Provider quotas and licensing terms apply independently of this repository's license; check the applicable plan before publishing or commercializing a deployment.

## Feedback and contributions

[Report a bug](https://github.com/p-poweska/gazewallet/issues/new?template=bug_report.md) or [suggest a feature](https://github.com/p-poweska/gazewallet/issues/new?template=feature_request.md).
Include reproduction steps, browser/device details and redacted screenshots when useful. GitHub Issues are public: never post XPUBs, seed phrases, private keys, API keys, backups or unredacted wallet data.

For contributions, branch from `develop`, keep changes focused, and run `npm test` and `npm run build` before opening a pull request against `develop`.

## License

[MIT](LICENSE).
