import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { onRequestGet } from '../functions/cg/[[path]].ts'
import { fetchMarkets, type Markets } from '../src/lib/api.ts'
import { PRICE_CACHE_SECONDS, PRICE_FETCHED_AT_HEADER } from '../src/lib/market-data.ts'
import { marketUpdatedAt, remainingPriceFreshness } from '../src/lib/market-freshness.ts'
import { getDataStatus } from '../src/lib/data-status.ts'
import { createSnapshot } from '../src/lib/history.ts'

const START = 1_800_000_000_000
const query = 'vs_currency=usd&ids=bitcoin%2Cethereum&price_change_percentage=24h%2C7d%2C30d'
const rows = ['bitcoin', 'ethereum'].map((id, i) => ({
  id, current_price: i ? 2000 : 60000, high_24h: null, low_24h: null,
  price_change_percentage_24h_in_currency: 2,
  price_change_percentage_7d_in_currency: null,
  price_change_percentage_30d_in_currency: 3,
}))

function harness(t: TestContext) {
  let now = START
  let calls = 0
  let next: () => Response | Promise<Response> = () => Response.json(rows)
  const entries = new Map<string, Response>()
  const writes: Request[] = []
  const pending: Promise<unknown>[] = []
  const upstream: { url: URL; init?: RequestInit }[] = []
  const original = Object.getOwnPropertyDescriptor(globalThis, 'caches')
  const cache = {
    match: async (request: Request) => entries.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => { writes.push(request); entries.set(request.url, response.clone()) },
  }
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: cache } })
  t.after(() => { if (original) Object.defineProperty(globalThis, 'caches', original); else Reflect.deleteProperty(globalThis, 'caches') })
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    // Mirror the Workers runtime, which throws on redirect modes other than follow/manual.
    if (init?.redirect && init.redirect !== 'follow' && init.redirect !== 'manual') throw new TypeError(`Invalid redirect value: ${init.redirect}`)
    calls++; upstream.push({ url: new URL(String(url)), init }); return next()
  })
  async function request(search = query, path = 'api/v3/coins/markets', origin = 'https://wallet.example', secret: string | undefined = 'test-key') {
    const response = await onRequestGet({
      request: new Request(`${origin}/cg/${path}${search ? `?${search}` : ''}`, { headers: { Cookie: 'private-cookie', Authorization: 'private-auth', 'CF-Connecting-IP': '192.0.2.1' } }),
      params: { path: path.split('/') }, env: { CG_DEMO_KEY: secret }, waitUntil: (p) => { pending.push(p) },
    })
    await Promise.all(pending.splice(0))
    return response
  }
  return { request, entries, writes, upstream, cache, calls: () => calls, advance: (ms: number) => { now += ms }, respond: (fn: typeof next) => { next = fn } }
}

test('prices are shared across clients and canonical query orders without exposing credentials', async (t) => {
  const h = harness(t)
  const first = await h.request()
  assert.equal(first.headers.get('X-Price-Cache'), 'MISS')
  assert.equal(first.headers.get('Cache-Control'), 'no-store')
  assert.equal(first.headers.get(PRICE_FETCHED_AT_HEADER), String(START))
  h.advance(120000)
  const second = await h.request('ids=ethereum,bitcoin,bitcoin&price_change_percentage=30d,24h,7d&vs_currency=USD')
  assert.equal(second.headers.get('X-Price-Cache'), 'HIT')
  assert.equal(second.headers.get(PRICE_FETCHED_AT_HEADER), String(START))
  assert.deepEqual(await second.json(), rows)
  assert.equal(h.calls(), 1)
  assert.equal(h.entries.size, 1)
  assert.equal(h.entries.values().next().value!.headers.get('Cache-Control'), 'public, max-age=300')
  assert.equal([...h.writes[0].headers].length, 0)
  assert(!h.writes[0].url.includes('test-key'))
  const headers = new Headers(h.upstream[0].init?.headers)
  assert.equal(headers.get('Cookie'), null)
  assert.equal(headers.get('Authorization'), null)
  assert.equal(headers.get('CF-Connecting-IP'), null)
  assert.equal(headers.get('x-cg-demo-api-key'), 'test-key')
  assert.equal(h.upstream[0].url.searchParams.get('x_cg_demo_api_key'), 'test-key')
})

test('expiry fetches new prices, and currencies and deployment origins remain separate', async (t) => {
  const h = harness(t)
  await h.request()
  h.advance(PRICE_CACHE_SECONDS * 1000 - 1)
  assert.equal((await h.request()).headers.get('X-Price-Cache'), 'HIT')
  h.advance(1)
  const fresh = await h.request()
  assert.equal(fresh.headers.get('X-Price-Cache'), 'MISS')
  assert.equal(fresh.headers.get(PRICE_FETCHED_AT_HEADER), String(START + 300000))
  await h.request(query.replace('usd', 'pln'))
  await h.request(query, 'api/v3/coins/markets', 'https://preview.example')
  assert.equal(h.calls(), 4)
})

test('unrecognized routes and parameters cannot spend quota or fragment the cache', async (t) => {
  const h = harness(t)
  for (const search of [query + '&nocache=1', query + '&x_cg_demo_api_key=attacker', query + '&vs_currency=pln', query.replace('usd', 'invalid'), query.replace('bitcoin%2Cethereum', 'private-address'), query.replace('24h%2C7d%2C30d', '1h')]) {
    assert.equal((await h.request(search)).status, 400)
  }
  assert.equal((await h.request(query, 'api/v3/coins/private-address')).status, 404)
  assert.equal(h.calls(), 0)
  assert.equal(h.entries.size, 0)
})

