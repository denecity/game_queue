import { fetchT, mapLimit, BROWSER_UA, type Env } from './common'
import { getStoreItems, searchStore } from './steam'
import { itadArtByTitle } from './itad'

export interface ImageTarget {
  id: string
  name: string
  steam_app_id: number | null
  steam_url: string | null
  /** The cover the game has now, if any */
  image_url?: string | null
}

export interface CoverOption {
  url: string
  label: string
}

// A Pages Function may make 50 subrequests. One repair call spends 1 on Steam's batch lookup,
// up to HEAD_BUDGET on checking links, and up to 5 per off-Steam search.
const HEAD_BUDGET = 30
const SEARCH_BUDGET = 3

function normalize(s: string): string {
  return s.toLowerCase().replace(/[™®©]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

const legacyHeader = (appid: number) => `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`
const isSteamStore = (url: string | null) => !!url && /store\.steampowered\.com/.test(url)
const isSteamCdn = (url: string) => /steamstatic\.com\//.test(url)

/** Whether a link serves a picture right now. Steam keeps handing out asset paths that 404. */
export async function loads(url: string): Promise<boolean> {
  try {
    let res = await fetchT(url, { method: 'HEAD', headers: { 'User-Agent': BROWSER_UA } }, 6000)
    if (res.status === 403 || res.status === 405) {
      // Some hosts refuse HEAD; ask for the first byte instead
      res = await fetchT(url, { headers: { 'User-Agent': BROWSER_UA, Range: 'bytes=0-0' } }, 6000)
      res.body?.cancel().catch(() => {})
    }
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')
  } catch {
    return false
  }
}

/** og:image / twitter:image from any web page, made absolute. */
async function scrapePageImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetchT(pageUrl, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } }, 8000)
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null
    const html = (await res.text()).slice(0, 200_000)
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    ]
    for (const p of patterns) {
      const m = html.match(p)
      if (m) return new URL(m[1].replace(/&amp;/g, '&'), pageUrl).toString()
    }
  } catch {
    // unreachable page
  }
  return null
}

/**
 * Art from outside the game's own Steam assets: its store page, a Steam game of exactly the same name,
 * then IsThereAnyDeal. Names must match exactly, since a wrong game's cover is worse than a drawn one.
 */
async function findElsewhere(t: ImageTarget, env: Env, skip?: string): Promise<string | null> {
  const usable = async (url: string | null | undefined) => !!url && url !== skip && await loads(url)

  if (t.steam_url && !isSteamStore(t.steam_url)) {
    const url = await scrapePageImage(t.steam_url)
    if (await usable(url)) return url
  }

  const wanted = normalize(t.name)
  try {
    const hit = (await searchStore(t.name, 5)).find(h => normalize(h.name) === wanted && h.appid !== t.steam_app_id)
    if (hit) {
      const found = (await getStoreItems([hit.appid])).get(hit.appid)
      const url = found?.header ?? found?.capsule ?? hit.image_url
      if (url && url !== skip) return url
    }
  } catch {
    // search unavailable
  }

  if (env.ITAD_API_KEY) {
    const art = (await itadArtByTitle(t.name, env.ITAD_API_KEY)).find(a => normalize(a.title) === wanted)
    if (art && art.url !== skip) return art.url
  }
  return null
}

/**
 * Find a working picture for each game: Steam header → other Steam art → legacy header path →
 * store page, same-named Steam game, IsThereAnyDeal. Every Steam link is checked before it is returned.
 * A cover that still works is kept, so a picture you chose yourself is never swapped out.
 * `failed` holds links the browser already couldn't show, so they aren't handed straight back.
 * A game maps to null only when nothing was found; the client then draws a generated cover.
 */
export async function resolveImages(
  targets: ImageTarget[],
  env: Env,
  failed: Record<string, string> = {}
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  const items = await getStoreItems(targets.filter(t => t.steam_app_id).map(t => t.steam_app_id!))
  let heads = 0
  let searches = 0

  await mapLimit(targets, 6, async t => {
    const skip = failed[t.id]
    let url: string | null = null

    if (t.image_url && t.image_url !== skip) {
      // Off Steam's CDN only the browser can say a link is dead: plenty of hosts turn a server away
      const alive = !isSteamCdn(t.image_url) || (heads++ < HEAD_BUDGET ? await loads(t.image_url) : true)
      if (alive) { out.set(t.id, t.image_url); return }
    }

    if (t.steam_app_id) {
      const item = items.get(t.steam_app_id)
      const candidates = [item?.header, item?.art.wideCapsule, item?.art.smallCapsule, legacyHeader(t.steam_app_id)]
        .filter((u): u is string => !!u && u !== skip)
      for (const candidate of candidates) {
        if (heads >= HEAD_BUDGET) {
          // Out of checks: Steam's own answer is still the best guess, the legacy path alone is not
          if (item && candidate !== legacyHeader(t.steam_app_id)) url = candidate
          break
        }
        heads++
        if (await loads(candidate)) { url = candidate; break }
      }
    }

    if (!url && searches < SEARCH_BUDGET) {
      searches++
      url = await findElsewhere(t, env, skip)
    }
    out.set(t.id, url)
  })

  return out
}

/** Everything that could serve as this game's cover, for the picker. The client drops any that fail to load. */
export async function coverOptions(t: ImageTarget, env: Env): Promise<CoverOption[]> {
  const options: CoverOption[] = []
  const add = (url: string | null | undefined, label: string) => {
    if (url && !options.some(o => o.url === url)) options.push({ url, label })
  }

  if (t.steam_app_id) {
    const item = (await getStoreItems([t.steam_app_id], { screenshots: true })).get(t.steam_app_id)
    add(item?.header, 'Steam header')
    add(item?.art.headerSharp, 'Header, sharper')
    add(item?.art.wideCapsule, 'Store capsule')
    add(item?.art.libraryHero, 'Library banner')
    item?.screenshots.forEach((s, i) => add(s, `Screenshot ${i + 1}`))
    if (!item) add(legacyHeader(t.steam_app_id), 'Steam header')
  }

  if (t.steam_url && !isSteamStore(t.steam_url)) add(await scrapePageImage(t.steam_url), 'From its store page')

  if (!t.steam_app_id) {
    // Not linked to Steam: show lookalikes with their names and let the user judge
    try {
      const hits = await searchStore(t.name, 4)
      const found = await getStoreItems(hits.map(h => h.appid))
      for (const h of hits) add(found.get(h.appid)?.header ?? h.image_url, `Steam: ${h.name}`)
    } catch {
      // search unavailable
    }
    if (env.ITAD_API_KEY) {
      for (const art of (await itadArtByTitle(t.name, env.ITAD_API_KEY)).slice(0, 3)) add(art.url, art.title)
    }
  }

  return options
}
