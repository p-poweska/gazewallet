import { deriveAddresses } from './derive'
import { fetchAddress } from './api'
import type { WatchEntry } from './store'

// Ile adresów na łańcuch derywujemy dla xpub.
// TODO: pełny gap-limit (skanuj aż 20 kolejnych pustych adresów) zamiast stałego okna.
const WINDOW = 20

export function resolveAddresses(entry: WatchEntry): string[] {
  if (entry.kind === 'address') return [entry.value]
  const receive = deriveAddresses(entry.value, { chain: 0, count: WINDOW })
  const change = deriveAddresses(entry.value, { chain: 1, count: WINDOW })
  return [...receive, ...change]
}

export interface WalletBalance {
  balanceSat: number
  txCount: number
  addressCount: number
}

export async function fetchWalletBalance(entry: WatchEntry): Promise<WalletBalance> {
  const addresses = resolveAddresses(entry)
  const stats = await Promise.all(addresses.map(fetchAddress))
  return {
    balanceSat: stats.reduce((s, a) => s + a.balanceSat, 0),
    txCount: stats.reduce((s, a) => s + a.txCount, 0),
    addressCount: addresses.length,
  }
}

export function formatBtc(sat: number): string {
  return (sat / 1e8).toLocaleString('pl-PL', { minimumFractionDigits: 8, maximumFractionDigits: 8 })
}

export function formatUsd(value: number): string {
  return value.toLocaleString('pl-PL', { style: 'currency', currency: 'USD' })
}
