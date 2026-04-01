import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const items = await request.json() as { id: string; queue_position: number }[]

  const stmt = env.DB.prepare('UPDATE games SET queue_position = ? WHERE id = ?')
  const batch = items.map(({ id, queue_position }) => stmt.bind(queue_position, id))
  await env.DB.batch(batch)

  return Response.json({ ok: true })
}
