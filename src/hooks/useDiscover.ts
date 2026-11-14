import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { api } from '../lib/api'
import type { DiscoverFilters, DiscoverResult, SteamTag, Suggestion } from '../lib/types'
import { readLocal, writeLocal } from '../lib/utils'

interface DeckState {
  /** Which filters this deck was built for */
  key: string
  deck: Suggestion[]
  meta: Pick<DiscoverResult, 'basedOn' | 'topTags'> | null
  loading: boolean
  error: boolean
  /** Several fetches in a row brought nothing new */
  exhausted: boolean
  page: number
  misses: number
}

// Lives outside React so the deck is still there when you come back from another tab
let state: DeckState = { key: '', deck: [], meta: null, loading: false, error: false, exhausted: false, page: 0, misses: 0 }
/** Everything already swiped this session, in case a fetch races the save of a swipe */
const seen = new Set<number>()
const listeners = new Set<() => void>()
let requestId = 0

function set(patch: Partial<DeckState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

function reset(key: string) {
  requestId++
  set({ key, deck: [], loading: false, error: false, exhausted: false, page: 0, misses: 0 })
}

async function loadMore(filters: DiscoverFilters) {
  if (state.loading) return
  const id = ++requestId
  set({ loading: true, error: false })
  try {
    const res = await api.discover.get(filters, state.page)
    if (id !== requestId) return // filters changed while this was in flight
    const have = new Set(state.deck.map(s => s.appid))
    const fresh = res.suggestions.filter(s => !have.has(s.appid) && !seen.has(s.appid))
    const misses = fresh.length === 0 ? state.misses + 1 : 0
    set({
      deck: [...state.deck, ...fresh],
      meta: { basedOn: res.basedOn, topTags: res.topTags },
      loading: false,
      page: state.page + 1,
      misses,
      exhausted: misses >= 2,
    })
  } catch {
    if (id === requestId) set({ loading: false, error: true })
  }
}

/**
 * The endless suggestion deck. Tops itself up when it runs low; every card leaves it through `take`,
 * and since each of those is saved (added or dismissed) the server never sends it again.
 */
export function useDiscover(filters: DiscoverFilters, owned: Set<number>) {
  const s = useSyncExternalStore(subscribe, () => state)
  const key = JSON.stringify(filters)
  const deck = useMemo(() => s.deck.filter(x => !owned.has(x.appid)), [s.deck, owned])
  const current = s.key === key

  useEffect(() => { if (state.key !== key) reset(key) }, [key])

  useEffect(() => {
    if (current && deck.length <= 6 && !s.loading && !s.error && !s.exhausted) loadMore(filters)
  }, [current, deck.length, s.loading, s.error, s.exhausted]) // eslint-disable-line react-hooks/exhaustive-deps

  const take = useCallback((appid: number) => {
    seen.add(appid)
    set({ deck: state.deck.filter(x => x.appid !== appid) })
  }, [])

  const putBack = useCallback((card: Suggestion) => {
    seen.delete(card.appid)
    set({ deck: [card, ...state.deck.filter(x => x.appid !== card.appid)] })
  }, [])

  const retry = useCallback(() => {
    set({ error: false, exhausted: false, misses: 0 })
  }, [])

  return {
    deck: current ? deck : [],
    meta: s.meta,
    loading: s.loading || !current,
    error: s.error,
    exhausted: s.exhausted,
    take,
    putBack,
    retry,
  }
}

const TAGS_KEY = 'gq_steam_tags'
let tagCache: SteamTag[] | null = null

/** Steam's tag list (id + name), for the filter picker. Cached, since it barely ever changes. */
export function useSteamTags(): SteamTag[] {
  const [tags, setTags] = useState<SteamTag[]>(() => tagCache ?? readLocal<SteamTag[]>(TAGS_KEY, []))
  useEffect(() => {
    if (tagCache) return
    api.steam.tags().then(list => {
      tagCache = list
      writeLocal(TAGS_KEY, list)
      setTags(list)
    }).catch(() => {})
  }, [])
  return tags
}
