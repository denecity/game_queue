import { fetchT, resolveSteamId, type Env } from '../../../server/common'
import { importSteamApps } from '../../../server/imports'

const MAX_GAMES = 100

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { profileUrl } = await request.json() as { profileUrl: string }
  if (!profileUrl) return Response.json({ error: 'Missing profileUrl' }, { status: 400 })

  const apiKey = env.STEAM_API_KEY ?? ''
  if (!apiKey) {
    return Response.json({ error: 'STEAM_API_KEY environment variable not set. Add it in Cloudflare Pages → Settings → Environment Variables.' }, { status: 500 })
  }

  try {
    const steamId = await resolveSteamId(profileUrl, apiKey)
    if (!steamId) {
      return Response.json({ error: 'Could not resolve Steam profile URL. Check the URL.' }, { status: 400 })
    }

    const libRes = await fetchT(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`
    )
    if (!libRes.ok) {
      return Response.json({ error: `Steam API returned HTTP ${libRes.status}. Check your API key.` }, { status: 502 })
    }

    const libData = await libRes.json() as {
      response?: { games?: Array<{ appid: number; name: string; playtime_forever: number }> }
    }
    const games = libData.response?.games
    if (!games || games.length === 0) {
      return Response.json({
        error: 'No games found. Make sure your Steam "Game details" privacy setting is set to Public, and the API key is valid.'
      }, { status: 400 })
    }

    const top = games
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, MAX_GAMES)
      .map(g => ({ appid: g.appid, name: g.name, hours_played: Math.round(g.playtime_forever / 6) / 10 }))

    const outcome = await importSteamApps(env, top, 'done')
    return Response.json({ ...outcome, total: games.length })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
