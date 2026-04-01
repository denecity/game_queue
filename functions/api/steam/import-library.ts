import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const FETCH_TIMEOUT = 10000
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

// Parse the public XML game list from steamcommunity.com/id/X/games/?tab=all&xml=1
// No API key required.
function parseGamesXml(xml: string): Array<{ appid: number; name: string; hoursForever: number }> {
  const games: Array<{ appid: number; name: string; hoursForever: number }> = []
  const gameBlocks = xml.match(/<game>([\s\S]*?)<\/game>/g) ?? []
  for (const block of gameBlocks) {
    const appidMatch = block.match(/<appID>(\d+)<\/appID>/)
    const nameMatch = block.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/) ?? block.match(/<name>(.*?)<\/name>/)
    const hoursMatch = block.match(/<hoursOnRecord>([\d,.]+)<\/hoursOnRecord>/)
    if (!appidMatch || !nameMatch) continue
    const hoursStr = hoursMatch?.[1]?.replace(',', '') ?? '0'
    games.push({
      appid: parseInt(appidMatch[1], 10),
      name: nameMatch[1],
      hoursForever: parseFloat(hoursStr) || 0,
    })
  }
  return games
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { profileUrl } = await request.json() as { profileUrl: string }
  if (!profileUrl) return Response.json({ error: 'Missing profileUrl' }, { status: 400 })

  try {
    // Build games XML URL — works for both /id/vanity/ and /profiles/steamid64/
    // No API key required for public profiles.
    let gamesXmlUrl: string

    const vanityMatch = profileUrl.match(/steamcommunity\.com\/id\/([^/?#]+)/)
    const profileIdMatch = profileUrl.match(/steamcommunity\.com\/profiles\/(\d+)/)

    if (vanityMatch) {
      gamesXmlUrl = `https://steamcommunity.com/id/${vanityMatch[1]}/games/?tab=all&xml=1`
    } else if (profileIdMatch) {
      gamesXmlUrl = `https://steamcommunity.com/profiles/${profileIdMatch[1]}/games/?tab=all&xml=1`
    } else {
      return Response.json({
        error: 'Invalid Steam profile URL. Use https://steamcommunity.com/id/USERNAME/ or .../profiles/STEAMID64/'
      }, { status: 400 })
    }

    const xmlRes = await fetchT(gamesXmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/xml,application/xml,*/*',
        'Referer': 'https://steamcommunity.com/',
      },
    })

    if (!xmlRes.ok) {
      return Response.json({ error: `Steam returned HTTP ${xmlRes.status}. Check that your profile URL is correct.` }, { status: 502 })
    }

    const xml = await xmlRes.text()

    // Steam returns an <error> node when game details are private
    if (xml.includes('<error>')) {
      const errMatch = xml.match(/<error>(.*?)<\/error>/)
      const detail = errMatch?.[1] ?? 'private profile'
      return Response.json({
        error: `Steam says: "${detail}". To fix: Steam → Edit Profile → Privacy Settings → set "Game details" to Public.`
      }, { status: 400 })
    }

    if (!xml.includes('<games>')) {
      return Response.json({
        error: 'No game library found. Make sure the URL is a valid Steam profile and "Game details" is set to Public in your Steam privacy settings.'
      }, { status: 400 })
    }

    const allGames = parseGamesXml(xml)
    const sorted = allGames
      .sort((a, b) => b.hoursForever - a.hoursForever)
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

      await env.DB.prepare(`
        INSERT INTO games (id, steam_app_id, name, image_url, status, queue_position, tags, hours_played, date_added, is_custom, steam_url, date_completed)
        VALUES (?, ?, ?, ?, 'done', ?, '[]', ?, ?, 0, ?, ?)
      `).bind(
        id, g.appid, g.name,
        `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
        queue_position, g.hoursForever,
        new Date().toISOString(),
        `https://store.steampowered.com/app/${g.appid}/`,
        new Date().toISOString()
      ).run()

      results.push({ id, name: g.name })
      added++
    }

    return Response.json({ added, skipped, total: allGames.length, games: results })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
