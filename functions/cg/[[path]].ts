// Cloudflare Pages Function: proxy do CoinGecko pod /cg/*.
// Ukrywa IP użytkownika i omija CORS; cache na brzegu ogranicza zapytania.

interface Context {
  request: Request
  params: { path?: string | string[] }
}

const UPSTREAM = 'https://api.coingecko.com'

export const onRequestGet = async ({ request, params }: Context): Promise<Response> => {
  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []
  const path = segments.map(encodeURIComponent).join('/')
  const search = new URL(request.url).search
  const target = `${UPSTREAM}/${path}${search}`

  const upstream = await fetch(target, { headers: { Accept: 'application/json' } })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'public, max-age=60',
    },
  })
}
