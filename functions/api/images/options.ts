import type { Env } from '../../../server/common'
import { coverOptions, type ImageTarget } from '../../../server/images'

// Every picture that could be this game's cover: /api/images/options?id=<game id>
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const game = await env.DB.prepare('SELECT id, name, steam_app_id, steam_url FROM games WHERE id = ?').bind(id).first()
  if (!game) return Response.json({ error: 'Game not found' }, { status: 404 })

  try {
    return Response.json({ options: await coverOptions(game as unknown as ImageTarget, env) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
