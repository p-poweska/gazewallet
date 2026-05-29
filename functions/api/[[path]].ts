// Cloudflare Pages Function: proxy do mempool.space pod /api/*.
// Świadomie NIE logujemy ciał ani adresów — to ma być prywatne.
// Dla mempool.space widoczne jest tylko IP Cloudflare, nie użytkownika.

interface Context {
  request: Request
  params: { path?: string | string[] }
}

const UPSTREAM = 'https://mempool.space/api'

export const onRequestGet = async ({ request, params }: Context): Promise<Response> => {
  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []
  const path = segments.map(encodeURIComponent).join('/')
  const search = new URL(request.url).search
  const target = `${UPSTREAM}/${path}${search}`

  const upstream = await fetch(target, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'gazewallet (+https://github.com/p-poweska/gazewallet)',
    },
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'public, max-age=30',
    },
  })
}
