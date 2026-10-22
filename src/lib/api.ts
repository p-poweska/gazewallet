// Wszystkie zapytania idą do własnego originu (/api), nie wprost do mempool.space.
// To omija CORS (przeglądarka blokuje cross-origin) i ukrywa IP użytkownika.
// Dev: proxy serwera Vite. Prod: Cloudflare Pages Function (functions/api).
import { parseMarketRows, PRICE_FETCHED_AT_HEADER } from './market-data'

const BASE = '/api'

export interface AddressStats {
  address: string
  /** Saldo w satoshi (otrzymane - wydane), łącznie z mempoolem. */
  balanceSat: number
  txCount: number
}

interface MempoolAddress {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number }
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number }
}

export async function fetchAddress(address: string): Promise<AddressStats> {
  const res = await fetch(`${BASE}/address/${address}`)
  if (!res.ok) throw new Error(`API error (${res.status}) for ${address}`)
  const d = (await res.json()) as MempoolAddress
  const funded = d.chain_stats.funded_txo_sum + d.mempool_stats.funded_txo_sum
  const spent = d.chain_stats.spent_txo_sum + d.mempool_stats.spent_txo_sum
  return {
    address,
    balanceSat: funded - spent,
    txCount: d.chain_stats.tx_count + d.mempool_stats.tx_count,
  }
}

export interface Market {
  /** Original proxy fetch time, preserved on cache hits and browser reloads. */
  fetchedAt?: number
  price: number
  change24h: number | null
  change7d: number | null
  change30d: number | null
  high24h: number | null
  low24h: number | null
}

/** Keyed by CoinGecko id (e.g. 'bitcoin', 'ethereum'). */
export type Markets = Record<string, Market>

// Prices + change stats from CoinGecko, in the chosen currency, for many coins.
export async function fetchMarkets(currency: string, ids: string[]): Promise<Markets> {
  const vs = currency.toLowerCase()
  const idsParam = encodeURIComponent(ids.join(','))
  const url = `/cg/api/v3/coins/markets?vs_currency=${vs}&ids=${idsParam}&price_change_percentage=24h%2C7d%2C30d`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Price API error (${res.status})`)
  const arr = parseMarketRows(await res.json(), ids)
  const now = Date.now()
  const header = res.headers.get(PRICE_FETCHED_AT_HEADER)
  // Vite talks directly to CoinGecko, which does not send our proxy header.
  const fetchedAt = header === null ? now : Number(header)
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0 || fetchedAt > now + 60000) throw new Error('Invalid price timestamp')
  const out: Markets = {}
  for (const d of arr) {
    out[d.id] = {
      fetchedAt: Math.min(fetchedAt, now),
      price: d.current_price,
      change24h: d.price_change_percentage_24h_in_currency,
      change7d: d.price_change_percentage_7d_in_currency,
      change30d: d.price_change_percentage_30d_in_currency,
      high24h: d.high_24h,
      low24h: d.low_24h,
    }
  }
  return out
}
