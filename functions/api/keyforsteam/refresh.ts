import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

export async function scrapeKeyPrice(
  name: string,
  _appid: number,
  existingUrl: string | null
): Promise<{ price: string; url: string } | null> {
  // Try direct URL construction first
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

  const directUrl = `https://www.keyforsteam.de/${slug}-key-kaufen-preisvergleich/`
  const urlsToTry = [
    existingUrl,
    directUrl,
  ].filter(Boolean) as string[]

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)',
          'Accept-Language': 'de,en;q=0.9',
        },
      })
      if (!res.ok) continue

      const html = await res.text()
      // Look for price patterns like €12.49 or EUR 12.49
      const priceMatch = html.match(/€\s*(\d+[.,]\d{2})/)?.[0]
        ?? html.match(/(\d+[.,]\d{2})\s*€/)?.[0]
        ?? html.match(/EUR\s*(\d+[.,]\d{2})/)?.[0]

      if (priceMatch) {
        const price = priceMatch.replace(/\s/g, '')
        return { price, url }
      }
    } catch {
      // continue
    }
  }

  // Try search
  try {
    const searchRes = await fetch(
      `https://www.keyforsteam.de/katalog/?q=${encodeURIComponent(name)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)',
          'Accept-Language': 'de,en;q=0.9',
        },
      }
    )
    if (searchRes.ok) {
      const html = await searchRes.text()
      const linkMatch = html.match(/href="(https:\/\/www\.keyforsteam\.de\/[^"]*key-kaufen[^"]*)"/i)
      if (linkMatch) {
        const pageUrl = linkMatch[1]
        const pageRes = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GameQueue/1.0)',
            'Accept-Language': 'de,en;q=0.9',
          },
        })
        if (pageRes.ok) {
          const pageHtml = await pageRes.text()
          const priceMatch = pageHtml.match(/€\s*(\d+[.,]\d{2})/)?.[0]
          if (priceMatch) {
            return { price: priceMatch.replace(/\s/g, ''), url: pageUrl }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null
}

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT id, steam_app_id, name, key_price_url FROM games WHERE is_custom = 0 AND steam_app_id IS NOT NULL"
  ).all()

  let updated = 0
  for (const game of results as { id: string; steam_app_id: number; name: string; key_price_url: string | null }[]) {
    try {
      const newPrice = await scrapeKeyPrice(game.name, game.steam_app_id, game.key_price_url)
      if (newPrice) {
        await env.DB.prepare(
          "UPDATE games SET key_price = ?, key_price_url = ?, key_price_updated = ? WHERE id = ?"
        ).bind(newPrice.price, newPrice.url, new Date().toISOString(), game.id).run()
        updated++
      }
    } catch (e) {
      console.error(`Key price refresh failed for ${game.name}:`, e)
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  return Response.json({ updated })
}
