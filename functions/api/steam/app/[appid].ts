import { fetchT, BROWSER_UA } from '../../../../server/common'
import { getStoreItems } from '../../../../server/steam'

export const onRequestGet: PagesFunction = async ({ params }) => {
  const appid = params.appid as string

  try {
    const [res, spyData, storeItems] = await Promise.all([
      fetchT(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=CH&l=english`, {
        headers: { 'User-Agent': BROWSER_UA, Cookie: 'birthtime=0; mature_content=1' },
      }),
      fetchSteamSpy(parseInt(appid, 10)),
      getStoreItems([parseInt(appid, 10)]),
    ])
    if (!res.ok) throw new Error(`Steam API ${res.status}`)

    const data = await res.json() as Record<string, { success: boolean; data?: SteamAppData }>
    const appData = data[appid]
    if (!appData?.success || !appData.data) {
      return Response.json({ error: 'App not found' }, { status: 404 })
    }

    const d = appData.data
    const tags = [
      ...(d.genres?.map(g => g.description) ?? []),
      ...(d.categories?.slice(0, 3).map(c => c.description) ?? []),
    ].slice(0, 6)
    const item = storeItems.get(d.steam_appid)

    return Response.json({
      appid: d.steam_appid,
      name: d.name,
      price: d.is_free ? 'Free to Play' : (d.price_overview?.final_formatted ?? 'N/A'),
      // header_image carries the hashed asset path; the legacy /steam/apps/{id}/header.jpg 404s for newer apps
      image_url: d.header_image ?? item?.header ?? `https://cdn.akamai.steamstatic.com/steam/apps/${d.steam_appid}/header.jpg`,
      steam_url: `https://store.steampowered.com/app/${d.steam_appid}/`,
      description: d.short_description ?? '',
      player_count: spyData?.players_forever ?? null,
      player_count_recent: spyData?.players_2weeks ?? null,
      tags: tags.length > 0 ? tags : (spyData ? Object.keys(spyData.tags ?? {}).slice(0, 6) : []),
    })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}

interface SteamAppData {
  steam_appid: number
  name: string
  is_free: boolean
  header_image?: string
  price_overview?: { final_formatted: string }
  short_description?: string
  genres?: Array<{ description: string }>
  categories?: Array<{ description: string }>
}

interface SteamSpyData {
  players_forever: number
  players_2weeks: number
  tags: Record<string, number>
}

async function fetchSteamSpy(appid: number): Promise<SteamSpyData | null> {
  try {
    const res = await fetchT(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`, {}, 5000)
    if (!res.ok) return null
    return await res.json() as SteamSpyData
  } catch {
    return null
  }
}
