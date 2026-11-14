import { chunk, mapLimit, type Env } from './common'
import { getStoreItems, moreLikeThis, searchStoreIds, tagNames, type StoreItem, type StoreQuery } from './steam'

const DISMISSED_KEY = 'discover_dismissed'
const MAX_LIBRARY = 400
const MAX_CANDIDATES = 400
const MAX_RESULTS = 40
const SEEDS_PER_SIDE = 4
const SEARCH_PAGE = 50

interface LibraryRow {
  steam_app_id: number
  name: string
  status: string
  rating: number | null
  hours_played: number | null
}

export interface DiscoverFilters {
  /** Steam tag ids the game must carry (genres and anything else) */
  tags: number[]
  /** Steam category ids the game must have: player modes, controller support… */
  cats: number[]
  deck: boolean
  sale: boolean
  free: boolean
  /** Hide games that aren't out yet */
  released: boolean
}

export interface Suggestion {
  appid: number
  name: string
  price: string
  image_url: string
  tags: string[]
  description: string
  /** Games of yours that Steam lists this one as similar to */
  because: Array<{ name: string; wishlist: boolean }>
  /** The tags that pulled it towards your taste */
  match: string[]
  review_pct: number | null
  discount_pct: number | null
  year: number | null
  coming_soon: boolean
  screenshots: string[]
}

export interface DiscoverResult {
  suggestions: Suggestion[]
  basedOn: { wishlist: number; queue: number; archive: number }
  topTags: string[]
}

/**
 * How much a game in the library says about what you want more of.
 * A rating is the strongest signal and can be negative. Without one, being on the wishlist or in the
 * queue counts as plain interest, and playtime adds to anything you've actually played.
 */
