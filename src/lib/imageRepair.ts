import { api } from './api'

// Covers that fail to load are collected and sent to the server in batches, which finds a
// working picture (other Steam art, store page, search, ITAD) and saves it.
const BATCH = 20
const attempted = new Set<string>()
const waiting = new Map<string, { failed?: string; resolvers: Array<(url: string | null) => void> }>()
let timer: ReturnType<typeof setTimeout> | null = null
let onRepaired: ((id: string, url: string) => void) | null = null

export function setRepairListener(fn: (id: string, url: string) => void) {
  onRepaired = fn
}

async function flush() {
  timer = null
  const batch = [...waiting.entries()].slice(0, BATCH)
  for (const [id] of batch) waiting.delete(id)
  if (waiting.size > 0) timer = setTimeout(flush, 400)
  try {
    const failed: Record<string, string> = {}
    for (const [id, w] of batch) if (w.failed) failed[id] = w.failed
    const { images } = await api.images.repair({ ids: batch.map(([id]) => id), failed })
    for (const [id, w] of batch) {
      const url = images[id] ?? null
      if (url && url !== w.failed) onRepaired?.(id, url)
      w.resolvers.forEach(r => r(url))
    }
  } catch {
    batch.forEach(([, w]) => w.resolvers.forEach(r => r(null)))
  }
}

/**
 * Resolves to a replacement URL, or null if nothing better exists (or we already tried).
 * Pass the link that just failed to load so the server offers a different one.
 */
export function requestImageRepair(id: string, failedUrl?: string): Promise<string | null> {
  const key = `${id}|${failedUrl ?? ''}`
  if (attempted.has(key)) return Promise.resolve(null)
  attempted.add(key)
  return new Promise(resolve => {
    const entry = waiting.get(id) ?? { resolvers: [] }
    if (failedUrl) entry.failed = failedUrl
    entry.resolvers.push(resolve)
    waiting.set(id, entry)
    if (!timer) timer = setTimeout(flush, 400)
  })
}
