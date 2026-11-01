import { fetchT, mapLimit, BROWSER_UA, type Env } from './common'
import { getStoreItems } from './steam'
import { itadLookup, itadPrices, type ItadPrices } from './itad'

// Free-plan Workers allow 50 outbound subrequests per invocation. A batch costs
// ≤3 keyforsteam fetches per game plus 3 batched calls (Steam, ITAD lookup, ITAD prices).
export const BATCH_SIZE = 12
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000

export interface Offer {
  kind: 'store' | 'key'
  shop: string
  price: number
  currency: string
  url: string
  cut?: number
}

interface KeyResult {
  low: number
  shop: string | null
  url: string
  offers: Offer[]
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function keyforsteamCandidates(name: string, existingUrl: string | null): string[] {
  const urls = new Set<string>()
  if (existingUrl) urls.add(existingUrl)
  const page = (slug: string) => `https://www.keyforsteam.de/${slug}-key-kaufen-preisvergleich/`
  urls.add(page(slugify(name)))
  const head = name.split(/\s*[:–—]\s*|\s+-\s+/)[0]
  if (head && head !== name) urls.add(page(slugify(head)))
  return [...urls].slice(0, 3)
}

interface KfsPrice {
  price: number
  merchantName: string
  region: string
  edition: string
  account: boolean
  dispo: number
  isOfficial?: boolean
}

interface KfsData {
  prices?: KfsPrice[]
  regions?: Record<string, { filter_name?: string; region_name?: string }>
  editions?: Record<string, { name?: string }>
}

// Keys that activate in Switzerland. Excludes region-locked keys (RU, LATAM, TR, ROW…) and accounts.
const OK_REGION = /\b(GLOBAL|EU|EUROPA|EUROPE|WORLDWIDE)\b/i
const SKIP_EDITION = /soundtrack|\bost\b|dlc|season pass|artbook|upgrade|expansion/i

/**
 * keyforsteam embeds every offer (with region, edition and an "account" flag) in a
 * `gamePageTrans` JSON blob. Its schema.org lowPrice is misleading because it includes
 * Steam *account* sales, which are often a third of the real key price.
 */
function parseKeyforsteamOffers(html: string, pageUrl: string): KeyResult | null {
  const start = html.indexOf('<script id="aks-offers-js-extra">')
  if (start === -1) return null
  const end = html.indexOf('</script>', start)
  const js = html.slice(start, end)
  let data: KfsData
  try {
    data = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1))
  } catch {
    return null
  }

  const regions = data.regions ?? {}
  const editions = data.editions ?? {}
  const offers: Offer[] = (data.prices ?? [])
    .filter(p => {
      if (p.account || p.dispo !== 1 || !Number.isFinite(p.price) || p.price < 0.3) return false
      // Steam's own listing is shown separately (and is a 0.02 placeholder for unreleased games)
      if (p.isOfficial && /^steam$/i.test(p.merchantName)) return false
      const r = regions[p.region]
      if (!r || !OK_REGION.test(`${r.filter_name ?? ''} ${r.region_name ?? ''}`)) return false
      return !SKIP_EDITION.test(editions[p.edition]?.name ?? '')
    })
    .sort((a, b) => a.price - b.price)
    .map(p => {
      const r = regions[p.region]
      const where = (r?.region_name ?? '').replace(/^GIFT$/, 'Gift')
      return { kind: 'key' as const, shop: where ? `${p.merchantName} · ${where}` : p.merchantName, price: p.price, currency: 'EUR', url: pageUrl }
    })

  // One row per shop keeps the list readable
  const seen = new Set<string>()
  const unique = offers.filter(o => { const s = o.shop.split(' · ')[0]; if (seen.has(s)) return false; seen.add(s); return true })
  if (!unique.length) return null
  return { low: unique[0].price, shop: unique[0].shop.split(' · ')[0], url: pageUrl, offers: unique.slice(0, 5) }
}

/** Shared per batch: once keyforsteam starts refusing us, stop asking until the next run. */
export interface ScrapeBreaker { tripped: boolean }

export async function scrapeKeyforsteam(
  name: string,
  existingUrl: string | null,
  breaker: ScrapeBreaker = { tripped: false }
): Promise<KeyResult | null> {
  for (const url of keyforsteamCandidates(name, existingUrl)) {
    if (breaker.tripped) return null
    try {
      const res = await fetchT(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'de,en;q=0.9' } }, 8000)
      if (res.status === 403 || res.status === 429 || res.status >= 500) { breaker.tripped = true; return null }
      if (!res.ok) continue
      const html = await res.text()
      // Under load keyforsteam answers 200 with a small challenge page instead of the game page
      // (real game pages are ~250 KB and always carry the offers script)
      if (!html.includes('aks-offers-js-extra') && html.length < 100_000) { breaker.tripped = true; return null }
      const parsed = parseKeyforsteamOffers(html, res.url || url)
      if (parsed) return parsed
    } catch {
      // Connection refused / timed out: almost always rate limiting
      breaker.tripped = true
      return null
    }
  }
  return null
}

interface PriceRow {
  id: string
  name: string
  steam_app_id: number
  key_price_url: string | null
  itad_id: string | null
}

export interface RefreshResult {
  processed: number
  updated: number
  remaining: number
}

/**
 * Refresh one batch of the stalest games. Safe to call repeatedly: each call works on
 * the games checked least recently, so repeated calls (cron or client) walk the whole list.
 */
