import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { Game, SortOption, FilterState, ReorderPayload } from '../lib/types'
import { tabForStatus, maxPosition, POSITION_GAP } from '../lib/utils'

function showToast(msg: string, type: 'error' | 'success' = 'error') {
  const ev = new CustomEvent('gq:toast', { detail: { msg, type } })
  window.dispatchEvent(ev)
}

export function useGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortOption>('manual')
  const [filter, setFilter] = useState<FilterState>({ tags: [], statuses: [], rated: 'all' })

  const fetchGames = useCallback(async () => {
    try {
      const data = await api.games.list({ sort: sort === 'manual' ? 'queue_position' : sort })
      setGames(data)
    } catch (e) {
      showToast('Failed to load games: ' + String(e))
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => { fetchGames() }, [fetchGames])

  const addGame = useCallback(async (partial: Partial<Game>): Promise<Game | null> => {
    const allGames = games
    const newPos = maxPosition(allGames) + POSITION_GAP
    const newGame: Partial<Game> = {
      id: crypto.randomUUID(),
      date_added: new Date().toISOString(),
      hours_played: 0,
      status: 'none',
      queue_position: newPos,
      tags: [],
      ...partial,
    }

    // Optimistic
    const tempGame = newGame as Game
    setGames(prev => [...prev, tempGame])
    try {
      const saved = await api.games.create(newGame)
      setGames(prev => prev.map(g => g.id === tempGame.id ? saved : g))
      showToast('Game added!', 'success')
      return saved
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('duplicate')) {
        setGames(prev => prev.filter(g => g.id !== tempGame.id))
        throw e
      }
      setGames(prev => prev.filter(g => g.id !== tempGame.id))
      showToast('Failed to add game: ' + String(e))
      return null
    }
  }, [games])

  const updateGame = useCallback(async (id: string, patch: Partial<Game>) => {
    const prev = games.find(g => g.id === id)
    if (!prev) return

    // Handle status transition side-effects
    if (patch.status !== undefined && patch.status !== prev.status) {
      if (patch.status === 'done') {
        patch.date_completed = new Date().toISOString()
      } else if (prev.status === 'done') {
        patch.date_completed = null
      }
    }

    setGames(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g))
    try {
      const updated = await api.games.update(id, patch)
      setGames(gs => gs.map(g => g.id === id ? updated : g))
    } catch (e) {
      setGames(gs => gs.map(g => g.id === id ? prev : g))
      showToast('Failed to update game: ' + String(e))
    }
  }, [games])

  const removeGame = useCallback(async (id: string) => {
    const prev = games.find(g => g.id === id)
    setGames(gs => gs.filter(g => g.id !== id))
    try {
      await api.games.remove(id)
    } catch (e) {
      if (prev) setGames(gs => [...gs, prev])
      showToast('Failed to delete game: ' + String(e))
    }
  }, [games])

  const reorderGames = useCallback(async (ordered: Game[]) => {
    const payload: ReorderPayload[] = ordered.map((g, i) => ({
      id: g.id,
      queue_position: (i + 1) * POSITION_GAP,
    }))

    setGames(prev => {
      const others = prev.filter(g => !ordered.find(o => o.id === g.id))
      const updated = ordered.map((g, i) => ({ ...g, queue_position: (i + 1) * POSITION_GAP }))
      return [...others, ...updated].sort((a, b) => a.queue_position - b.queue_position)
    })

    try {
      await api.games.reorder(payload)
    } catch (e) {
      showToast('Failed to save order: ' + String(e))
      fetchGames()
    }
  }, [fetchGames])

  // Apply client-side filters
  const filteredGames = games.filter(g => {
    if (filter.tags.length > 0 && !filter.tags.some(t => g.tags.includes(t))) return false
    if (filter.statuses.length > 0 && !filter.statuses.includes(g.status)) return false
    if (filter.rated === 'rated' && g.rating == null) return false
    if (filter.rated === 'unrated' && g.rating != null) return false
    return true
  })

  // Sort client-side if needed
  const sortedGames = sort === 'manual'
    ? filteredGames.sort((a, b) => a.queue_position - b.queue_position)
    : filteredGames

  const queueGames = sortedGames.filter(g => tabForStatus(g.status) === 'queue')
  const wishlistGames = sortedGames.filter(g => tabForStatus(g.status) === 'wishlist')
  const archiveGames = sortedGames
    .filter(g => tabForStatus(g.status) === 'archive')
    .sort((a, b) => {
      if (!a.date_completed) return 1
      if (!b.date_completed) return -1
      return b.date_completed.localeCompare(a.date_completed)
    })

  const allTags = [...new Set(games.flatMap(g => g.tags))].sort()

  return {
    games,
    queueGames,
    wishlistGames,
    archiveGames,
    allTags,
    loading,
    sort,
    setSort,
    filter,
    setFilter,
    addGame,
    updateGame,
    removeGame,
    reorderGames,
    refetch: fetchGames,
  }
}

export type UseGames = ReturnType<typeof useGames>
