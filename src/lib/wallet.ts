import { deriveAddresses } from './derive'
import { fetchAddress, type AddressStats } from './api'
import type { WatchEntry } from './store'

// Gap limit (BIP44): skanuj kolejne adresy aż napotkasz tyle pustych z rzędu.
const GAP_LIMIT = 20
// Maksymalna liczba równoległych żądań do API — chroni przed 429 (burst).
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

// Skanuje jeden łańcuch (0 = odbiorcze, 1 = change) aż do gap limitu.
async function scanChain(xpub: string, chain: 0 | 1): Promise<AddressStats[]> {
  const collected: AddressStats[] = []
  let start = 0
  let trailingEmpty = 0
  while (trailingEmpty < GAP_LIMIT) {
    // Dobierz tylko tyle, ile brakuje do potwierdzenia luki — minimalizuje żądania.
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

export interface WalletBalance {
  balanceSat: number
  txCount: number
  /** Adresy z historią transakcji — to liczba, którą pokazuje też Trezor. */
  usedCount: number
  scannedCount: number
}

export async function fetchWalletBalance(entry: WatchEntry): Promise<WalletBalance> {
  let stats: AddressStats[]
  if (entry.kind === 'address') {
    stats = [await fetchAddress(entry.value)]
  } else {
    // Sekwencyjnie (a nie równolegle) by nie podwajać obciążenia API.
    const receive = await scanChain(entry.value, 0)
    const change = await scanChain(entry.value, 1)
    stats = [...receive, ...change]
  }
  return {
    balanceSat: stats.reduce((s, a) => s + a.balanceSat, 0),
    txCount: stats.reduce((s, a) => s + a.txCount, 0),
    usedCount: stats.filter((a) => a.txCount > 0).length,
    scannedCount: stats.length,
  }
}

export function formatBtc(sat: number): string {
  return (sat / 1e8).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })
}

export function formatFiat(value: number, currency: string): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value < 10 ? 4 : 2,
  })
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
