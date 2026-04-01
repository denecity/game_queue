import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const FETCH_TIMEOUT = 10000

async function fetchT(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { url } = await request.json() as { url: string }
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 })

  try {
    // Build wishlist data URL directly — supports both /id/vanity/ and /profiles/steamid64/
    // No API key needed; Steam serves wishlistdata/ publicly for public wishlists
    let wishlistDataUrl: string

    const vanityMatch = url.match(/wishlist\/id\/([^/?#]+)/)
    const profileMatch = url.match(/wishlist\/profiles?\/(\d+)/)

    if (vanityMatch) {
      wishlistDataUrl = `https://store.steampowered.com/wishlist/id/${vanityMatch[1]}/wishlistdata/`
    } else if (profileMatch) {
      wishlistDataUrl = `https://store.steampowered.com/wishlist/profiles/${profileMatch[1]}/wishlistdata/`
    } else {
      return Response.json({ error: 'Invalid Steam wishlist URL. Use https://store.steampowered.com/wishlist/id/USERNAME/ or .../profiles/STEAMID64/' }, { status: 400 })
    }

    const wishRes = await fetchT(wishlistDataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://store.steampowered.com/',
        'Cookie': 'birthtime=0; mature_content=1; lastagecheckage=1-0-1990',
      },
    })

    if (!wishRes.ok) {
      return Response.json({ error: `Steam returned HTTP ${wishRes.status}. Make sure your wishlist is set to Public in Steam privacy settings.` }, { status: 502 })
    }

    const contentType = wishRes.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      const preview = (await wishRes.text()).slice(0, 200)
      return Response.json({ error: `Steam returned an HTML page instead of wishlist data. The wishlist may be private or Steam is rate-limiting. Preview: ${preview}` }, { status: 502 })
    }

    const wishData = await wishRes.json() as Record<string, { name: string; priority: number }>
    const appIds = Object.keys(wishData)

    if (appIds.length === 0) {
      return Response.json({ added: 0, games: [], scanned: 0, totalWishlistItems: 0 })
    }

    let added = 0
    let skipped = 0
    const games: Array<{ id: string; name: string }> = []
    const errors: string[] = []
    const MAX_IMPORT = 50

    for (const appId of appIds.slice(0, MAX_IMPORT)) {
      const existing = await env.DB.prepare('SELECT id FROM games WHERE steam_app_id = ?')
        .bind(parseInt(appId, 10)).first()
      if (existing) { skipped++; continue }

      try {
        const detailRes = await fetchT(
          `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=CH&l=english`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)', 'Cookie': 'birthtime=0; mature_content=1' } }
        )
        if (!detailRes.ok) { errors.push(`${appId}: HTTP ${detailRes.status}`); continue }

        const detailData = await detailRes.json() as Record<string, {
          success: boolean
          data?: { name: string; is_free: boolean; price_overview?: { final_formatted: string }; genres?: Array<{ description: string }> }
        }>
        const appEntry = detailData[appId]
        if (!appEntry?.success || !appEntry.data) { errors.push(`${appId}: no data`); continue }

        const d = appEntry.data
        const id = crypto.randomUUID()
        const maxPos = await env.DB.prepare('SELECT MAX(queue_position) as mp FROM games').first() as { mp: number | null } | null
        const queue_position = (maxPos?.mp ?? 0) + 1000
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

      // Be polite to Steam API
      await new Promise(r => setTimeout(r, 300))
    }

    return Response.json({
      added, skipped,
      scanned: Math.min(appIds.length, MAX_IMPORT),
      totalWishlistItems: appIds.length,
      truncated: appIds.length > MAX_IMPORT,
      errors: errors.slice(0, 5),
      games,
    })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
