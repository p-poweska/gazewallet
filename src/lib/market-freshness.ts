import type { Markets } from './api'
import { DATA_FRESHNESS_MS } from './data-status'

export function marketUpdatedAt(markets: Markets | undefined, receivedAt: number): number {
  const times = Object.values(markets ?? {}).map((market) => {
    const time = market.fetchedAt
    // Existing persisted prices have no proxy timestamp yet.
    return typeof time === 'number' && Number.isFinite(time) && time > 0 ? Math.min(time, receivedAt) : receivedAt
  })
  return times.length ? Math.min(...times) : receivedAt
}

export function remainingPriceFreshness(markets: Markets | undefined, receivedAt: number, now: number): number {
  return Math.max(0, Math.min(DATA_FRESHNESS_MS, marketUpdatedAt(markets, receivedAt) + DATA_FRESHNESS_MS - now))
}
