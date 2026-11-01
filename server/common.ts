import type { D1Database } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  STEAM_API_KEY?: string
  ITAD_API_KEY?: string
}

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function fetchT(url: string, init?: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

export function parseGame(row: Record<string, unknown>) {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    offers: row.offers ? JSON.parse(row.offers as string) : [],
    is_custom: row.is_custom === 1,
    hours_played: row.hours_played ?? 0,
  }
}

export async function nextQueuePosition(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT MAX(queue_position) as mp FROM games').first() as { mp: number | null } | null
  return (row?.mp ?? 0) + 1000
}

/** Run async work over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function resolveSteamId(url: string, apiKey: string): Promise<string | null> {
  const direct = url.match(/\/profiles\/(\d{17})/)
  if (direct) return direct[1]
  const vanity = url.match(/\/id\/([^/?#]+)/)
  if (!vanity) return /^\d{17}$/.test(url.trim()) ? url.trim() : null
  const res = await fetchT(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(vanity[1])}`
  )
  if (!res.ok) return null
  const data = await res.json() as { response: { steamid?: string; success: number } }
  return data.response.success === 1 ? (data.response.steamid ?? null) : null
}
