import type { Game, SteamSearchResult, ReorderPayload } from './types'

function getSteamApiKey(): string {
  return localStorage.getItem('gq_steam_api_key') ?? ''
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const apiKey = getSteamApiKey()
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-steam-api-key': apiKey } : {}),
      ...init?.headers,
    },
    ...init,
  })
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || ''
    const text = await res.text().catch(() => res.statusText)
    if (contentType.includes('text/html')) {
      throw new Error(`Request failed (HTTP ${res.status}). Please try again.`)
    }
    throw new Error(text || `HTTP ${res.status}`)
  }

  // Some endpoints (e.g. DELETE) return 204 No Content.
  if (res.status === 204) {
    return undefined as T
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }

  const text = await res.text()
  if (!text) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text)
  }
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
    importWishlist(url: string): Promise<{ added: number; skipped: number; games: Game[] }> {
      return request('/api/games/import-wishlist', { method: 'POST', body: JSON.stringify({ url }) })
    },
  },
  keyforsteam: {
    refresh(): Promise<{ updated: number }> {
      return request('/api/keyforsteam/refresh', { method: 'POST' })
    },
  },
  library: {
    import(profileUrl: string): Promise<{ added: number; skipped: number; total: number; games: { id: string; name: string }[] }> {
      return request('/api/steam/import-library', { method: 'POST', body: JSON.stringify({ profileUrl }) })
    },
  },
}
