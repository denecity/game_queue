import { useEffect, useRef, useState } from 'react'
import type { SortOption, FilterState, ViewMode } from '../lib/types'
import { EMPTY_FILTER } from '../hooks/useGames'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'manual', label: '✋ My order' },
  { value: 'best_price_asc', label: '💸 Cheapest anywhere' },
  { value: 'key_price_asc', label: '🔑 Cheapest key' },
  { value: 'price_asc', label: '🏷️ Steam price ↑' },
  { value: 'price_desc', label: '🏷️ Steam price ↓' },
  { value: 'rating_desc', label: '⭐ Top rated' },
  { value: 'players_desc', label: '👥 Most players' },
  { value: 'date_added_desc', label: '🆕 Newest' },
  { value: 'date_added_asc', label: '🕰️ Oldest' },
  { value: 'name_asc', label: '🔤 A–Z' },
]

interface Props {
  sort: SortOption
  onSort: (s: SortOption) => void
  filter: FilterState
  onFilter: (f: FilterState) => void
  tags: string[]
  view: ViewMode
  onView: (v: ViewMode) => void
}

function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`chip py-1.5 px-3 transition ease-spring active:scale-90 ${active ? 'bg-pop-violet text-ink-950' : 'bg-white/[.05] text-ink-300 hover:bg-white/[.1]'}`}
    >
      {children}
    </button>
  )
}

export function Toolbar({ sort, onSort, filter, onFilter, tags, view, onView }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filterCount = filter.tags.length + (filter.rated !== 'all' ? 1 : 0) + (filter.onSale ? 1 : 0)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2">
        <label className="relative flex-1 md:flex-none min-w-0">
          <select
            value={sort}
            onChange={e => onSort(e.target.value as SortOption)}
            className="appearance-none w-full md:w-auto bg-white/[.05] hover:bg-white/[.08] rounded-2xl pl-3.5 pr-9 h-10 text-sm font-semibold text-ink-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-pop-violet/50 transition"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none text-xs">▾</span>
        </label>

        <button
          onClick={() => setOpen(o => !o)}
          className={`h-10 px-3.5 rounded-2xl text-sm font-semibold flex items-center gap-1.5 transition ease-spring active:scale-95
            ${filterCount ? 'bg-pop-violet/20 text-pop-violet ring-1 ring-pop-violet/40' : 'bg-white/[.05] text-ink-200 hover:bg-white/[.08]'}`}
        >
          <span aria-hidden>⚡</span> Filter
          {filterCount > 0 && <span className="bg-pop-violet text-ink-950 text-[11px] rounded-full w-5 h-5 grid place-items-center">{filterCount}</span>}
        </button>

        <div className="flex bg-white/[.05] rounded-2xl p-1 h-10" role="radiogroup" aria-label="View">
          {(['covers', 'list'] as ViewMode[]).map(v => (
            <button
              key={v}
              role="radio"
              aria-checked={view === v}
              onClick={() => onView(v)}
              title={v === 'covers' ? 'Cover view' : 'List view'}
              className={`w-9 rounded-xl grid place-items-center transition ease-spring ${view === v ? 'bg-white/[.12] text-ink-100' : 'text-ink-500 hover:text-ink-200'}`}
            >
              {v === 'covers'
                ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="14" height="6" rx="2" /><rect x="1" y="9" width="14" height="6" rx="2" /></svg>
                : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1.5" width="4" height="3" rx="1" /><rect x="6.5" y="2" width="8.5" height="2" rx="1" /><rect x="1" y="6.5" width="4" height="3" rx="1" /><rect x="6.5" y="7" width="8.5" height="2" rx="1" /><rect x="1" y="11.5" width="4" height="3" rx="1" /><rect x="6.5" y="12" width="8.5" height="2" rx="1" /></svg>}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="absolute right-0 left-0 md:left-auto md:w-96 top-full mt-2 z-30 glass rounded-3xl p-4 shadow-2xl animate-pop-in origin-top space-y-4">
          <div>
            <div className="label">Deals</div>
            <Pill active={filter.onSale} onClick={() => onFilter({ ...filter, onSale: !filter.onSale })}>🔥 On sale now</Pill>
          </div>
          <div>
            <div className="label">Rating</div>
            <div className="flex gap-1.5">
              {(['all', 'rated', 'unrated'] as const).map(v => (
                <Pill key={v} active={filter.rated === v} onClick={() => onFilter({ ...filter, rated: v })}>
                  {v === 'all' ? 'All' : v === 'rated' ? 'Rated' : 'Unrated'}
                </Pill>
              ))}
            </div>
          </div>
          {tags.length > 0 && (
            <div>
              <div className="label">Tags</div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto no-scrollbar">
                {tags.map(t => (
                  <Pill
                    key={t}
                    active={filter.tags.includes(t)}
                    onClick={() => onFilter({ ...filter, tags: filter.tags.includes(t) ? filter.tags.filter(x => x !== t) : [...filter.tags, t] })}
                  >
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
          )}
          {filterCount > 0 && (
            <button onClick={() => onFilter(EMPTY_FILTER)} className="w-full text-sm font-semibold text-pop-coral pt-1">Clear filters</button>
          )}
        </div>
      )}
    </div>
  )
}
