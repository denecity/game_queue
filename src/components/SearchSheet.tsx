import { useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { useSteamSearch } from '../hooks/useSteamSearch'
import type { Game, GameStatus, SteamSearchResult } from '../lib/types'
import { api } from '../lib/api'
import { STATUS_META, haptic } from '../lib/utils'

interface Props {
  ownedAppIds: Set<number>
  onClose: () => void
  onQuickAdd: (game: Partial<Game>) => Promise<Game | null>
  onOpenDetails: (result: SteamSearchResult) => void
  onCustom: (name: string) => void
}

export async function detailsToGame(result: SteamSearchResult, status: GameStatus): Promise<Partial<Game>> {
  let full: SteamSearchResult = result
  try { full = { ...result, ...(await api.steam.app(result.appid)) } } catch { /* fall back to search data */ }
  return {
    name: full.name,
    price: full.price || null,
    image_url: full.image_url || null,
    tags: full.tags ?? [],
    status,
    steam_app_id: full.appid,
    is_custom: false,
    steam_url: `https://store.steampowered.com/app/${full.appid}/`,
    player_count: full.player_count ?? null,
    player_count_recent: full.player_count_recent ?? null,
  }
}

export function SearchSheet({ ownedAppIds, onClose, onQuickAdd, onOpenDetails, onCustom }: Props) {
  const { query, setQuery, results, loading, error } = useSteamSearch()
  const [busy, setBusy] = useState<Record<number, 'adding' | 'added'>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60) }, [])

  async function quickAdd(r: SteamSearchResult, status: GameStatus) {
    haptic(10)
    setBusy(b => ({ ...b, [r.appid]: 'adding' }))
    const saved = await onQuickAdd(await detailsToGame(r, status))
    setBusy(b => {
      const next = { ...b }
      if (saved) next[r.appid] = 'added'
      else delete next[r.appid]
      return next
    })
  }

  return (
    <Sheet onClose={onClose} title={<span>Find a game <span className="text-gradient">✦</span></span>} wide>
      <div className="px-5 pb-6">
        <div className="relative sticky top-0 z-10 pb-3 bg-ink-900">
          <span className="absolute left-4 top-[22px] -translate-y-1/2 text-ink-400 pointer-events-none">
            {loading ? <span className="inline-block animate-spin">◌</span> : '🔍'}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Steam or paste a store link…"
            enterKeyHint="search"
            className="field pl-11 h-11"
          />
        </div>

        {error && <p className="text-sm text-pop-amber py-3">Couldn't reach Steam. Check your connection.</p>}

        {!query && (
          <div className="py-10 text-center text-ink-400">
            <div className="text-5xl mb-3 animate-bob">🕹️</div>
            <p className="text-sm">Type a name. Tap ✨ to wishlist or 🎮 to queue it.</p>
          </div>
        )}

        <div className="space-y-2">
          {results.map(r => {
            const owned = ownedAppIds.has(r.appid) || busy[r.appid] === 'added'
            return (
              <div key={r.appid} className="flex items-center gap-3 p-2 rounded-2xl bg-white/[.03] ring-1 ring-white/[.05] animate-pop-in">
                <button onClick={() => onOpenDetails(r)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <img src={r.image_url} alt="" loading="lazy" className="w-[92px] aspect-[231/87] rounded-xl object-cover bg-ink-800 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-display font-bold leading-tight truncate">{r.name}</div>
                    <div className="text-xs font-mono text-ink-400 mt-0.5">{r.price}</div>
                  </div>
                </button>
                {owned ? (
                  <span className="chip bg-pop-lime/15 text-pop-lime mr-1">✓ Added</span>
                ) : busy[r.appid] === 'adding' ? (
                  <span className="w-[84px] text-center text-ink-400 animate-spin">◌</span>
                ) : (
                  <div className="flex gap-1">
                    {(['none', 'bought'] as GameStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => quickAdd(r, s)}
                        title={`Add to ${s === 'none' ? 'Wishlist' : 'Queue'}`}
                        className="w-10 h-10 rounded-xl text-lg transition ease-spring active:scale-75 hover:scale-110"
                        style={{ background: `${STATUS_META[s].color}22` }}
                      >
                        {s === 'none' ? '✨' : '🎮'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {query && !loading && (
          <button
            onClick={() => onCustom(query)}
            className="w-full mt-4 py-3 rounded-2xl border border-dashed border-white/15 text-sm text-ink-400 hover:text-ink-100 hover:border-pop-violet/60 transition"
          >
            Not on Steam? Add “{query}” as a custom game →
          </button>
        )}
      </div>
    </Sheet>
  )
}
