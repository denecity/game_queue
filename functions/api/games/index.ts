import { parseGame, type Env } from '../../../server/common'

// Sorting and filtering happen client-side, so this always returns the full list in queue order.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const result = await env.DB.prepare('SELECT * FROM games ORDER BY queue_position ASC').all()
  return Response.json((result.results ?? []).map(parseGame), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as Record<string, unknown>
  const {
    id, steam_app_id, name, image_url, price, rating, status, queue_position,
    tags, notes, hours_played, date_added, is_custom, steam_url,
    player_count, player_count_recent,
  } = body

  if (steam_app_id) {
    const dup = await env.DB.prepare('SELECT id, status FROM games WHERE steam_app_id = ?')
      .bind(steam_app_id).first()
    if (dup) {
      return Response.json({ error: 'duplicate', existing: dup }, { status: 409 })
    }
  }

  await env.DB.prepare(`
    INSERT INTO games (id, steam_app_id, name, image_url, price, rating, status, queue_position,
      tags, notes, hours_played, date_added, is_custom, steam_url, player_count, player_count_recent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, steam_app_id ?? null, name, image_url ?? null, price ?? null, rating ?? null,
    status ?? 'none', queue_position, tags ? JSON.stringify(tags) : null,
    notes ?? null, hours_played ?? 0, date_added, is_custom ? 1 : 0, steam_url ?? null,
    player_count ?? null, player_count_recent ?? null,
  ).run()

  const game = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first()
  return Response.json(parseGame(game as Record<string, unknown>), { status: 201 })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const { confirm } = await request.json().catch(() => ({})) as { confirm?: string }
  if (confirm !== 'DELETE ALL') {
    return Response.json({ error: 'Send {"confirm":"DELETE ALL"} to wipe every game.' }, { status: 400 })
  }
  await env.DB.prepare('DELETE FROM games').run()
  return new Response(null, { status: 204 })
}
