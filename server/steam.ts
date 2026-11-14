import { fetchT, chunk, BROWSER_UA } from './common'

const STEAM_ASSET_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/'

export interface StoreItem {
  appid: number
  name: string
  header: string | null
  capsule: string | null
  price: string | null
  tags: string[]
  /** Steam's 0 = game; demos, DLC, soundtracks etc. have other values */
  type: number
  /** Only filled when `rich` is requested */
  tagWeights: Array<{ id: number; weight: number }>
  description: string | null
  reviewCount: number
  reviewPct: number | null
  discountPct: number | null
  /** Unix seconds; null when unknown or not out yet */
  released: number | null
  comingSoon: boolean
  /** Steam category ids: player modes (2 singleplayer, 9 co-op, 39 couch co-op…), features, controller support (28 = full) */
  categories: number[]
  deckVerified: boolean
  /** Only filled when `screenshots` is requested: small 600x338 versions, in store order */
  screenshots: string[]
}

interface RawStoreItem {
  appid?: number
  id?: number
  success?: number
  name?: string
  is_free?: boolean
  type?: number
  tagids?: number[]
  tags?: Array<{ tagid: number; weight: number }>
  basic_info?: { short_description?: string }
  reviews?: { summary_filtered?: { review_count?: number; percent_positive?: number } }
  release?: { steam_release_date?: number; is_coming_soon?: boolean }
  categories?: { supported_player_categoryids?: number[]; feature_categoryids?: number[]; controller_categoryids?: number[] }
  platforms?: { steam_deck_compat_category?: number }
  screenshots?: { all_ages_screenshots?: Array<{ filename: string; ordinal: number }> }
  assets?: {
    asset_url_format?: string
    header?: string
    main_capsule?: string
    small_capsule?: string
  }
  best_purchase_option?: { formatted_final_price?: string; discount_pct?: number }
}

let tagNameCache: Map<number, string> | null = null

/** Steam's tag list, most widely used first (Indie, Action, Adventure…). The Map keeps that order. */
export async function tagNames(): Promise<Map<number, string>> {
  if (tagNameCache) return tagNameCache
  try {
    const res = await fetchT('https://store.steampowered.com/tagdata/populartags/english')
    const list = await res.json() as { tagid: number; name: string }[]
    tagNameCache = new Map(list.map(t => [t.tagid, t.name]))
  } catch {
    tagNameCache = new Map()
  }
  return tagNameCache
}

function assetUrl(format: string | undefined, file: string | undefined): string | null {
  if (!format || !file) return null
  return STEAM_ASSET_BASE + format.replace('${FILENAME}', file)
}

/**
 * Batch lookup of Steam store items. One subrequest per 100 apps, no API key needed.
 * Returns the hashed asset URLs that newer apps require (the legacy /steam/apps/{id}/header.jpg 404s for them).
 */
