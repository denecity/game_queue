import type { Env } from '../../../server/common'
import { refreshPrices } from '../../../server/prices'

/**
 * Refresh one batch of key/deal prices.
 * Body: { ids?: string[] } for specific games, or { before?: ISO } to treat anything
 * checked before that time as stale (used by "Refresh all" to walk the list call by call).
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json().catch(() => ({})) as { ids?: string[]; before?: string }
  try {
    const result = await refreshPrices(env, { ids: body.ids, before: body.before })
    return Response.json({ ...result, itad: !!env.ITAD_API_KEY })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
