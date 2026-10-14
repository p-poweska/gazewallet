import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compositionKey, createSnapshot, historyChange, historyChartData, HISTORY_INTERVAL_MS, selectHistory } from '../src/lib/history.ts'
import type { Account } from '../src/lib/chains/types.ts'
import type { DataStatusResult } from '../src/lib/data-status.ts'

const now = 1_800_000_000_000
const accounts: Account[] = [{ id: 'btc', chain: 'btc', kind: 'address', value: 'btc-test' }, { id: 'eth', chain: 'eth', kind: 'address', value: '0xabc' }]
const status: DataStatusResult = { kind: 'current', complete: true, hasValue: true, missingBalances: 0, missingPrices: 0, oldestUpdatedAt: now - 1000, label: 'Up to date', message: '' }
const input = { accounts, assets: [{ chain: 'btc' as const, amount: 1, fiat: 60000 }, { chain: 'eth' as const, amount: 2, fiat: 4000 }], currency: 'USD', status, sourceTimes: [now - 1000, now - 500, now - 200], now }
const point = createSnapshot(input)!

test('complete observations record total and assets without raw addresses', () => {
  assert.equal(point.total, 64000)
  assert.equal(point.assets.length, 2)
  assert.equal(JSON.stringify(point).includes('btc-test'), false)
  assert.equal(JSON.stringify(point).includes('0xabc'), false)
})

test('composition ignores labels, account IDs, order and ETH casing', () => {
  const renamed = [...accounts].reverse().map((a) => ({ ...a, id: 'new', label: 'new label', value: a.chain === 'eth' ? '0xABC' : a.value }))
  assert.equal(compositionKey(accounts), compositionKey(renamed))
  assert.notEqual(compositionKey(accounts), compositionKey(accounts.slice(0, 1)))
  assert.notEqual(compositionKey(accounts), compositionKey([...accounts, { ...accounts[0], value: 'other' }]))
})

test('snapshot time comes from source updates, so reloads do not invent new observations', () => {
  const reloaded = createSnapshot({ ...input, now: now + 10000 })!
  assert.equal(point.timestamp, now - 200)
  assert.equal(reloaded.id, point.id)
  assert.equal(reloaded.sourceKey, point.sourceKey)
})

test('snapshots in one five-minute bucket replace the same key', () => {
  const time = Math.floor(now / HISTORY_INTERVAL_MS) * HISTORY_INTERVAL_MS + 1000
  const first = createSnapshot({ ...input, now: time + 2000, sourceTimes: [time] })!
  const second = createSnapshot({ ...input, now: time + 2000, sourceTimes: [time + 1000] })!
  const next = createSnapshot({ ...input, now: time + HISTORY_INTERVAL_MS, sourceTimes: [time + HISTORY_INTERVAL_MS] })!
  assert.equal(first.id, second.id)
  assert.notEqual(first.id, next.id)
})

test('offline, errors, cached, pending and incomplete values are never recorded', () => {
  for (const kind of ['offline', 'error', 'cached', 'updating', 'partial', 'empty'] as const) {
    assert.equal(createSnapshot({ ...input, status: { ...status, kind } }), null)
  }
  assert.equal(createSnapshot({ ...input, status: { ...status, complete: false } }), null)
  assert.equal(createSnapshot({ ...input, status: { ...status, hasValue: false } }), null)
  assert.equal(createSnapshot({ ...input, accounts: [] }), null)
})

test('invalid, negative and non-finite values and timestamps are rejected', () => {
  for (const fiat of [NaN, Infinity, -1]) {
    assert.equal(createSnapshot({ ...input, assets: [{ chain: 'btc', amount: 1, fiat }] }), null)
  }
  assert.equal(createSnapshot({ ...input, assets: [{ chain: 'btc', amount: -1, fiat: 1 }] }), null)
  assert.equal(createSnapshot({ ...input, sourceTimes: [now + 1] }), null)
  assert.equal(createSnapshot({ ...input, sourceTimes: [0] }), null)
})

test('a complete zero valuation is a valid observation', () => {
  const zero = createSnapshot({ ...input, assets: [{ chain: 'btc', amount: 0, fiat: 0 }] })!
  assert.equal(zero.total, 0)
})

test('history selection never mixes currencies or account compositions', () => {
  const foreign = { ...point, id: 'foreign', currency: 'PLN' }
  const otherAccounts = { ...point, id: 'other', compositionKey: 'other-key' }
  const future = { ...point, id: 'future', timestamp: now + 1000 }
  const old = { ...point, id: 'old', timestamp: now - 8 * 86400000 }
  const points = [foreign, otherAccounts, old, future, point]
  assert.deepEqual(selectHistory(points, point.compositionKey, 'USD', '7d', now), [point])
  assert.deepEqual(selectHistory(points, point.compositionKey, 'USD', '30d', now), [old, point])
})

test('recorded change handles empty, one-point and zero-start histories', () => {
  assert.equal(historyChange([]), null)
  assert.equal(historyChange([point]), null)
  assert.deepEqual(historyChange([{ ...point, total: 100 }, { ...point, total: 120 }]), { delta: 20, percent: 20 })
  assert.deepEqual(historyChange([{ ...point, total: 0 }, { ...point, total: 120 }]), { delta: 120, percent: null })
})

test('chart data inserts a gap rather than inventing a continuous line', () => {
  const next = { ...point, timestamp: point.timestamp + 60 * 60000, total: 65000 }
  const [times, values] = historyChartData([point, next])
  assert.equal(times.length, 3)
  assert.deepEqual(values, [64000, null, 65000])
  assert.equal(historyChartData([point, { ...next, timestamp: point.timestamp + 5 * 60000 }])[0].length, 2)
})
