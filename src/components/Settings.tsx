import { useState, useEffect } from 'react'
import type { Game } from '../lib/types'
import { api } from '../lib/api'

interface SyncSource {
  id: string
  type: 'wishlist' | 'library'
  url: string
  label: string
  lastSynced: string | null
}

interface Props {
  onClose: () => void
  onDataChanged: () => void
  games: Game[]
}

const SYNC_SOURCES_KEY = 'gq_sync_sources'

function loadSources(): SyncSource[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_SOURCES_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveSources(sources: SyncSource[]) {
  localStorage.setItem(SYNC_SOURCES_KEY, JSON.stringify(sources))
}

export function Settings({ onClose, onDataChanged, games }: Props) {
  const [sources, setSources] = useState<SyncSource[]>(loadSources)
  const [newUrl, setNewUrl] = useState('')
  const [newType, setNewType] = useState<'wishlist' | 'library'>('wishlist')
  const [newLabel, setNewLabel] = useState('')
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<Record<string, string>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Persist sources whenever they change
  useEffect(() => { saveSources(sources) }, [sources])

  function addSource() {
    if (!newUrl.trim()) return
    const source: SyncSource = {
      id: crypto.randomUUID(),
      type: newType,
      url: newUrl.trim(),
      label: newLabel.trim() || newUrl.trim(),
      lastSynced: null,
    }
    setSources(prev => [...prev, source])
    setNewUrl('')
    setNewLabel('')
  }

  function removeSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id))
  }

  async function syncSource(source: SyncSource) {
    setSyncingId(source.id)
    setSyncResults(prev => ({ ...prev, [source.id]: 'Syncing…' }))
    try {
      let msg: string
      if (source.type === 'wishlist') {
        const r = await api.steam.importWishlist(source.url)
        msg = `Added ${r.added} games`
      } else {
        const r = await api.library.import(source.url)
        msg = `Added ${r.added} games (${r.skipped} already present, ${r.total} total in library)`
      }
      setSources(prev => prev.map(s => s.id === source.id ? { ...s, lastSynced: new Date().toISOString() } : s))
      setSyncResults(prev => ({ ...prev, [source.id]: msg }))
      onDataChanged()
    } catch (e) {
      setSyncResults(prev => ({ ...prev, [source.id]: 'Failed: ' + String(e) }))
    } finally {
      setSyncingId(null)
    }
  }

  async function syncAll() {
    for (const source of sources) {
      await syncSource(source)
    }
  }

  async function handleRefreshKeyPrices() {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const result = await api.keyforsteam.refresh()
      setRefreshResult(`Updated ${result.updated} key prices.`)
    } catch (err) {
      setRefreshResult('Refresh failed: ' + String(err))
    } finally {
      setRefreshing(false)
    }
  }

  function handleExport() {
    const json = JSON.stringify(games, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gamequeue-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="card p-6 w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        {/* Sync sources */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Steam Sync Sources</h3>
            {sources.length > 1 && (
              <button
                onClick={syncAll}
                disabled={syncingId !== null}
                className="text-xs text-[#4fd1c5] hover:text-[#38b2ac] disabled:opacity-50"
              >
                Sync all
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Add Steam wishlist or profile URLs. Wishlists sync to the Wishlist tab; Steam libraries (played games) sync to Archive.
          </p>

          {/* Saved sources */}
          {sources.length > 0 && (
            <div className="space-y-2 mb-3">
              {sources.map(source => (
                <div key={source.id} className="flex items-center gap-2 bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${source.type === 'wishlist' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {source.type === 'wishlist' ? 'Wishlist' : 'Library'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{source.label}</div>
                    {source.lastSynced && (
                      <div className="text-xs text-slate-500">Last synced: {new Date(source.lastSynced).toLocaleDateString()}</div>
                    )}
                    {syncResults[source.id] && (
                      <div className="text-xs text-[#4fd1c5]">{syncResults[source.id]}</div>
                    )}
                  </div>
                  <button
                    onClick={() => syncSource(source)}
                    disabled={syncingId === source.id}
                    className="text-xs text-slate-400 hover:text-[#4fd1c5] disabled:opacity-50 flex-shrink-0"
                  >
                    {syncingId === source.id ? '⟳' : 'Sync'}
                  </button>
                  <button
                    onClick={() => removeSource(source.id)}
                    className="text-xs text-slate-600 hover:text-red-400 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new source */}
          <div className="space-y-2 border border-[#2a2d35] rounded p-3">
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as 'wishlist' | 'library')}
                className="bg-[#20242c] border border-[#2a2d35] rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
              >
                <option value="wishlist">Wishlist</option>
                <option value="library">Library → Archive</option>
              </select>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Label (optional)"
                className="flex-1 bg-[#20242c] border border-[#2a2d35] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder={newType === 'wishlist'
                  ? 'https://store.steampowered.com/wishlist/id/USERNAME/'
                  : 'https://steamcommunity.com/id/USERNAME/ or /profiles/STEAMID64/'}
                className="flex-1 bg-[#20242c] border border-[#2a2d35] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
              />
              <button
                onClick={addSource}
                disabled={!newUrl.trim()}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Key Price Refresh */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Key Prices</h3>
          <p className="text-xs text-slate-500 mb-2">Auto-refreshes every 6 hours via cron. Manually refresh now:</p>
          <button
            onClick={handleRefreshKeyPrices}
            disabled={refreshing}
            className="btn-ghost border border-[#2a2d35] w-full text-sm"
          >
            {refreshing ? 'Refreshing…' : 'Refresh All Key Prices'}
          </button>
          {refreshResult && <p className="text-sm text-[#4fd1c5] mt-2">{refreshResult}</p>}
        </section>

        {/* Export */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Export Data</h3>
          <button onClick={handleExport} className="btn-ghost border border-[#2a2d35] w-full text-sm">
            Download as JSON ({games.length} games)
          </button>
        </section>

        {/* Danger zone */}
        <section className="border-t border-[#2a2d35] pt-4">
          <h3 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h3>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="w-full text-sm text-red-400 hover:text-red-300 border border-red-400/30 rounded py-2 transition-colors"
            >
              Delete All Games
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">This cannot be undone. Are you sure?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(false)} className="flex-1 text-sm text-slate-400 border border-[#2a2d35] rounded py-2">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="text-xs text-slate-600 mt-6 text-center">GameQueue v0.1.0</p>
      </div>
    </div>
  )
}
