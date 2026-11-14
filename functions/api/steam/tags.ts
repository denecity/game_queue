import { tagNames } from '../../../server/steam'

// Every Steam tag, most widely used first. Feeds the tag picker in Discover's filters.
export const onRequestGet: PagesFunction = async () => {
  const names = await tagNames()
  if (names.size === 0) return Response.json({ error: "Couldn't reach Steam" }, { status: 502 })
  return Response.json([...names].map(([id, name]) => ({ id, name })), {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  })
}
