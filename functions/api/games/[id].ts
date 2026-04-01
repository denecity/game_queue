import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

function parseGame(row: Record<string, unknown>) {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    is_custom: row.is_custom === 1,
    hours_played: row.hours_played ?? 0,
  }
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = params.id as string
  const body = await request.json() as Record<string, unknown>

  const allowed = [
    'name', 'image_url', 'price', 'rating', 'status', 'queue_position',
    'tags', 'notes', 'hours_played', 'date_completed', 'steam_url',
    'player_count', 'player_count_recent', 'key_price', 'key_price_url', 'key_price_updated'
  ]

  const setClauses: string[] = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      setClauses.push(`${key} = ?`)
      if (key === 'tags') {
        values.push(body[key] ? JSON.stringify(body[key]) : null)
      } else {
        values.push(body[key] ?? null)
      }
    }
  }

  if (setClauses.length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  values.push(id)
  await env.DB.prepare(`UPDATE games SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...values).run()

  const game = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first()
  if (!game) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(parseGame(game as Record<string, unknown>))
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string
  await env.DB.prepare('DELETE FROM games WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}
