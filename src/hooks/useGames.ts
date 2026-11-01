import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../lib/api'
import type { Game, SortOption, FilterState, ReorderPayload } from '../lib/types'
import { tabForStatus, maxPosition, POSITION_GAP, parsePrice, bestPrice, showToast, readLocal, writeLocal } from '../lib/utils'

const CACHE_KEY = 'gq_games_cache'
const SORT_KEY = 'gq_sort'

export const EMPTY_FILTER: FilterState = { tags: [], statuses: [], rated: 'all', onSale: false }

const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return (a - b) * dir
}

function sortGames(games: Game[], sort: SortOption): Game[] {
  const out = [...games]
  switch (sort) {
    case 'manual': return out.sort((a, b) => a.queue_position - b.queue_position)
    case 'rating_desc': return out.sort((a, b) => nullsLast(a.rating, b.rating, -1))
    case 'price_desc': return out.sort((a, b) => nullsLast(parsePrice(a.price), parsePrice(b.price), -1))
    case 'price_asc': return out.sort((a, b) => nullsLast(parsePrice(a.price), parsePrice(b.price), 1))
    case 'key_price_asc': return out.sort((a, b) => nullsLast(a.key_price_eur, b.key_price_eur, 1))
    case 'best_price_asc': return out.sort((a, b) => nullsLast(bestPrice(a)?.chf ?? null, bestPrice(b)?.chf ?? null, 1))
    case 'players_desc': return out.sort((a, b) => nullsLast(a.player_count, b.player_count, -1))
    case 'date_added_desc': return out.sort((a, b) => b.date_added.localeCompare(a.date_added))
    case 'date_added_asc': return out.sort((a, b) => a.date_added.localeCompare(b.date_added))
    case 'name_asc': return out.sort((a, b) => a.name.localeCompare(b.name))
  }
}

