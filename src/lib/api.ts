import type { Game, SteamSearchResult, ReorderPayload } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Games
export const api = {
  games: {
    list(params?: { status?: string; sort?: string; search?: string }): Promise<Game[]> {
      const qs = new URLSearchParams(
        Object.entries(params ?? {}).filter(([, v]) => v != null) as [string, string][]
      ).toString()
      return request<Game[]>(`/api/games${qs ? `?${qs}` : ''}`)
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
    importWishlist(url: string): Promise<{ added: number; games: Game[] }> {
      return request('/api/games/import-wishlist', { method: 'POST', body: JSON.stringify({ url }) })
    },
  },
  keyforsteam: {
    refresh(): Promise<{ updated: number }> {
      return request('/api/keyforsteam/refresh', { method: 'POST' })
    },
  },
}
