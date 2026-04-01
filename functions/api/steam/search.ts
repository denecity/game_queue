const STEAM_SEARCH_URL = 'https://store.steampowered.com/api/storesearch/'

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  if (!q) return Response.json({ error: 'Missing q' }, { status: 400 })

  try {
    const steamUrl = `${STEAM_SEARCH_URL}?term=${encodeURIComponent(q)}&l=english&cc=CH`
    const res = await fetch(steamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)',
        'Cookie': 'birthtime=0; mature_content=1',
      },
    })
    if (!res.ok) throw new Error(`Steam API ${res.status}`)

    const data = await res.json() as {
      items?: Array<{ id: number; name: string; price?: { final_formatted: string }; tiny_image?: string }>
    }

    const results = (data.items ?? []).slice(0, 10).map(item => ({
      appid: item.id,
      name: item.name,
      price: item.price?.final_formatted ?? 'N/A',
      image_url: item.tiny_image ?? `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/capsule_sm_120.jpg`,
      tags: [],
    }))

    return Response.json(results)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
