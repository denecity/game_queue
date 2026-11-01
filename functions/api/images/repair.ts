import type { D1PreparedStatement } from '@cloudflare/workers-types'
import type { Env } from '../../../server/common'
import { resolveImages, type ImageTarget } from '../../../server/images'

const MAX_PER_CALL = 40

/**
 * Re-resolve cover art. Body: { ids: string[] } for specific games (the client sends
 * the ones whose <img> failed), or { all: true } to re-check every Steam game in one batched call.
 * Returns { images: { [id]: url | null } }.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json().catch(() => ({})) as { ids?: string[]; all?: boolean }

  let targets: ImageTarget[]
  if (body.all) {
    const { results } = await env.DB.prepare(
      'SELECT id, name, steam_app_id, steam_url FROM games WHERE steam_app_id IS NOT NULL'
    ).all()
    targets = results as unknown as ImageTarget[]
  } else {
    const ids = (body.ids ?? []).slice(0, MAX_PER_CALL)
    if (ids.length === 0) return Response.json({ images: {} })
    const { results } = await env.DB.prepare(
      `SELECT id, name, steam_app_id, steam_url FROM games WHERE id IN (${ids.map(() => '?').join(',')})`
    ).bind(...ids).all()
    targets = results as unknown as ImageTarget[]
  }

  const resolved = await resolveImages(targets, env)
  const stmts: D1PreparedStatement[] = []
  const images: Record<string, string | null> = {}
  for (const [id, url] of resolved) {
    images[id] = url
    if (url) stmts.push(env.DB.prepare('UPDATE games SET image_url = ? WHERE id = ?').bind(url, id))
  }
  if (stmts.length) await env.DB.batch(stmts)

  return Response.json({ images })
}
