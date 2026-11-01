import type { Env } from '../../server/common'
import { refreshPrices } from '../../server/prices'

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      refreshPrices(env).then(r => console.log(`price refresh: ${r.processed} checked, ${r.updated} updated, ${r.remaining} still stale`))
    )
  },
}
