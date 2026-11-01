import { fetchT, chunk, BROWSER_UA } from './common'

const STEAM_ASSET_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/'

export interface StoreItem {
  appid: number
  name: string
  header: string | null
  capsule: string | null
  price: string | null
  tags: string[]
}

interface RawStoreItem {
  appid?: number
  id?: number
  success?: number
  name?: string
  is_free?: boolean
  tagids?: number[]
  assets?: {
    asset_url_format?: string
    header?: string
    main_capsule?: string
    small_capsule?: string
  }
  best_purchase_option?: { formatted_final_price?: string }
}

let tagNameCache: Map<number, string> | null = null

async function tagNames(): Promise<Map<number, string>> {
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
export async function getStoreItems(appids: number[], opts: { withTags?: boolean } = {}): Promise<Map<number, StoreItem>> {
  const out = new Map<number, StoreItem>()
  if (appids.length === 0) return out
  const names = opts.withTags ? await tagNames() : null

  for (const ids of chunk(appids, 100)) {
    const input = {
      ids: ids.map(appid => ({ appid })),
      context: { language: 'english', country_code: 'CH' },
      data_request: { include_assets: true, include_basic_info: true, include_tag_count: opts.withTags ? 6 : 0 },
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
          tags: names ? (item.tagids ?? []).map(id => names.get(id)).filter((n): n is string => !!n) : [],
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