test('provider errors, redirects and invalid or partial JSON never enter shared cache', async (t) => {
  const h = harness(t)
  for (const status of [403, 429, 500, 503, 302, 204]) {
    h.respond(() => new Response(status === 204 ? null : 'sensitive upstream details', { status }))
    const response = await h.request()
    assert.equal(response.status, status >= 400 ? status : 502)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert(!(await response.text()).includes('sensitive'))
  }
  for (const data of [[], rows.slice(0, 1), [rows[0], rows[0]], [{ ...rows[0], current_price: -1 }, rows[1]], { error: 'bad' }]) {
    h.respond(() => Response.json(data))
    assert.equal((await h.request()).status, 502)
  }
  h.respond(() => new Response('<html>error</html>'))
  assert.equal((await h.request()).status, 502)
  h.respond(() => { throw new DOMException('Timed out', 'TimeoutError') })
  assert.equal((await h.request()).status, 502)
  assert.equal(h.entries.size, 0)
  h.respond(() => Response.json(rows))
  assert.equal((await h.request()).status, 200)
  assert.equal(h.entries.size, 1)
})

test('cache failure falls back to upstream and failed writes do not fail valid prices', async (t) => {
  const h = harness(t)
  t.mock.method(h.cache, 'match', async () => { throw new Error('Cache unavailable') })
  const response = await h.request()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('X-Price-Cache'), 'BYPASS')
  t.mock.restoreAll()
  t.mock.method(h.cache, 'put', async () => { throw new Error('Write unavailable') })
  t.mock.method(globalThis, 'fetch', async () => Response.json(rows))
  assert.equal((await h.request()).status, 200)
})

test('missing key is explicit; ping remains available without caching', async (t) => {
  const h = harness(t)
  assert.equal((await h.request(query, 'api/v3/coins/markets', 'https://wallet.example', '')).status, 503)
  assert.equal(h.calls(), 0)
  h.respond(() => Response.json({ gecko_says: '(V3) To the Moon!' }))
  assert.equal((await h.request('', 'api/v3/ping')).status, 200)
  assert.equal((await h.request('', 'api/v3/ping')).status, 200)
  assert.equal(h.calls(), 2)
  assert.equal(h.entries.size, 0)
})

test('client persists original price fetch time instead of receipt time', async (t) => {
  t.mock.method(Date, 'now', () => START + 240000)
  t.mock.method(globalThis, 'fetch', async () => Response.json(rows, { headers: { [PRICE_FETCHED_AT_HEADER]: String(START) } }))
  const data = await fetchMarkets('USD', ['bitcoin', 'ethereum'])
  assert.equal(marketUpdatedAt(data, Date.now()), START)
  assert.equal(remainingPriceFreshness(data, Date.now(), Date.now()), 60000)
  const persisted = JSON.parse(JSON.stringify(data)) as Markets
  assert.equal(marketUpdatedAt(persisted, START + 600000), START)
  assert.equal(remainingPriceFreshness(persisted, START + 600000, START + 600000), 0)
})

test('legacy prices and direct development responses still work without proxy metadata', async (t) => {
  t.mock.method(Date, 'now', () => START)
  t.mock.method(globalThis, 'fetch', async () => Response.json(rows))
  const data = await fetchMarkets('USD', ['bitcoin', 'ethereum'])
  assert.equal(data.bitcoin.fetchedAt, START)
  delete data.bitcoin.fetchedAt
  delete data.ethereum.fetchedAt
  assert.equal(marketUpdatedAt(data, START), START)
})

test('client rejects incomplete responses and invalid timestamps rather than replacing good data', async (t) => {
  t.mock.method(Date, 'now', () => START)
  for (const timestamp of ['0', 'invalid', String(START + 120000)]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(rows, { headers: { [PRICE_FETCHED_AT_HEADER]: timestamp } }))
    await assert.rejects(fetchMarkets('USD', ['bitcoin', 'ethereum']))
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json(rows.slice(0, 1)))
  await assert.rejects(fetchMarkets('USD', ['bitcoin', 'ethereum']))
})

test('a recently received old price is marked stale and cannot create fresh history', async () => {
  const now = START + 300001
  const account = { id: 'test', chain: 'btc' as const, kind: 'address' as const, value: 'test' }
  const markets: Markets = { bitcoin: { price: 60000, fetchedAt: START, change24h: 2, change7d: null, change30d: null, high24h: null, low24h: null } }
  const status = getDataStatus([{ fiat: 60000, views: [{ account, balance: { amount: 1, txCount: 0, usedCount: 0, scannedCount: 1 }, isLoading: false, isFetching: false, isError: false, dataUpdatedAt: now }] }], {
    dataUpdatedAt: marketUpdatedAt(markets, now), isFetching: false, isError: false,
  }, true, now)
  assert.equal(status.kind, 'cached')
  assert.equal(status.oldestUpdatedAt, START)
  assert.equal(createSnapshot({ accounts: [account], assets: [{ chain: 'btc', amount: 1, fiat: 60000 }], currency: 'USD', status, sourceTimes: [START, now], now }), null)
})

test('upstream redirects are not followed, cached or reported as prices', async (t) => {
  const h = harness(t)
  h.respond(() => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example/markets' } }))
  const response = await h.request()
  assert.equal(response.status, 502)
  assert.equal(h.upstream[0].init?.redirect, 'manual')
  assert.equal(h.calls(), 1)
  assert.equal(h.writes.length, 0)
})
