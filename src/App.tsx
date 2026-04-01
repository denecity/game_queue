import { useRef, useState, useCallback } from 'react'
import { useGames } from './hooks/useGames'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { SearchBar } from './components/SearchBar'
import { TabBar } from './components/TabBar'
import { GameList } from './components/GameList'
import { FilterSort } from './components/FilterSort'
import { AddGameModal } from './components/AddGameModal'
import { EmptyState } from './components/EmptyState'
import { Settings } from './components/Settings'
import { ToastContainer } from './components/Toast'
import type { SteamSearchResult, TabName, Game } from './lib/types'
import { api } from './lib/api'

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<TabName>('queue')
  const [addModalPrefill, setAddModalPrefill] = useState<SteamSearchResult | null | 'custom'>(null)
  const [showSettings, setShowSettings] = useState(false)

  const {
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
    refetch,
  } = useGames()

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [])

  const handleEscape = useCallback(() => {
    setAddModalPrefill(null)
    setShowSettings(false)
  }, [])

  useKeyboardShortcuts({
    onFocusSearch: focusSearch,
    onTabSwitch: setActiveTab,
    onEscape: handleEscape,
  })

  async function handleSelectSearchResult(result: SteamSearchResult) {
    // Fetch full details from Steam
    try {
      const full = await api.steam.app(result.appid)
      setAddModalPrefill({ ...result, ...full })
    } catch {
      setAddModalPrefill(result)
    }
  }

  async function handleAddGame(partial: Partial<Game>) {
    const saved = await addGame(partial)
    if (saved) {
      // Switch to correct tab
      if (saved.status === 'none') setActiveTab('wishlist')
      else if (saved.status === 'done') setActiveTab('archive')
      else setActiveTab('queue')
    }
    setAddModalPrefill(null)
  }

  const currentGames = activeTab === 'queue' ? queueGames
    : activeTab === 'wishlist' ? wishlistGames
    : archiveGames

  const isManualSort = sort === 'manual'
  const isDraggable = isManualSort && activeTab !== 'archive'

  const totalEmpty = queueGames.length === 0 && wishlistGames.length === 0 && archiveGames.length === 0

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            🎮 <span>GameQueue</span>
          </h1>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost text-lg"
            title="Settings"
          >
            ⚙
          </button>
        </header>

        {/* Search bar */}
        <div className="flex items-center gap-2 mb-4">
          <SearchBar
            onSelectResult={handleSelectSearchResult}
            onAddCustom={() => setAddModalPrefill('custom')}
            searchInputRef={searchInputRef as React.RefObject<HTMLInputElement>}
          />
        </div>

        {/* Tabs + filter */}
        <div className="flex items-center justify-between mb-4">
          <TabBar
            active={activeTab}
            counts={{
              queue: queueGames.length,
              wishlist: wishlistGames.length,
              archive: archiveGames.length,
            }}
            onSwitch={setActiveTab}
          />
          <FilterSort
            sort={sort}
            onSortChange={setSort}
            filter={filter}
            onFilterChange={setFilter}
            availableTags={allTags}
          />
        </div>

        {/* Non-manual sort notice */}
        {!isManualSort && activeTab !== 'archive' && (
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
            <span>⚠</span> Manual reordering disabled while sorted. Switch to "Manual Order" to drag.
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            Loading…
          </div>
        ) : totalEmpty ? (
          <EmptyState
            onImportWishlist={() => setShowSettings(true)}
            onAddCustom={() => setAddModalPrefill('custom')}
          />
        ) : currentGames.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {activeTab === 'queue' && 'No games in your queue. Add some from your wishlist!'}
            {activeTab === 'wishlist' && 'Your wishlist is empty. Search for games above.'}
            {activeTab === 'archive' && "You haven't completed any games yet."}
          </div>
        ) : (
          <GameList
            games={currentGames}
            onUpdate={updateGame}
            onDelete={removeGame}
            onReorder={reorderGames}
            draggable={isDraggable}
          />
        )}
      </div>

      {/* Modals */}
      {addModalPrefill !== null && (
        <AddGameModal
          prefill={addModalPrefill === 'custom' ? null : addModalPrefill}
          onConfirm={handleAddGame}
          onClose={() => setAddModalPrefill(null)}
        />
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onImportWishlist={() => { setShowSettings(false); refetch() }}
          games={games}
        />
      )}

      <ToastContainer />
    </div>
  )
}
