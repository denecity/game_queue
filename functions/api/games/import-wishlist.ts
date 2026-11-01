import { fetchT, resolveSteamId, type Env } from '../../../server/common'
import { importSteamApps } from '../../../server/imports'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { url } = await request.json() as { url: string }
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 })

  const apiKey = env.STEAM_API_KEY ?? ''
  if (!apiKey && !/\/profiles\/\d{17}/.test(url)) {
    return Response.json({ error: 'STEAM_API_KEY is not set, so vanity URLs can\'t be resolved. Use a /profiles/<steamid64> URL or set the key.' }, { status: 500 })
  }

  try {
    const steamId = await resolveSteamId(url, apiKey)
    if (!steamId) {
      return Response.json({ error: 'Could not resolve Steam profile. Check the URL.' }, { status: 400 })
    }

    // The old store.steampowered.com/wishlist/.../wishlistdata endpoint is gone; this is its replacement.
    const res = await fetchT(`https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${steamId}`)
    if (!res.ok) {
      return Response.json({ error: `Steam returned HTTP ${res.status}.` }, { status: 502 })
    }
    const data = await res.json() as { response?: { items?: Array<{ appid: number; priority: number }> } }
    const items = (data.response?.items ?? []).sort((a, b) => a.priority - b.priority)
    if (items.length === 0) {
      return Response.json({ error: 'Wishlist is empty or private. Set it to Public in Steam privacy settings.' }, { status: 400 })
    }

    const outcome = await importSteamApps(env, items.map(i => ({ appid: i.appid })), 'none')
    return Response.json({ ...outcome, totalWishlistItems: items.length })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
