// Wszystkie zapytania idą do własnego originu (/api), nie wprost do mempool.space.
// To omija CORS (przeglądarka blokuje cross-origin) i ukrywa IP użytkownika.
// Dev: proxy serwera Vite. Prod: Cloudflare Pages Function (functions/api).
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

export interface BtcMarket {
  price: number
  change24h: number | null
  change7d: number | null
  change30d: number | null
  high24h: number | null
  low24h: number | null
}

interface CoinGeckoMarket {
  current_price: number
  high_24h: number | null
  low_24h: number | null
  price_change_percentage_24h_in_currency: number | null
  price_change_percentage_7d_in_currency: number | null
  price_change_percentage_30d_in_currency: number | null
}

// Cena + statystyki zmian z CoinGecko, w wybranej walucie.
export async function fetchMarket(currency: string): Promise<BtcMarket> {
  const vs = currency.toLowerCase()
  const url = `/cg/api/v3/coins/markets?vs_currency=${vs}&ids=bitcoin&price_change_percentage=24h%2C7d%2C30d`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Price API error (${res.status})`)
  const arr = (await res.json()) as CoinGeckoMarket[]
  const d = arr[0]
  if (!d) throw new Error('No market data')
  return {
    price: d.current_price,
    change24h: d.price_change_percentage_24h_in_currency,
    change7d: d.price_change_percentage_7d_in_currency,
    change30d: d.price_change_percentage_30d_in_currency,
    high24h: d.high_24h,
    low24h: d.low_24h,
  }
}
