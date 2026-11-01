import type { Game, SteamSearchResult, ReorderPayload } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || ''
    const text = await res.text().catch(() => res.statusText)
    if (contentType.includes('text/html')) {
      throw new Error(`Request failed (HTTP ${res.status}). Please try again.`)
    }
    let message = text || `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error) message = parsed.error
    } catch { /* not JSON */ }
    throw new Error(message)
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text)
  }
}

export interface RefreshResult { processed: number; updated: number; remaining: number; itad: boolean }

export const api = {
  games: {
    list(): Promise<Game[]> {
      return request<Game[]>('/api/games')
    },
    create(body: Partial<Game>): Promise<Game> {
      return request<Game>('/api/games', { method: 'POST', body: JSON.stringify(body) })
    },
    update(id: string, body: Partial<Game>): Promise<Game> {
      return request<Game>(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(body) })
    },
    remove(id: string): Promise<void> {
      return request<void>(`/api/games/${id}`, { method: 'DELETE' })
    },
    removeAll(): Promise<void> {
      return request<void>('/api/games', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE ALL' }) })
    },
    reorder(items: ReorderPayload[]): Promise<void> {
      return request<void>('/api/games/reorder', { method: 'PUT', body: JSON.stringify(items) })
    },
  },
  steam: {
    search(q: string): Promise<SteamSearchResult[]> {
      return request<SteamSearchResult[]>(`/api/steam/search?q=${encodeURIComponent(q)}`)
    },
    app(appid: number): Promise<SteamSearchResult> {
      return request<SteamSearchResult>(`/api/steam/app/${appid}`)
    },
    importWishlist(url: string): Promise<{ added: number; skipped: number; totalWishlistItems: number }> {
      return request('/api/games/import-wishlist', { method: 'POST', body: JSON.stringify({ url }) })
    },
    importLibrary(profileUrl: string): Promise<{ added: number; skipped: number; total: number }> {
      return request('/api/steam/import-library', { method: 'POST', body: JSON.stringify({ profileUrl }) })
    },
  },
  prices: {
    refresh(body: { ids?: string[]; before?: string } = {}): Promise<RefreshResult> {
      return request('/api/prices/refresh', { method: 'POST', body: JSON.stringify(body) })
    },
  },
  images: {
    repair(body: { ids?: string[]; all?: boolean }): Promise<{ images: Record<string, string | null> }> {
      return request('/api/images/repair', { method: 'POST', body: JSON.stringify(body) })
    },
  },
  settings: {
    get(): Promise<Record<string, unknown>> {
      return request('/api/settings')
    },
    put(values: Record<string, unknown>): Promise<void> {
      return request('/api/settings', { method: 'PUT', body: JSON.stringify(values) })
    },
  },
}
