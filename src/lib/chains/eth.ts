import type { Account, AccountBalance, AccountKind, ChainAdapter } from './types'

// Same-origin proxy to Blockscout (dev: Vite proxy, prod: Cloudflare Function).
// GET-only REST endpoints, so they fit the existing proxy pattern and need no key.
const BASE = '/eth'

interface BlockscoutAddress {
  // Coin balance in wei, as a decimal string (can exceed Number.MAX_SAFE_INTEGER).
  coin_balance: string | null
}

interface BlockscoutCounters {
  transactions_count: string | null
}

function detect(input: string): AccountKind | null {
  const v = input.trim()
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return 'address'
  return null
}

async function fetchBalance(account: Account): Promise<AccountBalance> {
  const addr = account.value.trim()
  const [addrRes, countRes] = await Promise.all([
    fetch(`${BASE}/api/v2/addresses/${addr}`),
    fetch(`${BASE}/api/v2/addresses/${addr}/counters`),
  ])
  if (!addrRes.ok) throw new Error(`ETH API error (${addrRes.status}) for ${addr}`)
  const data = (await addrRes.json()) as BlockscoutAddress
  // Counters can 404 for never-seen addresses — treat as zero.
  let txCount = 0
  if (countRes.ok) {
    const c = (await countRes.json()) as BlockscoutCounters
    txCount = Number(c.transactions_count ?? 0)
  }
  const wei = data.coin_balance ?? '0'
  // wei → ETH via BigInt division for the whole part, Number for the fraction.
  const amount = Number(wei) / 1e18
  return {
    amount,
    txCount,
    usedCount: txCount > 0 ? 1 : 0,
    scannedCount: 1,
  }
}

export const eth: ChainAdapter = {
  id: 'eth',
  name: 'Ethereum',
  symbol: 'ETH',
  glyph: 'Ξ',
  coingeckoId: 'ethereum',
  decimals: 18,
  displayDecimals: 6,
  detect,
  fetchBalance,
}
