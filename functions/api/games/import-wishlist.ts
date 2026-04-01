import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  STEAM_API_KEY: string
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

async function resolveVanityUrl(vanity: string, apiKey: string): Promise<string | null> {
  const res = await fetchT(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${vanity}`
  )
  if (!res.ok) return null
  const data = await res.json() as { response: { steamid?: string; success: number } }
  return data.response.success === 1 ? (data.response.steamid ?? null) : null
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { url } = await request.json() as { url: string }
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 })

  const apiKey = env.STEAM_API_KEY ?? ''
  if (!apiKey) {
    return Response.json({ error: 'STEAM_API_KEY environment variable not set. Add it in Cloudflare Pages → Settings → Environment Variables.' }, { status: 500 })
  }

  try {
    // Resolve to steamid64 first (works for both vanity and direct id URLs)
    let steamId: string | null = null

    const profileIdMatch = url.match(/\/profiles\/(\d{17})/)
    const vanityMatch = url.match(/\/id\/([^/?#]+)/) ?? url.match(/wishlist\/id\/([^/?#]+)/)

    if (profileIdMatch) {
      steamId = profileIdMatch[1]
    } else if (vanityMatch) {
      steamId = await resolveVanityUrl(vanityMatch[1], apiKey)
    }

    if (!steamId) {
      return Response.json({ error: 'Could not resolve Steam profile. Check the URL.' }, { status: 400 })
    }

    // Fetch wishlist via steamid64 URL — more reliable than vanity URL from CF IPs
    const wishlistUrl = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`
    const wishRes = await fetchT(wishlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, */*',
        'Referer': 'https://store.steampowered.com/',
        'Cookie': 'birthtime=0; mature_content=1; lastagecheckage=1-0-1990',
      },
    })

    if (!wishRes.ok) {
      const body = await wishRes.text().catch(() => '')
      return Response.json({ error: `Steam returned HTTP ${wishRes.status}. Make sure your wishlist is set to Public. ${body.slice(0, 100)}` }, { status: 502 })
    }

    const contentType = wishRes.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      const preview = (await wishRes.text()).slice(0, 200)
      return Response.json({ error: `Steam returned non-JSON response. Wishlist may be private. Preview: ${preview}` }, { status: 502 })
    }

    const wishData = await wishRes.json() as Record<string, { name: string; priority: number }>
    const appIds = Object.keys(wishData)
    if (appIds.length === 0) {
      return Response.json({ added: 0, skipped: 0, games: [], scanned: 0, totalWishlistItems: 0 })
    }

    let added = 0, skipped = 0
    const games: Array<{ id: string; name: string }> = []
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
        if (!detailRes.ok) continue

        const detailData = await detailRes.json() as Record<string, {
          success: boolean
          data?: { name: string; is_free: boolean; price_overview?: { final_formatted: string }; genres?: Array<{ description: string }> }
        }>
        const appEntry = detailData[appId]
        if (!appEntry?.success || !appEntry.data) continue

        const d = appEntry.data
        const id = crypto.randomUUID()
        const maxPos = await env.DB.prepare('SELECT MAX(queue_position) as mp FROM games').first() as { mp: number | null } | null
        const queue_position = (maxPos?.mp ?? 0) + 1000

        await env.DB.prepare(`
          INSERT INTO games (id, steam_app_id, name, image_url, price, status, queue_position, tags, hours_played, date_added, is_custom, steam_url)
          VALUES (?, ?, ?, ?, ?, 'none', ?, ?, 0, ?, 0, ?)
        `).bind(
          id, parseInt(appId, 10), d.name,
          `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
          d.is_free ? 'Free to Play' : (d.price_overview?.final_formatted ?? 'N/A'),
          queue_position,
          JSON.stringify(d.genres?.map(g => g.description) ?? []),
          new Date().toISOString(),
          `https://store.steampowered.com/app/${appId}/`
        ).run()

        games.push({ id, name: d.name })
        added++
      } catch { /* skip */ }

      await new Promise(r => setTimeout(r, 300))
    }

    return Response.json({ added, skipped, scanned: Math.min(appIds.length, MAX_IMPORT), totalWishlistItems: appIds.length, truncated: appIds.length > MAX_IMPORT, games })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
