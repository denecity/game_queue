import { searchStore } from '../../../server/steam'

export const onRequestGet: PagesFunction = async ({ request }) => {
  const q = new URL(request.url).searchParams.get('q')
  if (!q) return Response.json({ error: 'Missing q' }, { status: 400 })

  try {
    const hits = await searchStore(q, 10)
    return Response.json(hits.map(h => ({ ...h, tags: [] })))
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
