import { useRef, useState, useEffect } from 'react'
import { useSteamSearch } from '../hooks/useSteamSearch'
import type { SteamSearchResult } from '../lib/types'

interface Props {
  onSelectResult: (result: SteamSearchResult) => void
  onAddCustom: () => void
  searchInputRef: React.RefObject<HTMLInputElement>
}

export function SearchBar({ onSelectResult, onAddCustom, searchInputRef }: Props) {
  const { query, setQuery, results, loading, error } = useSteamSearch()
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setShowDropdown(query.length > 0)
  }, [query, results])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function select(result: SteamSearchResult) {
    onSelectResult(result)
    setQuery('')
    setShowDropdown(false)
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {loading
              ? <span className="text-slate-400 text-sm animate-spin">⟳</span>
              : <span className="text-slate-500 text-sm">🔍</span>
            }
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query && setShowDropdown(true)}
            placeholder="Search Steam games or paste a Steam URL… (press / to focus)"
            className="w-full bg-[#1a1d23] border border-[#2a2d35] rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#4fd1c5] transition-colors"
          />
        </div>
        <button onClick={onAddCustom} className="btn-ghost border border-[#2a2d35] text-sm whitespace-nowrap">
          + Custom
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 z-40 mt-1 card shadow-2xl animate-fade-in max-h-80 overflow-y-auto">
          {error && (
            <div className="px-4 py-3 text-sm text-amber-400">
              Couldn't reach Steam. Check your connection.
            </div>
          )}
          {!error && results.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-slate-400">
              No games found. Try a different search or{' '}
              <button onClick={onAddCustom} className="text-[#4fd1c5] hover:underline">add a custom game</button>.
            </div>
          )}
          {results.map(r => (
            <button
              key={r.appid}
              onClick={() => select(r)}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#20242c] transition-colors text-left"
            >
              <img
                src={r.image_url}
                alt={r.name}
                className="w-16 h-7 rounded object-cover flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 truncate">{r.name}</div>
                {r.tags.length > 0 && (
                  <div className="text-xs text-slate-500 truncate">{r.tags.slice(0, 3).join(', ')}</div>
                )}
              </div>
              <span className="text-sm font-mono text-slate-300 flex-shrink-0">{r.price}</span>
            </button>
          ))}
          <div className="border-t border-[#2a2d35] px-3 py-2">
            <button onClick={onAddCustom} className="text-xs text-slate-400 hover:text-[#4fd1c5] transition-colors">
              Not finding it? Add custom game →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