function interest(g: LibraryRow): number {
  const hours = Math.min(1, Math.log10(1 + (g.hours_played ?? 0)) / 2) // 100h and up = 1
  if (g.rating != null) {
    const r = (g.rating - 5) / 2.5 // 10 → +2, 5 → 0, 0 → -2
    return r > 0 ? r + hours * 0.5 : r
  }
  switch (g.status) {
    case 'none': return 1
    case 'playing': return 1.2 + hours * 0.5
    case 'bought':
    case 'installed': return 1 + hours * 0.5
    default: return 0.3 + hours // finished or imported but never rated: playtime is all we know
  }
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function richItems(appids: number[]): Promise<Map<number, StoreItem>> {
  const parts = await Promise.all(chunk(appids, 100).map(ids => getStoreItems(ids, { rich: true })))
  const out = new Map<number, StoreItem>()
  for (const part of parts) for (const [id, item] of part) out.set(id, item)
  return out
}

export async function readDismissed(env: Env): Promise<number[]> {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(DISMISSED_KEY).first() as { value: string } | null
  if (!row) return []
  try {
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}

/** One statement, so quick swipes in a row can't overwrite each other's dismissals. */
export async function addDismissed(env: Env, appid: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value) VALUES (?1, json_array(?2))
     ON CONFLICT(key) DO UPDATE SET value = json_insert(value, '$[#]', ?2)`
  ).bind(DISMISSED_KEY, appid).run()
}

export async function removeDismissed(env: Env, appid: number): Promise<void> {
  const ids = (await readDismissed(env)).filter(id => id !== appid)
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(DISMISSED_KEY, JSON.stringify(ids)).run()
}

function passes(item: StoreItem, f: DiscoverFilters): boolean {
  if (f.released && item.comingSoon) return false
  if (f.deck && !item.deckVerified) return false
  if (f.sale && !item.discountPct) return false
  if (f.free && !/free/i.test(item.price ?? '')) return false
  if (f.cats.some(c => !item.categories.includes(c))) return false
  if (f.tags.some(t => !item.tagWeights.some(w => w.id === t))) return false
  return true
}

/**
 * Suggest games that aren't in the library yet.
 *
 * 1. Taste profile: weighted Steam tags of everything you wishlisted, queued, played or rated.
 * 2. Candidates: Steam's "More like this" for a rotating handful of those games (half of them from the
 *    wishlist when there is one), plus store searches on your strongest tags. With filters on, the
 *    searches carry the filters, so there's enough to rank even for something narrow like couch co-op.
 * 3. Rank by how well a candidate's tags match the profile, nudged by its reviews and by how many of
 *    your games point at it.
 *
 * `page` digs deeper into the store searches, for when the first results have all been swiped away.
 */
export async function discover(env: Env, filters: DiscoverFilters, page = 0): Promise<DiscoverResult> {
  const [rows, dismissed, names] = await Promise.all([
    env.DB.prepare('SELECT steam_app_id, name, status, rating, hours_played FROM games WHERE steam_app_id IS NOT NULL').all(),
    readDismissed(env),
    tagNames(),
  ])
  const all = (rows.results ?? []) as unknown as LibraryRow[]
  const owned = new Set(all.map(g => g.steam_app_id))
  const empty: DiscoverResult = { suggestions: [], basedOn: { wishlist: 0, queue: 0, archive: 0 }, topTags: [] }
  if (all.length === 0) return empty

  const weighted = all
    .map(g => ({ g, w: interest(g) }))
    .filter(x => x.w !== 0)
    .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
    .slice(0, MAX_LIBRARY)

  // Everything on Steam is "Indie" or "Singleplayer", so the most widely used tags count for less
  const rank = new Map([...names.keys()].map((id, i) => [id, i]))
  const rarity = (id: number) => {
    const r = rank.get(id)
    return r == null ? 1 : Math.min(1, 0.2 + r / 40)
  }

  const libraryItems = await richItems(weighted.map(x => x.g.steam_app_id))
  const profile = new Map<number, number>()
  const basedOn = { wishlist: 0, queue: 0, archive: 0 }
  for (const { g, w } of weighted) {
    const tags = libraryItems.get(g.steam_app_id)?.tagWeights ?? []
    if (tags.length === 0) continue
    if (w > 0) basedOn[g.status === 'none' ? 'wishlist' : g.status === 'done' ? 'archive' : 'queue']++
    const top = tags[0].weight || 1
    for (const t of tags) profile.set(t.id, (profile.get(t.id) ?? 0) + w * (t.weight / top) * rarity(t.id))
  }
  if (profile.size === 0) return empty
  const profileNorm = Math.sqrt([...profile.values()].reduce((s, v) => s + v * v, 0)) || 1
  const topTagIds = [...profile.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id)

  // Seeds: half from the wishlist, half from what you played and liked, shuffled so each visit differs
  const liked = weighted.filter(x => x.w > 0 && libraryItems.has(x.g.steam_app_id))
  const wishSeeds = shuffled(liked.filter(x => x.g.status === 'none'))
  const playedPool = liked.filter(x => x.g.status !== 'none').sort((a, b) => b.w - a.w).slice(0, 20)
  const playedSeeds = [...playedPool.slice(0, 2), ...shuffled(playedPool.slice(2))]
  const seeds = [
    ...wishSeeds.slice(0, SEEDS_PER_SIDE),
    ...playedSeeds.slice(0, SEEDS_PER_SIDE),
    ...wishSeeds.slice(SEEDS_PER_SIDE),
    ...playedSeeds.slice(SEEDS_PER_SIDE),
  ].slice(0, SEEDS_PER_SIDE * 2)

  const narrowed = filters.tags.length > 0 || filters.cats.length > 0 || filters.deck || filters.sale || filters.free
  const base: StoreQuery = {
    tags: filters.tags, cats: filters.cats, deckVerified: filters.deck, onSale: filters.sale, free: filters.free,
    start: page * SEARCH_PAGE, count: SEARCH_PAGE,
  }
  const t = topTagIds.filter(id => !filters.tags.includes(id))
  const queries: StoreQuery[] = narrowed
    // The filters alone, then the filters crossed with each of your strongest tags
    ? [base, ...t.slice(0, 8).map(id => ({ ...base, tags: [...filters.tags, id] }))]
    : [[t[0], t[1]], [t[0], t[2]], [t[1], t[2]], [t[0], t[3]]]
        .map(q => q.filter(id => id != null))
        .filter(q => q.length > 0)
        .map(tags => ({ ...base, tags }))

  type Lookup = { seed: typeof seeds[number] | null; ids: number[] }
  const lookups = await mapLimit<() => Promise<Lookup>, Lookup>(
    [
      ...seeds.map(seed => async () => ({ seed, ids: await moreLikeThis(seed.g.steam_app_id).catch(() => []) })),
      ...queries.map(q => async () => ({ seed: null, ids: await searchStoreIds(q).catch(() => []) })),
    ],
    6,
    run => run()
  )

  const skip = new Set([...owned, ...dismissed])
  const pool = new Map<number, { from: typeof seeds; searched: boolean }>()
  for (const { seed, ids } of lookups) {
    for (const id of ids) {
      if (skip.has(id)) continue
      const entry = pool.get(id) ?? { from: [], searched: false }
      if (seed) entry.from.push(seed)
      else entry.searched = true
      pool.set(id, entry)
    }
  }
  const candidateIds = [...pool.entries()]
    // With filters on, search hits are the ones known to match, so they go first
    .sort((a, b) => (narrowed ? Number(b[1].searched) - Number(a[1].searched) : 0) || b[1].from.length - a[1].from.length)
    .slice(0, MAX_CANDIDATES)
    .map(([id]) => id)
  const items = await richItems(candidateIds)

  const scored: Array<{ score: number; s: Suggestion }> = []
  for (const id of candidateIds) {
    const item = items.get(id)
    if (!item || item.type !== 0 || item.tagWeights.length === 0) continue
    // Free teaser builds are listed as full games and would crowd out the real thing
    if (/\b(prologue|demo|playtest)\b/i.test(item.name)) continue
    // Enough reviews to judge, and people mostly don't like it
    if (item.reviewCount >= 30 && (item.reviewPct ?? 0) < 60) continue
    if (!passes(item, filters)) continue

    const top = item.tagWeights[0].weight || 1
    let dot = 0
    let norm = 0
    const pulls: Array<{ id: number; pull: number }> = []
    for (const tag of item.tagWeights) {
      const c = (tag.weight / top) * rarity(tag.id)
      const pull = c * (profile.get(tag.id) ?? 0)
      dot += pull
      norm += c * c
      if (pull > 0) pulls.push({ id: tag.id, pull })
    }
    const similarity = dot / (Math.sqrt(norm) * profileNorm)
    // Without filters, anything that doesn't fit your taste is noise. With them, you asked for it.
    if (similarity <= 0 && !narrowed) continue

    const quality = item.reviewCount >= 30 ? 0.55 + 0.5 * ((item.reviewPct ?? 0) / 100) : 0.8
    const from = pool.get(id)?.from ?? []
    const boost = quality * (1 + 0.12 * Math.min(4, from.length))
    const score = similarity > 0 ? similarity * boost : similarity / boost

    scored.push({
      score,
      s: {
        appid: id,
        name: item.name,
        price: item.price ?? 'N/A',
        image_url: item.header ?? item.capsule ?? `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
        tags: item.tags,
        description: item.description ?? '',
        because: [...from].sort((a, b) => b.w - a.w).slice(0, 2).map(x => ({ name: x.g.name, wishlist: x.g.status === 'none' })),
        match: pulls.sort((a, b) => b.pull - a.pull).slice(0, 3).map(p => names.get(p.id)).filter((n): n is string => !!n),
        review_pct: item.reviewCount >= 30 ? item.reviewPct : null,
        discount_pct: item.discountPct,
        year: item.released && !item.comingSoon ? new Date(item.released * 1000).getUTCFullYear() : null,
        coming_soon: item.comingSoon,
        screenshots: [],
      },
    })
  }

  scored.sort((a, b) => b.score - a.score)
  const suggestions = scored.slice(0, MAX_RESULTS).map(x => x.s)
  // Screenshots only for the ones that made the cut
  const shots = await getStoreItems(suggestions.map(s => s.appid), { screenshots: true })
  for (const s of suggestions) s.screenshots = shots.get(s.appid)?.screenshots ?? []

  return {
    suggestions,
    basedOn,
    topTags: topTagIds.slice(0, 6).map(id => names.get(id)).filter((n): n is string => !!n),
  }
}
