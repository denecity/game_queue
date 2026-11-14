import type { D1PreparedStatement } from '@cloudflare/workers-types'
import type { Env } from '../../../server/common'
import { resolveImages, type ImageTarget } from '../../../server/images'

const MAX_PER_CALL = 20

/**
 * Re-resolve cover art for up to 20 games. Body: { ids: string[], failed?: { [id]: url } }, where
 * `failed` names the link the browser couldn't show, so a different one comes back.
 * Returns { images: { [id]: url | null } } and saves every link that changed.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json().catch(() => ({})) as { ids?: string[]; failed?: Record<string, string> }
  const ids = (body.ids ?? []).filter(id => typeof id === 'string').slice(0, MAX_PER_CALL)
  if (ids.length === 0) return Response.json({ images: {} })

  const { results } = await env.DB.prepare(
    `SELECT id, name, steam_app_id, steam_url, image_url FROM games WHERE id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all()
  const targets = results as unknown as Array<ImageTarget & { image_url: string | null }>

  const resolved = await resolveImages(targets, env, body.failed ?? {})
  const stmts: D1PreparedStatement[] = []
  const images: Record<string, string | null> = {}
  for (const t of targets) {
    const url = resolved.get(t.id) ?? null
    images[t.id] = url
    if (url && url !== t.image_url) stmts.push(env.DB.prepare('UPDATE games SET image_url = ? WHERE id = ?').bind(url, t.id))
  }
  if (stmts.length) await env.DB.batch(stmts)

  return Response.json({ images })
}
