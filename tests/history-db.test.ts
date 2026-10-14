import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearHistory, loadHistory, saveSnapshot } from '../src/lib/history-db.ts'
import { HISTORY_INTERVAL_MS, HISTORY_RETENTION_MS, type PortfolioSnapshot } from '../src/lib/history.ts'

test('IndexedDB history transactions', async (t) => {
  const now = Date.now() + 5000
  const point: PortfolioSnapshot = { id: 'composition:USD:1', compositionKey: 'composition', currency: 'USD', timestamp: now, sourceKey: 'source-1', total: 100, assets: [{ chain: 'btc', amount: 1, fiat: 100 }] }
  await clearHistory()

  await t.test('duplicate effects, tabs and reloads produce only one observation', async () => {
    await Promise.all([saveSnapshot(point), saveSnapshot(point), saveSnapshot(point)])
    assert.equal((await loadHistory('composition', 'USD')).length, 1)
  })

  await t.test('a fresher observation in the same bucket replaces, not appends', async () => {
    await saveSnapshot({ ...point, timestamp: now + 1000, sourceKey: 'source-2', total: 120 })
    const values = await loadHistory('composition', 'USD')
    assert.equal(values.length, 1)
    assert.equal(values[0].total, 120)
  })

  await t.test('a late response from another tab cannot overwrite newer history', async () => {
    await saveSnapshot({ ...point, sourceKey: 'late-source', total: 90 })
    assert.equal((await loadHistory('composition', 'USD'))[0].total, 120)
  })

  await t.test('the next source interval adds a new observation in time order', async () => {
    await saveSnapshot({ ...point, id: 'composition:USD:2', timestamp: now + HISTORY_INTERVAL_MS, sourceKey: 'source-3', total: 130 })
    assert.deepEqual((await loadHistory('composition', 'USD')).map((p) => p.total), [120, 130])
  })

  await t.test('unchanged source data cannot create a new observation', async () => {
    await saveSnapshot({ ...point, id: 'composition:USD:3', timestamp: now + 2 * HISTORY_INTERVAL_MS, sourceKey: 'source-3', total: 130 })
    assert.equal((await loadHistory('composition', 'USD')).length, 2)
  })

  await t.test('currencies and account compositions remain separate', async () => {
    await saveSnapshot({ ...point, id: 'composition:PLN:1', currency: 'PLN', total: 400 })
    await saveSnapshot({ ...point, id: 'other:USD:1', compositionKey: 'other', total: 800 })
    assert.equal((await loadHistory('composition', 'PLN'))[0].total, 400)
    assert.equal((await loadHistory('other', 'USD'))[0].total, 800)
    assert.equal((await loadHistory('composition', 'USD')).length, 2)
  })

  await t.test('expired observations are not returned', async () => {
    await saveSnapshot({ ...point, id: 'expired:USD:1', compositionKey: 'expired', timestamp: now - HISTORY_RETENTION_MS - 86400000 })
    assert.equal((await loadHistory('expired', 'USD')).length, 0)
  })

  await t.test('clear deletes every currency and composition', async () => {
    await clearHistory()
    for (const [key, currency] of [['composition', 'USD'], ['composition', 'PLN'], ['other', 'USD']]) {
      assert.deepEqual(await loadHistory(key, currency), [])
    }
  })

  await t.test('cached observations from before deletion cannot reappear after reload', async () => {
    await saveSnapshot({ ...point, timestamp: Date.now() - 1000, sourceKey: 'old-cache' })
    assert.deepEqual(await loadHistory('composition', 'USD'), [])
  })
})