export function useGames() {
  // Paint instantly from the last session's list, then revalidate
  const [games, setGames] = useState<Game[]>(() => readLocal<Game[]>(CACHE_KEY, []))
  const [loading, setLoading] = useState(games.length === 0)
  const [sort, setSortState] = useState<SortOption>(() => readLocal<SortOption>(SORT_KEY, 'manual'))
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER)

  // Mutators read the latest list from a ref so their identity never changes,
  // which lets memoised cards skip re-rendering when an unrelated game updates.
  const gamesRef = useRef(games)
  gamesRef.current = games

  useEffect(() => {
    const t = setTimeout(() => writeLocal(CACHE_KEY, games), 500)
    return () => clearTimeout(t)
  }, [games])

  const setSort = useCallback((s: SortOption) => {
    setSortState(s)
    writeLocal(SORT_KEY, s)
  }, [])

  const fetchGames = useCallback(async () => {
    try {
      setGames(await api.games.list())
    } catch (e) {
      showToast('Offline? Showing your last saved list.', 'error')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGames() }, [fetchGames])

  /** Merge server-side changes (e.g. refreshed prices) without a full reload flicker. */
  const patchLocal = useCallback((id: string, patch: Partial<Game>) => {
    setGames(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g))
  }, [])

  const addGame = useCallback(async (partial: Partial<Game>): Promise<Game | null> => {
    const newGame: Partial<Game> = {
      id: crypto.randomUUID(),
      date_added: new Date().toISOString(),
      hours_played: 0,
      status: 'none',
      queue_position: maxPosition(gamesRef.current) + POSITION_GAP,
      tags: [],
      offers: [],
      ...partial,
    }
    const temp = newGame as Game
    setGames(prev => [...prev, temp])
    try {
      const saved = await api.games.create(newGame)
      setGames(prev => prev.map(g => g.id === temp.id ? saved : g))
      // Fetch prices for the new game right away instead of waiting for the next cron pass
      if (saved.steam_app_id) {
        api.prices.refresh({ ids: [saved.id] })
          .then(() => api.games.list())
          .then(list => { const fresh = list.find(g => g.id === saved.id); if (fresh) patchLocal(saved.id, fresh) })
          .catch(() => {})
      }
      return saved
    } catch (e) {
      setGames(prev => prev.filter(g => g.id !== temp.id))
      if (e instanceof Error && e.message.includes('duplicate')) {
        showToast(`${partial.name} is already in your library`, 'info')
        return null
      }
      showToast('Failed to add game: ' + (e instanceof Error ? e.message : String(e)), 'error')
      return null
    }
  }, [patchLocal])

  const updateGame = useCallback(async (id: string, patch: Partial<Game>) => {
    const prev = gamesRef.current.find(g => g.id === id)
    if (!prev) return
    const full = { ...patch }

    if (full.status !== undefined && full.status !== prev.status) {
      if (full.status === 'done') full.date_completed = new Date().toISOString()
      else if (prev.status === 'done') full.date_completed = null
    }

    setGames(gs => gs.map(g => g.id === id ? { ...g, ...full } : g))
    try {
      const updated = await api.games.update(id, full)
      setGames(gs => gs.map(g => g.id === id ? updated : g))
    } catch (e) {
      setGames(gs => gs.map(g => g.id === id ? prev : g))
      showToast('Failed to update: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }, [])

  const removeGame = useCallback(async (id: string) => {
    const prev = gamesRef.current.find(g => g.id === id)
    if (!prev) return
    setGames(gs => gs.filter(g => g.id !== id))
    try {
      await api.games.remove(id)
      showToast(`Removed ${prev.name}`, 'info', {
        label: 'Undo',
        run: async () => {
          setGames(gs => [...gs, prev])
          try { await api.games.create(prev) } catch { setGames(gs => gs.filter(g => g.id !== prev.id)) }
        },
      })
    } catch (e) {
      setGames(gs => [...gs, prev])
      showToast('Failed to delete: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }, [])

  const reorderGames = useCallback(async (ordered: Game[]) => {
    // Re-space the reordered tab within the position range it already occupied, so the
    // other tabs' games keep their relative order.
    const positions = ordered.map(g => g.queue_position).sort((a, b) => a - b)
    const payload: ReorderPayload[] = ordered.map((g, i) => ({ id: g.id, queue_position: positions[i] }))
    const unique = new Set(positions).size === positions.length
    const final = unique ? payload : ordered.map((g, i) => ({ id: g.id, queue_position: positions[0] + i * 10 }))
    const byId = new Map(final.map(p => [p.id, p.queue_position]))

    setGames(prev => prev.map(g => byId.has(g.id) ? { ...g, queue_position: byId.get(g.id)! } : g))
    try {
      await api.games.reorder(final)
    } catch (e) {
      showToast('Failed to save order: ' + (e instanceof Error ? e.message : String(e)), 'error')
      fetchGames()
    }
  }, [fetchGames])

  const derived = useMemo(() => {
    const filtered = games.filter(g => {
      if (filter.tags.length > 0 && !filter.tags.some(t => g.tags.includes(t))) return false
      if (filter.statuses.length > 0 && !filter.statuses.includes(g.status)) return false
      if (filter.rated === 'rated' && g.rating == null) return false
      if (filter.rated === 'unrated' && g.rating != null) return false
      if (filter.onSale && !(g.deal_cut && g.deal_cut > 0)) return false
      return true
    })
    const sorted = sortGames(filtered, sort)
    const archive = sorted.filter(g => tabForStatus(g.status) === 'archive')
    return {
      queueGames: sorted.filter(g => tabForStatus(g.status) === 'queue'),
      wishlistGames: sorted.filter(g => tabForStatus(g.status) === 'wishlist'),
      archiveGames: sort === 'manual'
        ? [...archive].sort((a, b) => (b.date_completed ?? '').localeCompare(a.date_completed ?? ''))
        : archive,
      allTags: [...new Set(games.flatMap(g => g.tags))].sort(),
    }
  }, [games, filter, sort])

  return {
    games,
    ...derived,
    loading,
    sort,
    setSort,
    filter,
    setFilter,
    addGame,
    updateGame,
    removeGame,
    reorderGames,
    patchLocal,
    refetch: fetchGames,
  }
}

export type UseGames = ReturnType<typeof useGames>
