// Cloudflare Pages Function: proxy do CoinGecko pod /cg/*.
// Ukrywa IP użytkownika i omija CORS; cache na brzegu ogranicza zapytania.
// CoinGecko blokuje anonimowe zapytania z IP centrów danych (np. Cloudflare),
// dlatego dokładamy darmowy Demo API key z zmiennej środowiskowej CG_DEMO_KEY
// — i jako parametr w URL, i jako nagłówek (obie metody są wspierane).

interface Env {
  CG_DEMO_KEY?: string
}

interface Context {
  request: Request
  params: { path?: string | string[] }
  env: Env
}

const UPSTREAM = 'https://api.coingecko.com'

export const onRequestGet = async ({ request, params, env }: Context): Promise<Response> => {
  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []
  const path = segments.map(encodeURIComponent).join('/')

  const url = new URL(`${UPSTREAM}/${path}`)
  url.search = new URL(request.url).search
  if (env.CG_DEMO_KEY) url.searchParams.set('x_cg_demo_api_key', env.CG_DEMO_KEY)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'gazewallet (+https://github.com/p-poweska/gazewallet)',
  }
  if (env.CG_DEMO_KEY) headers['x-cg-demo-api-key'] = env.CG_DEMO_KEY

  const upstream = await fetch(url.toString(), { headers })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'public, max-age=60',
    },
  })
}
