import { deriveAddresses, validateBtcInput } from '../derive'
import { fetchAddress, type AddressStats } from '../api'
import type { Account, AccountBalance, AccountKind, ChainAdapter } from './types'

// Gap limit (BIP44): scan consecutive addresses until this many empty in a row.
const GAP_LIMIT = 20
// Max parallel API requests — guards against 429 (burst).
const CONCURRENCY = 4

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const idx = next++
      results[idx] = await fn(items[idx])
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
  return results
}

// Scans one chain (0 = receive, 1 = change) until the gap limit is hit.
async function scanChain(xpub: string, chain: 0 | 1): Promise<AddressStats[]> {
  const collected: AddressStats[] = []
  let start = 0
  let trailingEmpty = 0
  while (trailingEmpty < GAP_LIMIT) {
    // Only fetch as many as needed to confirm the gap — minimizes requests.
    const count = GAP_LIMIT - trailingEmpty
    const addresses = deriveAddresses(xpub, { chain, start, count })
    const stats = await mapLimit(addresses, CONCURRENCY, fetchAddress)
    for (const s of stats) {
      if (s.txCount === 0) trailingEmpty++
      else trailingEmpty = 0
      collected.push(s)
    }
    start += count
  }
  return collected
}

function detect(input: string): AccountKind | null {
  return validateBtcInput(input.trim())
}

async function fetchBalance(account: Account): Promise<AccountBalance> {
  let stats: AddressStats[]
  if (account.kind === 'address') {
    stats = [await fetchAddress(account.value)]
  } else {
    // Sequential (not parallel) so we don't double the API load.
    const receive = await scanChain(account.value, 0)
    const change = await scanChain(account.value, 1)
    stats = [...receive, ...change]
  }
  const sat = stats.reduce((s, a) => s + a.balanceSat, 0)
  return {
    // Sum in integer sats first, then convert to BTC to preserve precision.
    amount: sat / 1e8,
    txCount: stats.reduce((s, a) => s + a.txCount, 0),
    usedCount: stats.filter((a) => a.txCount > 0).length,
    scannedCount: stats.length,
    trackedAddresses: stats.map((a) => a.address),
    activeAddresses: stats.filter((a) => a.txCount > 0).map((a) => a.address),
  }
}

export const btc: ChainAdapter = {
  id: 'btc',
  name: 'Bitcoin',
  symbol: 'BTC',
  glyph: '₿',
  coingeckoId: 'bitcoin',
  decimals: 8,
  displayDecimals: 8,
  detect,
  fetchBalance,
}
