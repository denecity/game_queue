import type { D1PreparedStatement } from '@cloudflare/workers-types'
import { nextQueuePosition, type Env } from './common'
import { getStoreItems } from './steam'

export interface ImportCandidate {
  appid: number
  name?: string
  hours_played?: number
}

export interface ImportOutcome {
  added: number
  skipped: number
  games: Array<{ id: string; name: string }>
}

/**
 * Insert Steam apps that aren't in the DB yet, in one D1 batch.
 * Names, art, price and tags come from one batched Steam store call per 100 apps.
 */
export async function importSteamApps(
  env: Env,
  candidates: ImportCandidate[],
  status: 'none' | 'done'
): Promise<ImportOutcome> {
  const existing = await env.DB.prepare('SELECT steam_app_id FROM games WHERE steam_app_id IS NOT NULL').all()
  const have = new Set((existing.results ?? []).map(r => (r as { steam_app_id: number }).steam_app_id))
  const fresh = candidates.filter(c => !have.has(c.appid))
  const skipped = candidates.length - fresh.length
  if (fresh.length === 0) return { added: 0, skipped, games: [] }

  const items = await getStoreItems(fresh.map(c => c.appid), { withTags: true })
  let pos = await nextQueuePosition(env.DB)
  const now = new Date().toISOString()
  const games: ImportOutcome['games'] = []
  const stmts: D1PreparedStatement[] = []

  for (const c of fresh) {
    const item = items.get(c.appid)
    const name = item?.name ?? c.name
    if (!name) continue
    const id = crypto.randomUUID()
    stmts.push(env.DB.prepare(`
      INSERT INTO games (id, steam_app_id, name, image_url, price, status, queue_position, tags,
        hours_played, date_added, is_custom, steam_url, date_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      id, c.appid, name,
      item?.header ?? item?.capsule ?? `https://cdn.akamai.steamstatic.com/steam/apps/${c.appid}/header.jpg`,
      item?.price ?? null,
      status, pos,
      JSON.stringify(item?.tags ?? []),
      c.hours_played ?? 0,
      now,
      `https://store.steampowered.com/app/${c.appid}/`,
      status === 'done' ? now : null,
    ))
    pos += 1000
    games.push({ id, name })
  }

  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50))
  return { added: games.length, skipped, games }
}
