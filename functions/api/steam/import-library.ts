import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const FETCH_TIMEOUT = 10000
const MAX_GAMES = 100

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
  const { profileUrl } = await request.json() as { profileUrl: string }
  if (!profileUrl) return Response.json({ error: 'Missing profileUrl' }, { status: 400 })

  const apiKey = request.headers.get('x-steam-api-key') ?? ''
  if (!apiKey) {
    return Response.json({ error: 'Steam API key required. Add your key in Settings → Steam API Key.' }, { status: 400 })
  }

  try {
    // Resolve steamid64
    let steamId: string | null = null

    const profileIdMatch = profileUrl.match(/\/profiles\/(\d{17})/)
    const vanityMatch = profileUrl.match(/steamcommunity\.com\/id\/([^/?#]+)/)

    if (profileIdMatch) {
      steamId = profileIdMatch[1]
    } else if (vanityMatch) {
      steamId = await resolveVanityUrl(vanityMatch[1], apiKey)
    }

    if (!steamId) {
      return Response.json({ error: 'Could not resolve Steam profile URL. Check the URL.' }, { status: 400 })
    }

    // Use official GetOwnedGames API — requires API key but works reliably from CF IPs
    const libRes = await fetchT(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`
    )

    if (!libRes.ok) {
      return Response.json({ error: `Steam API returned HTTP ${libRes.status}. Check your API key.` }, { status: 502 })
    }

    const libData = await libRes.json() as {
      response?: {
        game_count?: number
        games?: Array<{ appid: number; name: string; playtime_forever: number }>
      }
    }

    const games = libData.response?.games
    if (!games || games.length === 0) {
      return Response.json({
        error: 'No games found. Make sure your Steam "Game details" privacy setting is set to Public, and the API key is valid.'
      }, { status: 400 })
    }

    // Sort by playtime desc, take top MAX_GAMES
    const sorted = games
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, MAX_GAMES)

    let added = 0, skipped = 0
    const results: Array<{ id: string; name: string }> = []

    for (const g of sorted) {
      const existing = await env.DB.prepare('SELECT id FROM games WHERE steam_app_id = ?')
        .bind(g.appid).first()
      if (existing) { skipped++; continue }

      const maxPos = await env.DB.prepare('SELECT MAX(queue_position) as mp FROM games').first() as { mp: number | null } | null
      const queue_position = (maxPos?.mp ?? 0) + 1000
      const id = crypto.randomUUID()
      const hoursPlayed = Math.round(g.playtime_forever / 60 * 10) / 10

      await env.DB.prepare(`
        INSERT INTO games (id, steam_app_id, name, image_url, status, queue_position, tags, hours_played, date_added, is_custom, steam_url, date_completed)
        VALUES (?, ?, ?, ?, 'done', ?, '[]', ?, ?, 0, ?, ?)
      `).bind(
        id, g.appid, g.name,
        `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
        queue_position, hoursPlayed,
        new Date().toISOString(),
        `https://store.steampowered.com/app/${g.appid}/`,
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
