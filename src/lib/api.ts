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
  if (!res.ok) throw new Error(`Błąd API (${res.status}) dla ${address}`)
  const d = (await res.json()) as MempoolAddress
  const funded = d.chain_stats.funded_txo_sum + d.mempool_stats.funded_txo_sum
  const spent = d.chain_stats.spent_txo_sum + d.mempool_stats.spent_txo_sum
  return {
    address,
    balanceSat: funded - spent,
    txCount: d.chain_stats.tx_count + d.mempool_stats.tx_count,
  }
}

export async function fetchPriceUsd(): Promise<number> {
  const res = await fetch(`${BASE}/v1/prices`)
  if (!res.ok) throw new Error(`Błąd API cen (${res.status})`)
  const d = (await res.json()) as { USD: number }
  return d.USD
}
