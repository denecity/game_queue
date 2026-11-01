import type { Env } from '../../server/common'

// Small key/value store so preferences like Steam sync sources follow you across devices.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all()
  const out: Record<string, unknown> = {}
  for (const r of results as { key: string; value: string }[]) {
    try { out[r.key] = JSON.parse(r.value) } catch { out[r.key] = r.value }
  }
  return Response.json(out, { headers: { 'Cache-Control': 'no-store' } })
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json() as Record<string, unknown>
  const stmts = Object.entries(body).map(([k, v]) =>
    env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(k, JSON.stringify(v))
  )
  if (stmts.length) await env.DB.batch(stmts)
  return Response.json({ ok: true })
}
