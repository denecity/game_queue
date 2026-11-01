import { fetchT, chunk } from './common'

// IsThereAnyDeal API: https://docs.isthereanydeal.com/
const ITAD = 'https://api.isthereanydeal.com'
const STEAM_SHOP_ID = 61

export interface ItadDeal {
  shop: string
  price: number
  regular: number
  currency: string
  cut: number
  url: string
}

export interface ItadPrices {
  id: string
  historyLow: number | null
  deals: ItadDeal[]
}

/** Map Steam appids to ITAD game ids. One request for up to 200 appids. */
export async function itadLookup(appids: number[], key: string): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  for (const ids of chunk(appids, 200)) {
    try {
      const res = await fetchT(`${ITAD}/lookup/id/shop/${STEAM_SHOP_ID}/v1?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids.map(id => `app/${id}`)),
      })
      if (!res.ok) continue
      const data = await res.json() as Record<string, string | null>
      for (const [k, v] of Object.entries(data)) {
        if (v) out.set(parseInt(k.replace('app/', ''), 10), v)
      }
    } catch {
      // ITAD unavailable; keyforsteam still runs
    }
  }
  return out
}

/** Current prices across official stores (Swiss region), cheapest first. */
export async function itadPrices(itadIds: string[], key: string): Promise<Map<string, ItadPrices>> {
  const out = new Map<string, ItadPrices>()
  for (const ids of chunk(itadIds, 200)) {
    try {
      const res = await fetchT(`${ITAD}/games/prices/v3?key=${key}&country=CH&nondeals=true&vouchers=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids),
      })
      if (!res.ok) continue
      const data = await res.json() as Array<{
        id: string
        historyLow?: { all?: { amount: number } | null }
        deals?: Array<{
          shop: { name: string }
          price: { amount: number; currency: string }
          regular: { amount: number }
          cut: number
          url: string
        }>
      }>
      for (const g of data) {
        out.set(g.id, {
          id: g.id,
          historyLow: g.historyLow?.all?.amount ?? null,
          deals: (g.deals ?? [])
            .map(d => ({
              shop: d.shop.name,
              price: d.price.amount,
              regular: d.regular.amount,
              currency: d.price.currency,
              cut: d.cut,
              url: d.url,
            }))
            .sort((a, b) => a.price - b.price),
        })
      }
    } catch {
      // skip this chunk
    }
  }
  return out
}

/** Best-guess cover art for a title that isn't on Steam. */
export async function itadAssetsByTitle(title: string, key: string): Promise<string | null> {
  try {
    const res = await fetchT(`${ITAD}/games/search/v1?key=${key}&title=${encodeURIComponent(title)}&results=3`)
    if (!res.ok) return null
    const hits = await res.json() as Array<{ assets?: Record<string, string> }>
    for (const h of hits) {
      const a = h.assets ?? {}
      const url = a.banner600 ?? a.banner400 ?? a.boxart ?? a.banner300
      if (url) return url
    }
  } catch {
    // ignore
  }
  return null
}
