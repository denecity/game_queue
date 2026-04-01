import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const MAX_IMPORT_ITEMS = 8
const FETCH_TIMEOUT_MS = 8000

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function parseJsonOrThrow<T>(res: Response, source: string): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  const bodyText = await res.text()

  if (!res.ok) {
    throw new Error(`${source} HTTP ${res.status}`)
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`${source} returned non-JSON response`)
  }

  try {
    return JSON.parse(bodyText) as T
  } catch {
    throw new Error(`${source} returned invalid JSON`)
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { url } = await request.json() as { url: string }
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 })

  try {
    // Extract steam ID or vanity name from URL
    const steamIdMatch = url.match(/wishlist\/profiles?\/(\d+)/)
    const vanityMatch = url.match(/wishlist\/id\/([^/]+)/)

    let wishlistUrl: string
    if (steamIdMatch) {
      wishlistUrl = `https://store.steampowered.com/wishlist/profiles/${steamIdMatch[1]}/wishlistdata/`
    } else if (vanityMatch) {
      // Need to resolve vanity URL first — use public API
      const vanityRes = await fetchWithTimeout(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?vanityurl=${vanityMatch[1]}`
      )
      const vanityData = await parseJsonOrThrow<{ response: { steamid?: string; success: number } }>(
        vanityRes,
        'ResolveVanityURL'
      )
      if (vanityData.response.success !== 1 || !vanityData.response.steamid) {
        return Response.json({ error: 'Could not resolve Steam vanity URL' }, { status: 400 })
      }
      wishlistUrl = `https://store.steampowered.com/wishlist/profiles/${vanityData.response.steamid}/wishlistdata/`
    } else {
      return Response.json({ error: 'Invalid Steam wishlist URL' }, { status: 400 })
    }

    const wishRes = await fetchWithTimeout(wishlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)',
        'Cookie': 'birthtime=0; mature_content=1',
      },
    })
    const wishData = await parseJsonOrThrow<Record<string, { name: string; priority: number }>>(
      wishRes,
      'Wishlist data'
    )
    const appIds = Object.keys(wishData)

    let added = 0
    const games: Array<{ id: string; name: string }> = []
    const errors: string[] = []

    for (const appId of appIds.slice(0, MAX_IMPORT_ITEMS)) {
      // Check if already in DB
      const existing = await env.DB.prepare('SELECT id FROM games WHERE steam_app_id = ?')
        .bind(parseInt(appId, 10)).first()
      if (existing) continue

      try {
        const detailRes = await fetchWithTimeout(
          `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=CH&l=english`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)', 'Cookie': 'birthtime=0; mature_content=1' } }
        )
        const detailData = await parseJsonOrThrow<Record<string, { success: boolean; data?: { name: string; is_free: boolean; price_overview?: { final_formatted: string }; genres?: Array<{ description: string }> } }>>(
          detailRes,
          `App ${appId} details`
        )
        const appEntry = detailData[appId]
        if (!appEntry?.success || !appEntry.data) continue

        const d = appEntry.data
        const id = crypto.randomUUID()
        const maxPosResult = await env.DB.prepare('SELECT MAX(queue_position) as mp FROM games').first() as { mp: number | null } | null
        const queue_position = ((maxPosResult?.mp ?? 0) + 1000)

        const tags = d.genres?.map(g => g.description) ?? []
        await env.DB.prepare(`
          INSERT INTO games (id, steam_app_id, name, image_url, price, status, queue_position, tags, hours_played, date_added, is_custom, steam_url)
          VALUES (?, ?, ?, ?, ?, 'none', ?, ?, 0, ?, 0, ?)
        `).bind(
          id, parseInt(appId, 10), d.name,
          `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
          d.is_free ? 'Free to Play' : (d.price_overview?.final_formatted ?? 'N/A'),
          queue_position, JSON.stringify(tags),
          new Date().toISOString(),
          `https://store.steampowered.com/app/${appId}/`
        ).run()

        games.push({ id, name: d.name })
        added++
      } catch (err) {
        errors.push(`${appId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return Response.json({
      added,
      games,
      scanned: Math.min(appIds.length, MAX_IMPORT_ITEMS),
      totalWishlistItems: appIds.length,
      truncated: appIds.length > MAX_IMPORT_ITEMS,
      errors: errors.slice(0, 5),
    })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
