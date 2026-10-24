import { CURRENCIES } from '../../src/lib/currency'
import { parseMarketRows, PRICE_CACHE_SECONDS, PRICE_FETCHED_AT_HEADER } from '../../src/lib/market-data'

interface Context {
  request: Request
  params: { path?: string | string[] }
  env: { CG_DEMO_KEY?: string }
  waitUntil(promise: Promise<unknown>): void
}

const UPSTREAM = 'https://api.coingecko.com'
const COINS = ['bitcoin', 'ethereum']
const PERIODS = ['24h', '7d', '30d']

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function canonicalParams(url: URL): URLSearchParams | null {
  const allowed = ['vs_currency', 'ids', 'price_change_percentage', 'sparkline']
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) return null
  }
  const currency = url.searchParams.get('vs_currency')?.toLowerCase()
  if (!currency || !CURRENCIES.some((c) => c.toLowerCase() === currency)) return null
  const ids = [...new Set((url.searchParams.get('ids') ?? '').toLowerCase().split(',').map((id) => id.trim()))].sort()
  if (!ids.length || ids.some((id) => !COINS.includes(id))) return null
  const periods = url.searchParams.get('price_change_percentage')
  if (periods !== null) {
    const requested = new Set(periods.split(',').map((period) => period.trim()))
    if (requested.size !== PERIODS.length || PERIODS.some((period) => !requested.has(period))) return null
  }
  const sparkline = url.searchParams.get('sparkline')
  if (sparkline !== null && sparkline !== 'true') return null
  // Always fetch the 7-day sparkline so clients with and without it share one cache entry.
  return new URLSearchParams({ vs_currency: currency, ids: ids.join(','), price_change_percentage: PERIODS.join(','), sparkline: 'true' })
}

function clientResponse(response: Response, status: 'HIT' | 'MISS' | 'BYPASS'): Response {
  const headers = new Headers(response.headers)
  // Only the explicit edge entry is shared. Avoid an additional browser/CDN TTL.
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Price-Cache', status)
  return new Response(response.body, { status: 200, headers })
}

export const onRequestGet = async ({ request, params, env, waitUntil }: Context): Promise<Response> => {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path
  const incoming = new URL(request.url)
  const ping = path === 'api/v3/ping'
  if (!ping && path !== 'api/v3/coins/markets') return errorResponse(404, 'Unknown price endpoint')
  const search = ping ? new URLSearchParams() : canonicalParams(incoming)
  if (!search || (ping && incoming.search)) return errorResponse(400, 'Unsupported price parameters')

  // No cookies, credentials, user IP or API key belong in the cache key.
  const key = new Request(`${incoming.origin}/__price-cache/v1/markets?${search}`, { method: 'GET' })
  let cache: Cache | undefined
  if (!ping) {
    try {
      cache = (globalThis.caches as CacheStorage & { default?: Cache } | undefined)?.default
      const hit = await cache?.match(key)
      if (hit?.status === 200) {
        const fetchedAt = Number(hit.headers.get(PRICE_FETCHED_AT_HEADER))
        const age = Date.now() - fetchedAt
        if (fetchedAt > 0 && age >= 0 && age < PRICE_CACHE_SECONDS * 1000) return clientResponse(hit, 'HIT')
      }
    } catch { cache = undefined }
  }

  if (!env.CG_DEMO_KEY?.trim()) return errorResponse(503, 'Price service is not configured')
  const url = new URL(`${UPSTREAM}/${path}`)
  url.search = search.toString()
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'gazewallet (+https://github.com/p-poweska/gazewallet)',
    'x-cg-demo-api-key': env.CG_DEMO_KEY.trim(),
  }
  // Keep the previously working authentication method; never expose this URL.
  url.searchParams.set('x_cg_demo_api_key', env.CG_DEMO_KEY.trim())
  try {
    // Workers reject redirect: 'error' with a TypeError. 'manual' keeps redirects unfollowed;
    // a 3xx then fails the status check below.
    const upstream = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) })
    if (upstream.status !== 200) {
      // Do not forward provider error bodies: they may contain request details.
      return errorResponse(upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502, 'Price provider request failed')
    }
    const data: unknown = await upstream.json()
    if (ping) {
      if (!data || typeof data !== 'object' || !('gecko_says' in data) || typeof data.gecko_says !== 'string') return errorResponse(502, 'Invalid price provider response')
      return Response.json({ gecko_says: data.gecko_says }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const rows = parseMarketRows(data, search.get('ids')!.split(','))
    const response = Response.json(rows, { headers: {
      'Cache-Control': `public, max-age=${PRICE_CACHE_SECONDS}`,
      [PRICE_FETCHED_AT_HEADER]: String(Date.now()),
    } })
    if (cache) {
      // Cache failure must not discard a valid upstream response.
      waitUntil(cache.put(key, response.clone()).catch(() => undefined))
    }
    return clientResponse(response, cache ? 'MISS' : 'BYPASS')
  } catch {
    return errorResponse(502, 'Price provider is unavailable or returned invalid data')
  }
}
