export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)

  // Skip API routes - let them be handled by their own functions
  if (url.pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 })
  }

  // For all other routes, serve index.html for client-side routing
  return fetch(`${new URL(request.url).origin}/index.html`)
}
