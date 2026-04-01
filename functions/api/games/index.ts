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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const sort = url.searchParams.get('sort') || 'queue_position'
  const search = url.searchParams.get('search')

  const orderMap: Record<string, string> = {
    queue_position: 'queue_position ASC',
    rating_desc: 'rating DESC NULLS LAST',
    price_desc: 'price DESC',
    price_asc: 'price ASC',
    key_price_asc: 'key_price ASC NULLS LAST',
    players_desc: 'player_count DESC NULLS LAST',
    date_added_desc: 'date_added DESC',
    date_added_asc: 'date_added ASC',
    name_asc: 'name ASC',
  }
  const orderBy = orderMap[sort] ?? 'queue_position ASC'

  let query = 'SELECT * FROM games WHERE 1=1'
  const bindings: unknown[] = []

  if (status) {
    query += ' AND status = ?'
    bindings.push(status)
  }
  if (search) {
    query += ' AND name LIKE ?'
    bindings.push(`%${search}%`)
  }
  query += ` ORDER BY ${orderBy}`

  const stmt = env.DB.prepare(query)
  const result = await (bindings.length ? stmt.bind(...bindings) : stmt).all()
  const games = (result.results ?? []).map(parseGame)
  return Response.json(games)
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as Record<string, unknown>
  const {
    id, steam_app_id, name, image_url, price, rating, status, queue_position,
    tags, notes, hours_played, date_added, is_custom, steam_url,
    player_count, player_count_recent, key_price, key_price_url, key_price_updated
  } = body

  // Check duplicate
  if (steam_app_id) {
    const dup = await env.DB.prepare('SELECT id, status FROM games WHERE steam_app_id = ?')
      .bind(steam_app_id).first()
    if (dup) {
      return Response.json({ error: 'duplicate', existing: dup }, { status: 409 })
    }
  }

  await env.DB.prepare(`
    INSERT INTO games (id, steam_app_id, name, image_url, price, rating, status, queue_position,
      tags, notes, hours_played, date_added, is_custom, steam_url,
      player_count, player_count_recent, key_price, key_price_url, key_price_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, steam_app_id ?? null, name, image_url ?? null, price ?? null, rating ?? null,
    status ?? 'none', queue_position, tags ? JSON.stringify(tags) : null,
    notes ?? null, hours_played ?? 0, date_added, is_custom ? 1 : 0, steam_url ?? null,
    player_count ?? null, player_count_recent ?? null, key_price ?? null,
    key_price_url ?? null, key_price_updated ?? null
  ).run()

  const game = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first()
  return Response.json(parseGame(game as Record<string, unknown>), { status: 201 })
}