export async function getStoreItems(
  appids: number[],
  opts: {
    withTags?: boolean
    /** 20 weighted tags, review summary and release date, for recommendations */
    rich?: boolean
    screenshots?: boolean
  } = {}
): Promise<Map<number, StoreItem>> {
  const out = new Map<number, StoreItem>()
  if (appids.length === 0) return out
  const names = opts.withTags || opts.rich ? await tagNames() : null
  const tagCount = opts.rich ? 20 : opts.withTags ? 6 : 0

  for (const ids of chunk(appids, 100)) {
    const input = {
      ids: ids.map(appid => ({ appid })),
      context: { language: 'english', country_code: 'CH' },
      data_request: { include_assets: true, include_basic_info: true, include_tag_count: tagCount, include_reviews: !!opts.rich, include_release: !!opts.rich, include_platforms: !!opts.rich, include_screenshots: !!opts.screenshots },
    }
    try {
      const res = await fetchT(
        `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
        { headers: { 'User-Agent': BROWSER_UA } }
      )
      if (!res.ok) continue
      const data = await res.json() as { response?: { store_items?: RawStoreItem[] } }
      for (const item of data.response?.store_items ?? []) {
        const appid = item.appid ?? item.id
        if (!appid || item.success !== 1 || !item.name) continue
        const fmt = item.assets?.asset_url_format
        out.set(appid, {
          appid,
          name: item.name,
          header: assetUrl(fmt, item.assets?.header),
          capsule: assetUrl(fmt, item.assets?.main_capsule) ?? assetUrl(fmt, item.assets?.small_capsule),
          price: item.is_free ? 'Free to Play' : (item.best_purchase_option?.formatted_final_price ?? null),
          tags: names ? (item.tagids ?? []).slice(0, 6).map(id => names.get(id)).filter((n): n is string => !!n) : [],
          type: item.type ?? 0,
          tagWeights: opts.rich ? (item.tags ?? []).map(t => ({ id: t.tagid, weight: t.weight })) : [],
          description: item.basic_info?.short_description ?? null,
          reviewCount: item.reviews?.summary_filtered?.review_count ?? 0,
          reviewPct: item.reviews?.summary_filtered?.review_count ? (item.reviews.summary_filtered.percent_positive ?? null) : null,
          discountPct: item.best_purchase_option?.discount_pct || null,
          released: item.release?.steam_release_date || null,
          comingSoon: !!item.release?.is_coming_soon,
          categories: [
            ...(item.categories?.supported_player_categoryids ?? []),
            ...(item.categories?.feature_categoryids ?? []),
            ...(item.categories?.controller_categoryids ?? []),
          ],
          deckVerified: item.platforms?.steam_deck_compat_category === 3,
          screenshots: (item.screenshots?.all_ages_screenshots ?? [])
            .sort((a, b) => a.ordinal - b.ordinal)
            .slice(0, 5)
            .map(s => STEAM_ASSET_BASE + s.filename.replace(/\.jpg(?=\?|$)/, '.600x338.jpg')),
        })
      }
    } catch {
      // Leave this chunk out; callers fall back to whatever they already have
    }
  }
  return out
}

export interface SearchHit {
  appid: number
  name: string
  price: string
  image_url: string
}

export async function searchStore(term: string, limit = 10): Promise<SearchHit[]> {
  const res = await fetchT(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=CH`,
    { headers: { 'User-Agent': BROWSER_UA, Cookie: 'birthtime=0; mature_content=1' } }
  )
  if (!res.ok) throw new Error(`Steam search ${res.status}`)
  const data = await res.json() as {
    items?: Array<{ id: number; name: string; price?: { final: number; currency: string }; tiny_image?: string }>
  }
  return (data.items ?? []).slice(0, limit).map(item => ({
    appid: item.id,
    name: item.name,
    price: item.price ? `${item.price.currency} ${(item.price.final / 100).toFixed(2)}` : 'N/A',
    image_url: item.tiny_image ?? '',
  }))
}

/** Steam's own "More like this" list for an app, as shown on its store page. */
export async function moreLikeThis(appid: number): Promise<number[]> {
  const res = await fetchT(`https://store.steampowered.com/recommended/morelike/app/${appid}/`, {
    headers: { 'User-Agent': BROWSER_UA, Cookie: 'birthtime=0; mature_content=1' },
  }, 8000)
  if (!res.ok) return []
  const html = await res.text()
  const ids = new Set<number>()
  for (const m of html.matchAll(/data-ds-appid="(\d+)"/g)) ids.add(parseInt(m[1], 10))
  ids.delete(appid)
  return [...ids]
}

export interface StoreQuery {
  /** Steam tag ids; a game must carry all of them */
  tags?: number[]
  /** Steam category ids (player modes, controller support…); a game must have all of them */
  cats?: number[]
  deckVerified?: boolean
  onSale?: boolean
  free?: boolean
  start?: number
  count?: number
}

// Steam's search takes feature categories and player-mode categories in separate parameters
const FEATURE_CATS = new Set([18, 28, 44])

/** App ids of games matching the query, in Steam's default relevance order. */
export async function searchStoreIds(q: StoreQuery): Promise<number[]> {
  const params = new URLSearchParams({ category1: '998', json: '1', cc: 'CH', l: 'english', count: String(q.count ?? 50) })
  if (q.tags?.length) params.set('tags', q.tags.join(','))
  const features = (q.cats ?? []).filter(c => FEATURE_CATS.has(c))
  const players = (q.cats ?? []).filter(c => !FEATURE_CATS.has(c))
  if (features.length) params.set('category2', features.join(','))
  if (players.length) params.set('category3', players.join(','))
  if (q.deckVerified) params.set('deck_compatibility', '3')
  if (q.onSale) params.set('specials', '1')
  if (q.free) params.set('maxprice', 'free')
  if (q.start) params.set('start', String(q.start))

  const res = await fetchT(`https://store.steampowered.com/search/results/?${params}`, {
    headers: { 'User-Agent': BROWSER_UA, Cookie: 'birthtime=0; mature_content=1' },
  }, 8000)
  if (!res.ok) return []
  const data = await res.json() as { items?: Array<{ logo?: string }> }
  const ids: number[] = []
  for (const item of data.items ?? []) {
    const m = item.logo?.match(/\/apps\/(\d+)\//)
    if (m) ids.push(parseInt(m[1], 10))
  }
  return ids
}
