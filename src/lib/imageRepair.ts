import { api } from './api'

// Covers that fail to load are collected and sent to the server in one batch, which
// finds a working picture (Steam assets, store page, search, ITAD) and saves it.
const attempted = new Set<string>()
const waiting = new Map<string, Array<(url: string | null) => void>>()
let timer: ReturnType<typeof setTimeout> | null = null
let onRepaired: ((id: string, url: string) => void) | null = null

export function setRepairListener(fn: (id: string, url: string) => void) {
  onRepaired = fn
}

async function flush() {
  timer = null
  const batch = [...waiting.entries()]
  waiting.clear()
  try {
    const { images } = await api.images.repair({ ids: batch.map(([id]) => id) })
    for (const [id, resolvers] of batch) {
      const url = images[id] ?? null
      if (url) onRepaired?.(id, url)
      resolvers.forEach(r => r(url))
    }
  } catch {
    batch.forEach(([, resolvers]) => resolvers.forEach(r => r(null)))
  }
}

/** Resolves to a replacement URL, or null if nothing better exists (or we already tried). */
export function requestImageRepair(id: string): Promise<string | null> {
  if (attempted.has(id)) return Promise.resolve(null)
  attempted.add(id)
  return new Promise(resolve => {
    waiting.set(id, [...(waiting.get(id) ?? []), resolve])
    if (!timer) timer = setTimeout(flush, 400)
  })
}
