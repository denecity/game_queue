import { useState } from 'react'
import type { Game } from '../lib/types'
import { api } from '../lib/api'

interface Props {
  onClose: () => void
  onImportWishlist: (url: string) => void
  games: Game[]
}

export function Settings({ onClose, onImportWishlist, games }: Props) {
  const [wishlistUrl, setWishlistUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteConfirm2, setDeleteConfirm2] = useState(false)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!wishlistUrl.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.steam.importWishlist(wishlistUrl.trim())
      setImportResult(`Added ${result.added} games to your Wishlist.`)
      if (result.added > 0) onImportWishlist(wishlistUrl)
    } catch (err) {
      setImportResult('Import failed: ' + String(err))
    } finally {
      setImporting(false)
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        {/* Import */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Import Steam Wishlist</h3>
          <form onSubmit={handleImport} className="space-y-2">
            <input
              value={wishlistUrl}
              onChange={e => setWishlistUrl(e.target.value)}
              placeholder="https://store.steampowered.com/wishlist/id/USERNAME/"
              className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
            />
            <button
              type="submit"
              disabled={importing}
              className="btn-primary w-full"
            >
              {importing ? 'Importing…' : 'Import Wishlist'}
            </button>
          </form>
          {importResult && (
            <p className="text-sm text-[#4fd1c5] mt-2">{importResult}</p>
          )}
        </section>

        {/* Export */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Export Data</h3>
          <button onClick={handleExport} className="btn-ghost border border-[#2a2d35] w-full text-sm">
            Download as JSON ({games.length} games)
          </button>
        </section>

        {/* Key Price Refresh */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Refresh Key Prices</h3>
          <p className="text-xs text-slate-500 mb-2">Manually refresh all key prices from keyforsteam.de (auto-refreshes every 6 hours).</p>
          <button
            onClick={handleRefreshKeyPrices}
            disabled={refreshing}
            className="btn-ghost border border-[#2a2d35] w-full text-sm"
          >
            {refreshing ? 'Refreshing…' : 'Refresh All Key Prices'}
          </button>
          {refreshResult && <p className="text-sm text-[#4fd1c5] mt-2">{refreshResult}</p>}
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
          ) : !deleteConfirm2 ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">Are you absolutely sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm2(true)}
                  className="flex-1 text-sm text-red-400 border border-red-400/30 rounded py-2"
                >
                  Yes, delete everything
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 text-sm text-slate-400 border border-[#2a2d35] rounded py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">
              Feature disabled in this build for safety. Delete games individually.
            </div>
          )}
        </section>

        <p className="text-xs text-slate-600 mt-6 text-center">GameQueue v0.1.0</p>
      </div>
    </div>
  )
}
