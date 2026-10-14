import { sha256 } from '@noble/hashes/sha256'
import type { Account, ChainId } from './chains/types'
import type { DataStatusResult } from './data-status'

export const HISTORY_INTERVAL_MS = 5 * 60 * 1000
export const HISTORY_RETENTION_MS = 400 * 24 * 60 * 60 * 1000
export const HISTORY_RANGES = { '7d': 7, '30d': 30, '1y': 365 } as const
export type HistoryRange = keyof typeof HISTORY_RANGES

export interface HistoryAsset {
  chain: ChainId
  amount: number
  fiat: number
}

export interface PortfolioSnapshot {
  id: string
  compositionKey: string
  currency: string
  timestamp: number
  sourceKey: string
  total: number
  assets: HistoryAsset[]
}

// Labels and order do not affect a series. Raw addresses/XPUBs are not copied to history.
export function compositionKey(accounts: Account[]): string {
  const identities = accounts.map((a) => [a.chain, a.kind, a.chain === 'eth' ? a.value.toLowerCase() : a.value]).sort()
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(identities))), (n) => n.toString(16).padStart(2, '0')).join('')
}

export function createSnapshot(input: {
  accounts: Account[]
  assets: HistoryAsset[]
  currency: string
  status: DataStatusResult
  sourceTimes: number[]
  now: number
}): PortfolioSnapshot | null {
  const { accounts, assets, currency, status, sourceTimes, now } = input
  if (status.kind !== 'current' || !status.complete || !status.hasValue || accounts.length === 0 || assets.length === 0) return null
  if (assets.some((a) => !Number.isFinite(a.amount) || a.amount < 0 || !Number.isFinite(a.fiat) || a.fiat < 0)) return null
  if (!sourceTimes.length || sourceTimes.some((t) => !Number.isFinite(t) || t <= 0 || t > now)) return null
  const timestamp = Math.max(...sourceTimes)
  const key = compositionKey(accounts)
  const total = assets.reduce((sum, a) => sum + a.fiat, 0)
  if (!Number.isFinite(total)) return null
  return {
    id: `${key}:${currency}:${Math.floor(timestamp / HISTORY_INTERVAL_MS)}`,
    compositionKey: key,
    currency,
    timestamp,
    sourceKey: JSON.stringify([...sourceTimes].sort((a, b) => a - b)),
    total,
    assets,
  }
}

export function selectHistory(samples: PortfolioSnapshot[], key: string, currency: string, range: HistoryRange, now: number) {
  const start = now - HISTORY_RANGES[range] * 24 * 60 * 60 * 1000
  return samples.filter((s) => s.compositionKey === key && s.currency === currency && s.timestamp >= start && s.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp)
}

export function historyChange(samples: PortfolioSnapshot[]) {
  if (samples.length < 2) return null
  const first = samples[0].total
  const delta = samples[samples.length - 1].total - first
  return { delta, percent: first > 0 ? delta / first * 100 : null }
}

export function historyChartData(samples: PortfolioSnapshot[]): [number[], (number | null)[]] {
  const times: number[] = []
  const values: (number | null)[] = []
  samples.forEach((sample, i) => {
    const previous = samples[i - 1]
    // Do not draw a continuous line across periods without observations.
    if (previous && sample.timestamp - previous.timestamp > 30 * 60 * 1000) {
      times.push((previous.timestamp + sample.timestamp) / 2000)
      values.push(null)
    }
    times.push(sample.timestamp / 1000)
    values.push(sample.total)
  })
  return [times, values]
}
