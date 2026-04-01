import type { D1Database } from '@cloudflare/workers-types'
import { scrapeKeyPrice } from './api/keyforsteam/refresh'

interface Env {
  DB: D1Database
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const { results } = await env.DB.prepare(
      `SELECT id, steam_app_id, name, key_price_url FROM games
       WHERE is_custom = 0 AND steam_app_id IS NOT NULL
       AND (key_price_updated IS NULL OR key_price_updated < datetime('now', '-6 hours'))`
    ).all() as { results: { id: string; steam_app_id: number; name: string; key_price_url: string | null }[] }

    for (const game of results) {
      try {
        const newPrice = await scrapeKeyPrice(game.name, game.steam_app_id, game.key_price_url)
        if (newPrice) {
          await env.DB.prepare(
            "UPDATE games SET key_price = ?, key_price_url = ?, key_price_updated = ? WHERE id = ?"
          ).bind(newPrice.price, newPrice.url, new Date().toISOString(), game.id).run()
        }
      } catch (e) {
        console.error(`Cron key price refresh failed for ${game.name}:`, e)
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  },
}
