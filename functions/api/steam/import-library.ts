import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const FETCH_TIMEOUT = 8000
const MAX_GAMES = 50

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
  const { profileUrl } = await request.json() as { profileUrl: string }
  if (!profileUrl) return Response.json({ error: 'Missing profileUrl' }, { status: 400 })

  try {
    // Resolve Steam ID from profile URL
    let steamId: string | null = null

    const idMatch = profileUrl.match(/\/profiles\/(\d+)/)
    if (idMatch) {
      steamId = idMatch[1]
    } else {
      const vanityMatch = profileUrl.match(/\/id\/([^/]+)/)
      if (vanityMatch) {
        const res = await fetchT(
          `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?vanityurl=${vanityMatch[1]}`
        )
        if (res.ok) {
          const data = await res.json() as { response: { steamid?: string; success: number } }
          if (data.response.success === 1) steamId = data.response.steamid ?? null
        }
      }
    }

    if (!steamId) return Response.json({ error: 'Could not resolve Steam profile URL' }, { status: 400 })

    // Fetch owned games via Steam Web API (no key needed for public profiles)
    const libRes = await fetchT(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`
    )
    if (!libRes.ok) {
      return Response.json({ error: `Steam API error: ${libRes.status}` }, { status: 502 })
    }

    const libData = await libRes.json() as {
      response?: {
        games?: Array<{ appid: number; name: string; playtime_forever: number; img_logo_url: string }>
      }
    }

    const games = libData.response?.games ?? []
    // Sort by playtime descending, take top MAX_GAMES
    const sorted = games
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, MAX_GAMES)

    let added = 0
    let skipped = 0
    const results: Array<{ id: string; name: string }> = []

    for (const g of sorted) {
      const existing = await env.DB.prepare('SELECT id FROM games WHERE steam_app_id = ?')
        .bind(g.appid).first()
      if (existing) { skipped++; continue }

      const maxPos = await env.DB.prepare('SELECT MAX(queue_position) as mp FROM games').first() as { mp: number | null } | null
      const queue_position = (maxPos?.mp ?? 0) + 1000
      const id = crypto.randomUUID()
      const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`
      const steamUrl = `https://store.steampowered.com/app/${g.appid}/`
      const hoursPlayed = Math.round(g.playtime_forever / 60 * 10) / 10

      await env.DB.prepare(`
        INSERT INTO games (id, steam_app_id, name, image_url, status, queue_position, tags, hours_played, date_added, is_custom, steam_url, date_completed)
        VALUES (?, ?, ?, ?, 'done', ?, '[]', ?, ?, 0, ?, ?)
      `).bind(
        id, g.appid, g.name, imageUrl,
        queue_position, hoursPlayed,
        new Date().toISOString(), steamUrl,
        new Date().toISOString()
      ).run()

      results.push({ id, name: g.name })
      added++
    }

    return Response.json({ added, skipped, total: games.length, games: results })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
