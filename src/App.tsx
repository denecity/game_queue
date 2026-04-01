import { useRef, useState, useCallback, useEffect } from 'react'
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

const KEY_PRICE_REFRESH_KEY = 'gq_last_key_refresh'
const KEY_PRICE_REFRESH_INTERVAL = 6 * 60 * 60 * 1000

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<TabName>('queue')
  const [addModalPrefill, setAddModalPrefill] = useState<SteamSearchResult | null | 'custom'>(null)
  const [bulkQueue, setBulkQueue] = useState<SteamSearchResult[]>([])
  const [showSettings, setShowSettings] = useState(false)

  // Card height preference (px) — drives --card-height CSS variable
  const [cardHeight, setCardHeight] = useState<number>(() =>
    parseInt(localStorage.getItem('gq_card_height') ?? '72', 10)
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--card-height', cardHeight + 'px')
    localStorage.setItem('gq_card_height', String(cardHeight))
  }, [cardHeight])

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

  useEffect(() => {
    const last = parseInt(localStorage.getItem(KEY_PRICE_REFRESH_KEY) ?? '0', 10)
    if (Date.now() - last > KEY_PRICE_REFRESH_INTERVAL) {
      api.keyforsteam.refresh().then(() => {
        localStorage.setItem(KEY_PRICE_REFRESH_KEY, String(Date.now()))
        refetch()
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [])

  const handleEscape = useCallback(() => {
    if (addModalPrefill !== null) {
      setAddModalPrefill(null)
      setBulkQueue([])
    } else {
      setShowSettings(false)
    }
  }, [addModalPrefill])

  useKeyboardShortcuts({ onFocusSearch: focusSearch, onTabSwitch: setActiveTab, onEscape: handleEscape })

  async function handleSelectSearchResult(result: SteamSearchResult) {
    if (addModalPrefill !== null && addModalPrefill !== 'custom') {
      setBulkQueue(prev => prev.some(r => r.appid === result.appid) ? prev : [...prev, result])
      return
    }
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
      if (saved.status === 'none') setActiveTab('wishlist')
      else if (saved.status === 'done') setActiveTab('archive')
      else setActiveTab('queue')
    }
    if (bulkQueue.length > 0) {
      const [next, ...rest] = bulkQueue
      setBulkQueue(rest)
      try {
        const full = await api.steam.app(next.appid)
        setAddModalPrefill({ ...next, ...full })
      } catch {
        setAddModalPrefill(next)
      }
    } else {
      setAddModalPrefill(null)
    }
  }

  async function handleAddAll(partials: Partial<Game>[]) {
    for (const partial of partials) await addGame(partial)
    setAddModalPrefill(null)
    setBulkQueue([])
    refetch()
  }

  function handleCloseModal() {
    setAddModalPrefill(null)
    setBulkQueue([])
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
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            🎮 <span>GameQueue</span>
          </h1>
          <button onClick={() => setShowSettings(true)} className="btn-ghost text-lg" title="Settings">⚙</button>
        </header>

        <div className="flex items-center gap-2 mb-4">
          <SearchBar
            onSelectResult={handleSelectSearchResult}
            onAddCustom={() => setAddModalPrefill('custom')}
            searchInputRef={searchInputRef as React.RefObject<HTMLInputElement>}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <TabBar
            active={activeTab}
            counts={{ queue: queueGames.length, wishlist: wishlistGames.length, archive: archiveGames.length }}
            onSwitch={setActiveTab}
          />
          <FilterSort sort={sort} onSortChange={setSort} filter={filter} onFilterChange={setFilter} availableTags={allTags} />
        </div>

        {!isManualSort && activeTab !== 'archive' && (
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
            <span>⚠</span> Manual reordering disabled while sorted. Switch to "Manual Order" to drag.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">Loading…</div>
        ) : totalEmpty ? (
          <EmptyState onImportWishlist={() => setShowSettings(true)} onAddCustom={() => setAddModalPrefill('custom')} />
        ) : currentGames.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {activeTab === 'queue' && 'No games in your queue.'}
            {activeTab === 'wishlist' && 'Your wishlist is empty. Search for games above.'}
            {activeTab === 'archive' && "You haven't completed any games yet."}
          </div>
        ) : (
          <GameList games={currentGames} onUpdate={updateGame} onDelete={removeGame} onReorder={reorderGames} draggable={isDraggable} />
        )}
      </div>

      {addModalPrefill !== null && (
        <AddGameModal
          prefill={addModalPrefill === 'custom' ? null : addModalPrefill}
          activeTab={activeTab}
          pendingQueue={bulkQueue}
          onConfirm={handleAddGame}
          onConfirmAll={handleAddAll}
          onRemoveFromQueue={appid => setBulkQueue(prev => prev.filter(r => r.appid !== appid))}
          onClose={handleCloseModal}
        />
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onDataChanged={() => { setShowSettings(false); refetch() }}
          games={games}
          cardHeight={cardHeight}
          onCardHeightChange={setCardHeight}
        />
      )}

      <ToastContainer />
    </div>
  )
}
