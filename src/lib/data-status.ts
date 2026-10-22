import type { AccountView } from './chains/types'

export const DATA_FRESHNESS_MS = 5 * 60 * 1000

export interface MarketQueryState {
  isFetching: boolean
  isError: boolean
  dataUpdatedAt: number
}

interface DataGroup {
  views: AccountView[]
  fiat: number | null
}

export type DataStatusKind = 'empty' | 'current' | 'updating' | 'cached' | 'offline' | 'error' | 'partial'

export interface DataStatusResult {
  kind: DataStatusKind
  complete: boolean
  hasValue: boolean
  missingBalances: number
  missingPrices: number
  oldestUpdatedAt: number
  label: string
  message: string
}

export function getDataStatus(
  groups: DataGroup[],
  market: MarketQueryState,
  online: boolean,
  now: number,
): DataStatusResult {
  const views = groups.flatMap((g) => g.views)
  const missingBalances = views.filter((v) => !v.balance).length
  const missingPrices = groups.filter((g) => g.fiat === null).length
  const complete = missingBalances === 0 && missingPrices === 0
  const hasValue = groups.some((g) => g.fiat !== null && g.views.some((v) => v.balance))
  // Use the oldest contributing source, not the most recently updated account.
  const timestamps = views.filter((v) => v.balance).map((v) => v.dataUpdatedAt)
  if (groups.some((g) => g.fiat !== null)) timestamps.push(market.dataUpdatedAt)
  const oldestUpdatedAt = timestamps.length ? Math.min(...timestamps) : 0
  const failed = views.some((v) => v.isError) || market.isError
  const fetching = views.some((v) => v.isFetching) || market.isFetching
  const stale = oldestUpdatedAt === 0 || now - oldestUpdatedAt >= DATA_FRESHNESS_MS

  let kind: DataStatusKind
  let label: string
  let message: string
  if (views.length === 0) {
    kind = 'empty'
    label = 'No accounts'
    message = ''
  } else if (!online) {
    kind = 'offline'
    label = 'Offline'
    message = hasValue ? 'Showing saved data. Updates resume when connected.' : 'No saved valuation available.'
  } else if (failed) {
    kind = 'error'
    label = 'Update failed'
    message = hasValue ? 'Showing last known values. Updates retry automatically.' : 'Could not load portfolio data. Updates retry automatically.'
  } else if (fetching) {
    kind = 'updating'
    label = 'Updating'
    message = hasValue ? 'Showing last known values while updating.' : 'Loading balances and prices.'
  } else if (!complete) {
    kind = 'partial'
    label = 'Incomplete data'
    message = 'Some balances or prices are unavailable.'
  } else if (stale) {
    kind = 'cached'
    label = 'Saved data'
    message = 'Values are older than 5 minutes. Updates resume automatically.'
  } else {
    kind = 'current'
    label = 'Up to date'
    message = ''
  }

  return { kind, complete, hasValue, missingBalances, missingPrices, oldestUpdatedAt, label, message }
}
