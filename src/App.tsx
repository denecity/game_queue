import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useGames } from './hooks/useGames'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useIsDesktop } from './hooks/useMediaQuery'
import { GameList } from './components/GameList'
import { CoverCard } from './components/GameCards'
import { Toolbar } from './components/Toolbar'
import { TabPills, BottomNav } from './components/Navigation'
import { SearchSheet } from './components/SearchSheet'
import { AddGameSheet } from './components/AddGameSheet'
import { GameSheet } from './components/GameSheet'
import { RatePrompt } from './components/RatePrompt'
import { EmptyState } from './components/EmptyState'
import { Settings } from './components/Settings'
import { ToastContainer } from './components/Toast'
import type { Game, GameStatus, SteamSearchResult, TabName, ViewMode } from './lib/types'
import { api } from './lib/api'
import { setRepairListener } from './lib/imageRepair'
import { STATUS_META, TAB_META, tabForStatus, readLocal, writeLocal, showToast } from './lib/utils'

type AddPrefill = SteamSearchResult | { customName: string }

export default function App() {
  const isDesktop = useIsDesktop()
  const [activeTab, setActiveTabState] = useState<TabName>(() => readLocal<TabName>('gq_tab', 'queue'))
  const [view, setViewState] = useState<ViewMode>(() => readLocal<ViewMode>('gq_view', 'covers'))
  const [searchOpen, setSearchOpen] = useState(false)
  const [addPrefill, setAddPrefill] = useState<AddPrefill | null>(null)
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  const [ratingFor, setRatingFor] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const {
    games, queueGames, wishlistGames, archiveGames, allTags, loading,
    sort, setSort, filter, setFilter,
    addGame, updateGame, removeGame, reorderGames, patchLocal, refetch,
  } = useGames()

  // Read through a ref so handleStatus keeps one identity and memoised cards don't all re-render
  const gamesRef = useRef(games)
  gamesRef.current = games

  const setActiveTab = useCallback((t: TabName) => {
    setActiveTabState(t)
    writeLocal('gq_tab', t)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const setView = (v: ViewMode) => { setViewState(v); writeLocal('gq_view', v) }

  useEffect(() => setRepairListener((id, url) => patchLocal(id, { image_url: url })), [patchLocal])

  // Nudge one batch of stale prices on open, in case the cron Worker isn't deployed
  useEffect(() => {
    api.prices.refresh().then(r => { if (r.updated > 0) refetch() }).catch(() => {})
  }, [refetch])

  const openSearch = useCallback(() => setSearchOpen(true), [])

  // Home-screen shortcut (manifest) opens straight into search
  useEffect(() => {
    if (new URLSearchParams(location.search).has('search')) {
      history.replaceState(null, '', '/')
      openSearch()
    }
  }, [openSearch])
  useKeyboardShortcuts({ onSearch: openSearch, onTabSwitch: setActiveTab })

  const handleStatus = useCallback((id: string, status: GameStatus) => {
    const game = gamesRef.current.find(g => g.id === id)
    if (!game || game.status === status) return
    if (status === 'done' && game.rating == null) {
      setRatingFor(id)
      return
    }
    updateGame(id, { status })
    const meta = STATUS_META[status]
    const movedTab = tabForStatus(status) !== tabForStatus(game.status)
    showToast(
      `${meta.emoji} ${game.name} → ${meta.label}${movedTab ? ` (in ${TAB_META[tabForStatus(status)].label})` : ''}`,
      'success',
      { label: 'Undo', run: () => updateGame(id, { status: game.status }) },
    )
  }, [updateGame])

  const handleAdd = useCallback(async (partial: Partial<Game>) => {
    const saved = await addGame(partial)
    if (saved) showToast(`${STATUS_META[saved.status].emoji} Added ${saved.name}`, 'success')
    return saved
  }, [addGame])

  async function confirmAdd(partial: Partial<Game>) {
    const saved = await handleAdd(partial)
    if (saved) {
      setAddPrefill(null)
      setActiveTab(tabForStatus(saved.status))
    }
  }

  const ownedAppIds = useMemo(() => new Set(games.map(g => g.steam_app_id).filter((x): x is number => x != null)), [games])
  const openGame = openGameId ? games.find(g => g.id === openGameId) : null
  const ratingGame = ratingFor ? games.find(g => g.id === ratingFor) : null

  const currentGames = activeTab === 'queue' ? queueGames : activeTab === 'wishlist' ? wishlistGames : archiveGames
  const counts = { queue: queueGames.length, wishlist: wishlistGames.length, archive: archiveGames.length }
  const totalEmpty = !loading && games.length === 0
  const filterActive = filter.tags.length > 0 || filter.rated !== 'all' || filter.onSale

  // On the queue tab, games you're playing get a hero row; the rest is the reorderable "up next" list
  const nowPlaying = activeTab === 'queue' ? currentGames.filter(g => g.status === 'playing') : []
  const listGames = activeTab === 'queue' && nowPlaying.length ? currentGames.filter(g => g.status !== 'playing') : currentGames
  const draggable = sort === 'manual' && activeTab !== 'archive' && !filterActive

  return (
    <div className="min-h-dvh pb-[calc(110px+var(--safe-bottom))] md:pb-16">
      <header className="sticky top-0 z-30 pt-safe bg-ink-950/75 backdrop-blur-xl border-b border-white/[.04]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <h1 className="font-display text-2xl font-extrabold tracking-tight flex items-center gap-1.5 select-none">
            <span className="inline-block animate-bob">🎮</span>
            <span>Game<span className="text-gradient">Queue</span></span>
          </h1>
          {isDesktop && <div className="flex-1 flex justify-center"><TabPills active={activeTab} counts={counts} onSwitch={setActiveTab} /></div>}
          <div className="ml-auto md:ml-0 flex items-center gap-1">
            {isDesktop ? (
              <>
                <button onClick={openSearch} className="h-10 pl-3 pr-2 rounded-2xl bg-white/[.05] hover:bg-white/[.09] text-sm text-ink-400 flex items-center gap-6 transition">
                  <span>🔍 Find games</span>
                  <kbd className="text-[11px] font-mono bg-white/[.08] rounded-lg px-1.5 py-0.5">/</kbd>
                </button>
                <button onClick={() => setShowSettings(true)} className="btn-icon" aria-label="Settings">⚙️</button>
              </>
            ) : (
              <button onClick={openSearch} className="btn-icon text-lg" aria-label="Search">🔍</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-5">
        {totalEmpty ? (
          <EmptyState onSearch={openSearch} onImport={() => setShowSettings(true)} />
        ) : (
          <>
            {nowPlaying.length > 0 && (
              <section className="mb-7">
                <SectionTitle emoji="🔥" title="Now playing" count={nowPlaying.length} />
                <div className="flex md:grid md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2">
                  {nowPlaying.map(g => (
                    <div key={g.id} className="snap-center flex-shrink-0 w-[85%] sm:w-[60%] md:w-auto">
                      <CoverCard game={g} onOpen={setOpenGameId} onStatus={handleStatus} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-4">
              <SectionTitle
                emoji={nowPlaying.length ? '⏭️' : TAB_META[activeTab].emoji}
                title={nowPlaying.length ? 'Up next' : TAB_META[activeTab].label}
                count={listGames.length}
                big
              />
              <Toolbar sort={sort} onSort={setSort} filter={filter} onFilter={setFilter} tags={allTags} view={view} onView={setView} />
            </div>

            {!draggable && activeTab !== 'archive' && listGames.length > 1 && (
              <p className="text-xs text-ink-500 mb-3">{filterActive ? 'Clear filters' : 'Switch to “My order”'} to drag games around.</p>
            )}

            {loading && games.length === 0 ? (
              <div className={view === 'covers' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'}>
                {Array.from({ length: 6 }, (_, i) => <div key={i} className={`skeleton rounded-3xl ${view === 'covers' ? 'aspect-[460/260]' : 'h-[76px]'}`} />)}
              </div>
            ) : listGames.length === 0 ? (
              <div className="text-center py-16 text-ink-400 animate-pop-in">
                <div className="text-5xl mb-3">{filterActive ? '🧐' : TAB_META[activeTab].emoji}</div>
                <p>{filterActive ? 'Nothing matches those filters.' : nowPlaying.length ? 'Nothing else queued up.' : TAB_META[activeTab].empty}</p>
              </div>
            ) : (
              <GameList
                games={listGames}
                view={view}
                draggable={draggable}
                onOpen={setOpenGameId}
                onStatus={handleStatus}
                onReorder={reorderGames}
              />
            )}
          </>
        )}
      </main>

      {!isDesktop && <BottomNav active={activeTab} counts={counts} onSwitch={setActiveTab} onAdd={openSearch} onSettings={() => setShowSettings(true)} />}

      {searchOpen && (
        <SearchSheet
          ownedAppIds={ownedAppIds}
          onClose={() => setSearchOpen(false)}
          onQuickAdd={handleAdd}
          onOpenDetails={r => { setSearchOpen(false); setAddPrefill(r) }}
          onCustom={name => { setSearchOpen(false); setAddPrefill({ customName: name }) }}
        />
      )}

      {addPrefill && (
        <AddGameSheet prefill={addPrefill} activeTab={activeTab} onConfirm={confirmAdd} onClose={() => setAddPrefill(null)} />
      )}

      {openGame && (
        <GameSheet
          key={openGame.id}
          game={openGame}
          onClose={() => setOpenGameId(null)}
          onUpdate={updateGame}
          onStatus={handleStatus}
          onDelete={removeGame}
          onRefreshed={refetch}
        />
      )}

      {ratingGame && (
        <RatePrompt
          game={ratingGame}
          onClose={() => setRatingFor(null)}
          onDone={rating => {
            updateGame(ratingGame.id, { status: 'done', ...(rating != null ? { rating } : {}) })
            showToast(`🏆 ${ratingGame.name} archived`, 'success', { label: 'Undo', run: () => updateGame(ratingGame.id, { status: ratingGame.status, rating: null }) })
            setRatingFor(null)
          }}
        />
      )}

      {showSettings && (
        <Settings games={games} onClose={() => setShowSettings(false)} onDataChanged={refetch} />
      )}

      <ToastContainer />
    </div>
  )
}

function SectionTitle({ emoji, title, count, big }: { emoji: string; title: string; count: number; big?: boolean }) {
  return (
    <h2 className={`font-display font-extrabold flex items-center gap-2 ${big ? 'text-2xl md:text-3xl' : 'text-lg mb-3'}`}>
      <span aria-hidden>{emoji}</span>
      {title}
      <span className="text-sm font-bold text-ink-500 tabular-nums">{count}</span>
    </h2>
  )
}
