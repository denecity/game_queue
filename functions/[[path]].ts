export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Don't handle API routes - they have their own handlers in functions/api/
  if (pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 })
  }

  // Try to fetch the asset first (CSS, JS, images, etc.)
  const assetResponse = await env.ASSETS.fetch(request)
  
  // If the asset exists (not 404), return it
  if (assetResponse.status !== 404) {
    return assetResponse
  }

  // For all other routes (client-side routes), serve index.html
  const indexRequest = new Request(new URL('/index.html', url), {
    method: 'GET',
  })
  return env.ASSETS.fetch(indexRequest)
}
