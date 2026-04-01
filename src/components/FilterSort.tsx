import { useState } from 'react'
import type { SortOption, FilterState } from '../lib/types'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'manual', label: 'Manual Order' },
  { value: 'rating_desc', label: 'Rating (High → Low)' },
  { value: 'price_desc', label: 'Steam Price (High → Low)' },
  { value: 'price_asc', label: 'Steam Price (Low → High)' },
  { value: 'key_price_asc', label: 'Key Price (Low → High)' },
  { value: 'players_desc', label: 'Most Players' },
  { value: 'date_added_desc', label: 'Newest Added' },
  { value: 'date_added_asc', label: 'Oldest Added' },
  { value: 'name_asc', label: 'Name (A–Z)' },
]

interface Props {
  sort: SortOption
  onSortChange: (s: SortOption) => void
  filter: FilterState
  onFilterChange: (f: FilterState) => void
  availableTags: string[]
}

export function FilterSort({ sort, onSortChange, filter, onFilterChange, availableTags }: Props) {
  const [showFilter, setShowFilter] = useState(false)
  const activeFilterCount =
    filter.tags.length + filter.statuses.length + (filter.rated !== 'all' ? 1 : 0)

  return (
    <div className="flex items-center gap-2">
      {/* Sort */}
      <select
        value={sort}
        onChange={e => onSortChange(e.target.value as SortOption)}
        className="bg-[#1a1d23] border border-[#2a2d35] text-slate-300 text-sm rounded-md px-3 py-1.5 cursor-pointer hover:border-[#4a4d58] focus:outline-none focus:border-[#4fd1c5]"
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Filter */}
      <div className="relative">
        <button
          onClick={() => setShowFilter(f => !f)}
          className={`flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-sm transition-colors
            ${activeFilterCount > 0
              ? 'border-[#4fd1c5] text-[#4fd1c5] bg-[#4fd1c5]/10'
              : 'border-[#2a2d35] text-slate-400 hover:border-[#4a4d58] hover:text-slate-200 bg-[#1a1d23]'
            }`}
        >
          Filter {activeFilterCount > 0 && <span className="bg-[#4fd1c5] text-[#0f1115] text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeFilterCount}</span>}
        </button>

        {showFilter && (
          <div className="absolute right-0 top-full mt-1 z-50 card shadow-xl p-3 w-72 animate-fade-in">
            {/* Tags */}
            {availableTags.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-slate-400 mb-1.5">Tags</div>
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        const has = filter.tags.includes(tag)
                        onFilterChange({ ...filter, tags: has ? filter.tags.filter(t => t !== tag) : [...filter.tags, tag] })
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors
                        ${filter.tags.includes(tag)
                          ? 'bg-[#4fd1c5]/20 border-[#4fd1c5] text-[#4fd1c5]'
                          : 'border-[#2a2d35] text-slate-400 hover:border-[#4a4d58]'
                        }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rated filter */}
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1.5">Rating</div>
              <div className="flex gap-1">
                {(['all', 'rated', 'unrated'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => onFilterChange({ ...filter, rated: v })}
                    className={`text-xs px-2.5 py-1 rounded border capitalize transition-colors
                      ${filter.rated === v
                        ? 'bg-[#4fd1c5]/20 border-[#4fd1c5] text-[#4fd1c5]'
                        : 'border-[#2a2d35] text-slate-400 hover:border-[#4a4d58]'
                      }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => onFilterChange({ tags: [], statuses: [], rated: 'all' })}
                className="w-full text-xs text-red-400 hover:text-red-300 py-1 border-t border-[#2a2d35] mt-1 pt-2"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
