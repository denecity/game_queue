export const onRequestGet: PagesFunction = async ({ params }) => {
  const appid = params.appid as string

  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=CH&l=english`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)',
          'Cookie': 'birthtime=0; mature_content=1',
        },
      }
    )
    if (!res.ok) throw new Error(`Steam API ${res.status}`)

    const data = await res.json() as Record<string, { success: boolean; data?: SteamAppData }>
    const appData = data[appid]
    if (!appData?.success || !appData.data) {
      return Response.json({ error: 'App not found' }, { status: 404 })
    }

    const d = appData.data
    const tags = [
      ...(d.genres?.map((g: { description: string }) => g.description) ?? []),
      ...(d.categories?.slice(0, 3).map((c: { description: string }) => c.description) ?? []),
    ].slice(0, 6)

    const result = {
      appid: d.steam_appid,
      name: d.name,
      price: d.is_free ? 'Free to Play' : (d.price_overview?.final_formatted ?? 'N/A'),
      image_url: `https://cdn.akamai.steamstatic.com/steam/apps/${d.steam_appid}/header.jpg`,
      steam_url: `https://store.steampowered.com/app/${d.steam_appid}/`,
      tags,
      description: d.short_description ?? '',
    }

    // Fetch SteamSpy data in parallel
    const spyData = await fetchSteamSpy(parseInt(appid, 10))

    return Response.json({
      ...result,
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
    const res = await fetch(
      `https://steamspy.com/api.php?request=appdetails&appid=${appid}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)' } }
    )
    if (!res.ok) return null
    return await res.json() as SteamSpyData
  } catch {
    return null
  }
}