export async function refreshPrices(
  env: Env,
  opts: { ids?: string[]; before?: string; limit?: number } = {}
): Promise<RefreshResult> {
  const limit = Math.min(opts.limit ?? BATCH_SIZE, BATCH_SIZE)
  const cutoff = opts.before ?? new Date(Date.now() - STALE_AFTER_MS).toISOString()

  let rows: PriceRow[]
  if (opts.ids?.length) {
    const ids = opts.ids.slice(0, limit)
    const { results } = await env.DB.prepare(
      `SELECT id, name, steam_app_id, key_price_url, itad_id FROM games
       WHERE steam_app_id IS NOT NULL AND id IN (${ids.map(() => '?').join(',')})`
    ).bind(...ids).all()
    rows = results as unknown as PriceRow[]
  } else {
    const { results } = await env.DB.prepare(
      `SELECT id, name, steam_app_id, key_price_url, itad_id FROM games
       WHERE is_custom = 0 AND steam_app_id IS NOT NULL
         AND (prices_checked IS NULL OR prices_checked < ?)
       ORDER BY prices_checked IS NOT NULL, status = 'done', prices_checked
       LIMIT ?`
    ).bind(cutoff, limit).all()
    rows = results as unknown as PriceRow[]
  }

  if (rows.length === 0) return { processed: 0, updated: 0, remaining: 0 }

  const appids = rows.map(r => r.steam_app_id)
  const steamItems = getStoreItems(appids)

  let itadById = new Map<string, ItadPrices>()
  const itadIds = new Map<number, string>()
  if (env.ITAD_API_KEY) {
    for (const r of rows) if (r.itad_id) itadIds.set(r.steam_app_id, r.itad_id)
    const missing = rows.filter(r => !r.itad_id).map(r => r.steam_app_id)
    if (missing.length) for (const [k, v] of await itadLookup(missing, env.ITAD_API_KEY)) itadIds.set(k, v)
    itadById = await itadPrices([...itadIds.values()], env.ITAD_API_KEY)
  }

  // keyforsteam rate-limits bursts, so keep this gentle
  const breaker: ScrapeBreaker = { tripped: false }
  const keyResults = await mapLimit(rows, 2, async r => {
    const result = await scrapeKeyforsteam(r.name, r.key_price_url, breaker)
    await new Promise(res => setTimeout(res, 400))
    return result
  })
  const steam = await steamItems
  const now = new Date().toISOString()
  // Games whose keyforsteam lookup was skipped by the breaker come back in ~30 min instead of 6h
  const retrySoon = new Date(Date.now() - STALE_AFTER_MS + 30 * 60 * 1000).toISOString()
  let updated = 0

  const stmts = rows.map((r, i) => {
    const key = keyResults[i]
    const itadId = itadIds.get(r.steam_app_id) ?? null
    const itad = itadId ? itadById.get(itadId) : undefined
    const best = itad?.deals[0]
    const item = steam.get(r.steam_app_id)
    if (key || best || item) updated++

    const offers: Offer[] = [
      ...(itad?.deals.slice(0, 6).map(d => ({ kind: 'store' as const, shop: d.shop, price: d.price, currency: d.currency, url: d.url, cut: d.cut })) ?? []),
      ...(key?.offers ?? []),
    ]

    // COALESCE keeps the previous value when a source came back empty this round
    return env.DB.prepare(
      `UPDATE games SET
         prices_checked = ?,
         price = COALESCE(?, price),
         image_url = COALESCE(?, image_url),
         key_price = COALESCE(?, key_price),
         key_price_eur = COALESCE(?, key_price_eur),
         key_price_url = COALESCE(?, key_price_url),
         key_shop = COALESCE(?, key_shop),
         key_price_updated = CASE WHEN ? IS NOT NULL THEN ? ELSE key_price_updated END,
         itad_id = COALESCE(?, itad_id),
         deal_price = COALESCE(?, deal_price),
         deal_currency = COALESCE(?, deal_currency),
         deal_shop = COALESCE(?, deal_shop),
         deal_url = COALESCE(?, deal_url),
         deal_cut = COALESCE(?, deal_cut),
         historical_low = COALESCE(?, historical_low),
         offers = CASE WHEN ? > 0 THEN ? ELSE offers END
       WHERE id = ?`
    ).bind(
      key || !breaker.tripped ? now : retrySoon,
      item?.price ?? null,
      item?.header ?? null,
      key ? `${key.low.toFixed(2).replace('.', ',')}€` : null,
      key?.low ?? null,
      key?.url ?? null,
      key?.shop ?? null,
      key ? now : null, now,
      itadId,
      best?.price ?? null,
      best?.currency ?? null,
      best?.shop ?? null,
      best?.url ?? null,
      best?.cut ?? null,
      itad?.historyLow ?? null,
      offers.length, JSON.stringify(offers),
      r.id,
    )
  })
  await env.DB.batch(stmts)

  const remainingRow = opts.ids?.length ? null : await env.DB.prepare(
    `SELECT COUNT(*) as n FROM games WHERE is_custom = 0 AND steam_app_id IS NOT NULL
     AND (prices_checked IS NULL OR prices_checked < ?)`
  ).bind(cutoff).first() as { n: number } | null

  return { processed: rows.length, updated, remaining: remainingRow?.n ?? 0 }
}
