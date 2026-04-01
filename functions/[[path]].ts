export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Skip API routes - let them be handled by their own functions
  if (pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 })
  }

  // Try to fetch the asset first
  const assetResponse = await env.ASSETS.fetch(request)
  
  // If the asset exists (not 404), return it with correct MIME type
  if (assetResponse.status !== 404) {
    return assetResponse
  }

  // Otherwise, serve index.html for client-side routing
  const indexRequest = new Request(new URL('/index.html', url), {
    method: 'GET',
  })
  return env.ASSETS.fetch(indexRequest)
}
