import { readLocal, writeLocal } from './utils'

// Ambient colour pulled from each game's cover art, cached so we only sample an image once.
const CACHE_KEY = 'gq_art_colors'
const cache: Record<string, string> = readLocal(CACHE_KEY, {})
const pending = new Map<string, Promise<string | null>>()
let saveTimer: ReturnType<typeof setTimeout> | null = null

function persist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => writeLocal(CACHE_KEY, cache), 1000)
}

export function cachedArtColor(url: string | null): string | null {
  return url ? cache[url] ?? null : null
}

/** Most vivid mid-bright colour in the image, as "r g b" (for rgb(var / alpha) use). */
export function artColor(url: string): Promise<string | null> {
  if (cache[url]) return Promise.resolve(cache[url])
  const inflight = pending.get(url)
  if (inflight) return inflight

  const p = new Promise<string | null>(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const w = 24, h = 12
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        let best = { score: -1, r: 120, g: 120, b: 160 }
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          const sat = max === 0 ? 0 : (max - min) / max
          const light = (max + min) / 510
          const score = sat * (1 - Math.abs(light - 0.55) * 1.6)
          if (score > best.score) best = { score, r, g, b }
        }
        // Lift dark picks so the glow stays visible on the dark UI
        const lift = Math.max(0, 150 - Math.max(best.r, best.g, best.b))
        const color = `${Math.min(255, best.r + lift)} ${Math.min(255, best.g + lift)} ${Math.min(255, best.b + lift)}`
        cache[url] = color
        persist()
        resolve(color)
      } catch {
        resolve(null) // tainted canvas: host doesn't send CORS headers
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  pending.set(url, p)
  p.finally(() => pending.delete(url))
  return p
}
