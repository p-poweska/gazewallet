import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DATA_FRESHNESS_MS, getDataStatus } from '../src/lib/data-status.ts'
import type { AccountView } from '../src/lib/chains/types.ts'

const now = 1_800_000_000_000
const market = { isError: false, isFetching: false, dataUpdatedAt: now - 1000 }

function view(overrides: Partial<AccountView> = {}): AccountView {
  return {
    account: { id: 'test', chain: 'btc', kind: 'address', value: 'test' },
    balance: { amount: 1, txCount: 1, usedCount: 1, scannedCount: 1 },
    isLoading: false,
    isFetching: false,
    isError: false,
    dataUpdatedAt: now - 2000,
    ...overrides,
  }
}

test('complete fresh data is current', () => {
  const status = getDataStatus([{ views: [view()], fiat: 100 }], market, true, now)
  assert.equal(status.kind, 'current')
  assert.equal(status.complete, true)
  assert.equal(status.hasValue, true)
})

test('zero is a known balance, not missing data', () => {
  const status = getDataStatus([{ views: [view({ balance: { amount: 0, txCount: 0, usedCount: 0, scannedCount: 1 } })], fiat: 0 }], market, true, now)
  assert.equal(status.hasValue, true)
  assert.equal(status.complete, true)
})

test('a missing balance makes the valuation partial', () => {
  const status = getDataStatus([{ views: [view(), view({ balance: undefined, dataUpdatedAt: 0 })], fiat: 100 }], market, true, now)
  assert.equal(status.kind, 'partial')
  assert.equal(status.complete, false)
  assert.equal(status.missingBalances, 1)
  assert.equal(status.hasValue, true)
})

test('a missing price is not a zero price', () => {
  const status = getDataStatus([{ views: [view()], fiat: null }], market, true, now)
  assert.equal(status.complete, false)
  assert.equal(status.hasValue, false)
  assert.equal(status.missingPrices, 1)
})

test('an all-missing balance group has no valuation, even with a price', () => {
  const status = getDataStatus([{ views: [view({ balance: undefined })], fiat: 0 }], market, true, now)
  assert.equal(status.hasValue, false)
})

test('offline keeps saved values and marks them offline', () => {
  const status = getDataStatus([{ views: [view()], fiat: 100 }], market, false, now)
  assert.equal(status.kind, 'offline')
  assert.equal(status.hasValue, true)
  assert.equal(status.complete, true)
})

test('offline without a cache has no saved valuation', () => {
  const status = getDataStatus([{ views: [view({ balance: undefined, dataUpdatedAt: 0 })], fiat: null }], market, false, now)
  assert.equal(status.kind, 'offline')
  assert.equal(status.hasValue, false)
  assert.equal(status.complete, false)
})

test('refetch errors do not silently make cached data current', () => {
  const status = getDataStatus([{ views: [view({ isError: true })], fiat: 100 }], market, true, now)
  assert.equal(status.kind, 'error')
  assert.equal(status.hasValue, true)
  assert.equal(status.complete, true)
})

test('price errors with cached prices still show update failure', () => {
  const status = getDataStatus([{ views: [view()], fiat: 100 }], { ...market, isError: true }, true, now)
  assert.equal(status.kind, 'error')
})

test('refreshing cached data is updating, not current', () => {
  const status = getDataStatus([{ views: [view({ isFetching: true })], fiat: 100 }], market, true, now)
  assert.equal(status.kind, 'updating')
  assert.equal(status.hasValue, true)
})

test('the oldest balance timestamp wins, regardless of array order', () => {
  const old = now - DATA_FRESHNESS_MS
  const status = getDataStatus([{ views: [view(), view({ dataUpdatedAt: old })], fiat: 100 }], market, true, now)
  assert.equal(status.kind, 'cached')
  assert.equal(status.oldestUpdatedAt, old)
})

test('an old price also makes the valuation stale', () => {
  const old = now - DATA_FRESHNESS_MS - 1
  const status = getDataStatus([{ views: [view()], fiat: 100 }], { ...market, dataUpdatedAt: old }, true, now)
  assert.equal(status.kind, 'cached')
  assert.equal(status.oldestUpdatedAt, old)
})

test('a new currency without prices cannot reuse the previous valuation', () => {
  const status = getDataStatus([{ views: [view()], fiat: null }], { isError: false, isFetching: true, dataUpdatedAt: 0 }, true, now)
  assert.equal(status.kind, 'updating')
  assert.equal(status.hasValue, false)
  assert.equal(status.complete, false)
})

test('an empty portfolio is not a missing-data warning', () => {
  const status = getDataStatus([], market, true, now)
  assert.equal(status.kind, 'empty')
  assert.equal(status.hasValue, false)
})
