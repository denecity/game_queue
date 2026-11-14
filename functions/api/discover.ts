import type { Env } from '../../server/common'
import { discover, addDismissed, removeDismissed, type DiscoverFilters } from '../../server/discover'

function idList(value: string | null): number[] {
  return (value ?? '').split(',').map(v => parseInt(v, 10)).filter(n => Number.isInteger(n) && n > 0).slice(0, 12)
}

// Suggestions built from the library: wishlisted, queued, played and rated games all feed the taste profile.
// Optional filters: ?tags=1716,19&cats=39,28&deck=1&sale=1&free=1&released=1, and &page=N to dig deeper.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams
  const filters: DiscoverFilters = {
    tags: idList(q.get('tags')),
    cats: idList(q.get('cats')),
    deck: q.has('deck'),
    sale: q.has('sale'),
    free: q.has('free'),
    released: q.has('released'),
  }
  const page = Math.min(20, Math.max(0, parseInt(q.get('page') ?? '0', 10) || 0))
  try {
    return Response.json(await discover(env, filters, page), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}

// {"dismiss": appid} hides a suggestion for good; {"restore": appid} undoes that.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { dismiss, restore } = await request.json().catch(() => ({})) as { dismiss?: number; restore?: number }
  const appid = dismiss ?? restore
  if (typeof appid !== 'number' || !Number.isInteger(appid)) return Response.json({ error: 'Send {"dismiss": appid} or {"restore": appid}' }, { status: 400 })

  if (dismiss != null) await addDismissed(env, dismiss)
  else await removeDismissed(env, restore!)
  return Response.json({ ok: true })
}
