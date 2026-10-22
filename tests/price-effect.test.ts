import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupByChain, portfolioPriceEffect24h } from '../src/lib/portfolio.ts'
import type { AccountView } from '../src/lib/chains/types.ts'
import type { Markets } from '../src/lib/api.ts'

const views: AccountView[] = ['btc', 'eth'].map((chain) => ({ account: { id: chain, chain: chain as 'btc' | 'eth', kind: 'address', value: chain }, balance: { amount: 1, txCount: 1, scannedCount: 1, usedCount: 1 }, isError: false, isLoading: false, isFetching: false, dataUpdatedAt: 1 }))
const markets: Markets = { bitcoin: { price: 120, change24h: 20, change7d: null, change30d: null, high24h: null, low24h: null }, ethereum: { price: 90, change24h: -10, change7d: null, change30d: null, high24h: null, low24h: null } }

test('price effect reconstructs prices at current holdings rather than averaging percentages', () => {
  const effect = portfolioPriceEffect24h(groupByChain(views, markets), markets)!
  assert.ok(Math.abs(effect.delta - 10) < 1e-10)
  assert.ok(Math.abs(effect.percent - 5) < 1e-10)
})

test('missing balances, prices and changes do not yield a misleading partial price effect', () => {
  assert.equal(portfolioPriceEffect24h(groupByChain([{ ...views[0], balance: undefined }], markets), markets), null)
  const noPrice = { bitcoin: markets.bitcoin }
  assert.equal(portfolioPriceEffect24h(groupByChain(views, noPrice), noPrice), null)
  const noChange = { ...markets, ethereum: { ...markets.ethereum, change24h: null } }
  assert.equal(portfolioPriceEffect24h(groupByChain(views, noChange), noChange), null)
})

test('invalid changes and zero starting valuation have no percentage', () => {
  const invalid = { bitcoin: { ...markets.bitcoin, change24h: -100 } }
  assert.equal(portfolioPriceEffect24h(groupByChain([views[0]], invalid), invalid), null)
  const zero = [{ ...views[0], balance: { ...views[0].balance!, amount: 0 } }]
  assert.equal(portfolioPriceEffect24h(groupByChain(zero, markets), markets), null)
})
