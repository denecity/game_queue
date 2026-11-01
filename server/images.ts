import { fetchT, BROWSER_UA, type Env } from './common'
import { getStoreItems, searchStore } from './steam'
import { itadAssetsByTitle } from './itad'

export interface ImageTarget {
  id: string
  name: string
  steam_app_id: number | null
  steam_url: string | null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[™®©]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
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
 * Find some picture for each game, best source first:
 * Steam store assets → the game's own store page → Steam search by name → IsThereAnyDeal art.
 * Returns null for a game only when every source came up empty; the client then draws a generated cover.
 */
export async function resolveImages(targets: ImageTarget[], env: Env): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()

  const withAppId = targets.filter(t => t.steam_app_id)
  const items = await getStoreItems(withAppId.map(t => t.steam_app_id!))
  for (const t of withAppId) {
    const item = items.get(t.steam_app_id!)
    const url = item?.header ?? item?.capsule
    if (url) out.set(t.id, url)
  }

  // Each fallback can cost a few subrequests; stay well under the 50-per-invocation limit
  let fallbacks = 0
  for (const t of targets) {
    if (out.has(t.id)) continue
    if (fallbacks++ >= 10) break
    let url: string | null = null

    if (t.steam_url && !/store\.steampowered\.com/.test(t.steam_url)) {
      url = await scrapePageImage(t.steam_url)
    }

    if (!url) {
      try {
        const wanted = normalize(t.name)
        const hits = await searchStore(t.name, 5)
        const hit = hits.find(h => normalize(h.name) === wanted)
          ?? hits.find(h => normalize(h.name).startsWith(wanted) || wanted.startsWith(normalize(h.name)))
        if (hit) {
          const found = (await getStoreItems([hit.appid])).get(hit.appid)
          url = found?.header ?? found?.capsule ?? hit.image_url ?? null
        }
      } catch {
        // search unavailable
      }
    }

    if (!url && env.ITAD_API_KEY) {
      url = await itadAssetsByTitle(t.name, env.ITAD_API_KEY)
    }

    out.set(t.id, url)
  }

  return out
}
