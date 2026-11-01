import { useEffect, useState } from 'react'
import type { Game, SyncSource } from '../lib/types'
import { api } from '../lib/api'
import { Sheet } from './Sheet'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { readLocal, showToast } from '../lib/utils'

interface Props {
  games: Game[]
  onClose: () => void
  onDataChanged: () => void
}

const LEGACY_SOURCES_KEY = 'gq_sync_sources'

function Section({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/[.03] ring-1 ring-white/[.06] p-4">
      <h3 className="font-display font-bold text-base">{title}</h3>
      {hint && <p className="text-xs text-ink-400 mt-1 mb-3 leading-relaxed">{hint}</p>}
      {!hint && <div className="h-3" />}
      {children}
    </section>
  )
}

export function Settings({ games, onClose, onDataChanged }: Props) {
  const install = useInstallPrompt()
  const [sources, setSources] = useState<SyncSource[] | null>(null)
  const [newUrl, setNewUrl] = useState('')
  const [newType, setNewType] = useState<'wishlist' | 'library'>('wishlist')
  const [syncState, setSyncState] = useState<Record<string, string>>({})
  const [priceProgress, setPriceProgress] = useState<string | null>(null)
  const [imageState, setImageState] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  // Sync sources live in D1 so they follow you to your phone; migrate any old localStorage list once
  useEffect(() => {
    api.settings.get().then(s => {
      const server = (s.sync_sources as SyncSource[] | undefined) ?? []
      const legacy = readLocal<SyncSource[]>(LEGACY_SOURCES_KEY, [])
      if (!server.length && legacy.length) {
        setSources(legacy)
        api.settings.put({ sync_sources: legacy }).then(() => localStorage.removeItem(LEGACY_SOURCES_KEY)).catch(() => {})
      } else {
        setSources(server)
      }
    }).catch(() => setSources(readLocal<SyncSource[]>(LEGACY_SOURCES_KEY, [])))
  }, [])

  function saveSources(next: SyncSource[]) {
    setSources(next)
    api.settings.put({ sync_sources: next }).catch(() => showToast('Could not save sync sources', 'error'))
  }

  function addSource() {
    if (!newUrl.trim() || !sources) return
    saveSources([...sources, { id: crypto.randomUUID(), type: newType, url: newUrl.trim(), label: newUrl.trim(), lastSynced: null }])
    setNewUrl('')
  }

  async function sync(source: SyncSource) {
    setSyncState(s => ({ ...s, [source.id]: '⏳ Syncing…' }))
    try {
      const r = source.type === 'wishlist'
        ? await api.steam.importWishlist(source.url)
        : await api.steam.importLibrary(source.url)
      setSyncState(s => ({ ...s, [source.id]: `✓ ${r.added} new, ${r.skipped} already here` }))
      setSources(prev => {
        const next = (prev ?? []).map(x => x.id === source.id ? { ...x, lastSynced: new Date().toISOString() } : x)
        api.settings.put({ sync_sources: next }).catch(() => {})
        return next
      })
      onDataChanged()
    } catch (e) {
      setSyncState(s => ({ ...s, [source.id]: '✗ ' + (e instanceof Error ? e.message : String(e)) }))
    }
  }

  async function refreshAllPrices() {
    const before = new Date().toISOString()
    const total = games.filter(g => g.steam_app_id).length
    let lastRemaining = Infinity
    let stalled = 0
    try {
      for (;;) {
        const r = await api.prices.refresh({ before })
        setPriceProgress(`${total - r.remaining} / ${total} checked…`)
        if (r.remaining === 0 || r.processed === 0) break
        // keyforsteam may be rate-limiting; give up after a few rounds without progress
        stalled = r.remaining >= lastRemaining ? stalled + 1 : 0
        if (stalled >= 3) { setPriceProgress('Paused: a price source is rate-limiting. The rest will update in the background.'); onDataChanged(); return }
        lastRemaining = r.remaining
        await new Promise(res => setTimeout(res, 1200))
      }
      setPriceProgress(`✓ All ${total} games checked`)
      onDataChanged()
    } catch (e) {
      setPriceProgress('✗ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function repairImages() {
    setImageState('Looking for covers…')
    try {
      const { images } = await api.images.repair({ all: true })
      const n = Object.values(images).filter(Boolean).length
      setImageState(`✓ Checked ${n} covers`)
      onDataChanged()
    } catch (e) {
      setImageState('✗ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(games, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gamequeue-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteAll() {
    try {
      await api.games.removeAll()
      setConfirmText('')
      showToast('Library wiped', 'info')
      onDataChanged()
    } catch (e) {
      showToast('Delete failed: ' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return (
    <Sheet onClose={onClose} title="Settings" wide>
      <div className="px-5 pb-8 space-y-3">
        {!install.installed && (
          <Section title="📲 Install the app" hint="Get GameQueue on your home screen. It opens full-screen and works offline with your last synced list.">
            {install.canPrompt ? (
              <button onClick={install.install} className="btn-primary w-full">Install GameQueue</button>
            ) : install.iosHint ? (
              <p className="text-sm text-ink-300">In Safari, tap <b>Share</b> <span aria-hidden>⎋</span>, then <b>Add to Home Screen</b>.</p>
            ) : (
              <p className="text-sm text-ink-300">Use your browser menu: <b>Install app</b> or <b>Add to Home screen</b>.</p>
            )}
          </Section>
        )}

        <Section title="🔄 Steam sync" hint="Wishlists land in Wishlist. Libraries bring your 100 most-played games into Archive.">
          <div className="space-y-2">
            {sources === null && <div className="h-12 rounded-2xl skeleton" />}
            {sources?.map(s => (
              <div key={s.id} className="flex items-center gap-2 rounded-2xl bg-ink-800 px-3 py-2.5">
                <span className={`chip flex-shrink-0 ${s.type === 'wishlist' ? 'bg-pop-violet/15 text-pop-violet' : 'bg-pop-pink/15 text-pop-pink'}`}>
                  {s.type === 'wishlist' ? '✨ Wishlist' : '🏆 Library'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{s.label}</div>
                  <div className="text-[11px] text-ink-500 truncate">
                    {syncState[s.id] ?? (s.lastSynced ? `Synced ${new Date(s.lastSynced).toLocaleDateString()}` : 'Never synced')}
                  </div>
                </div>
                <button onClick={() => sync(s)} className="btn-soft text-xs px-3 py-1.5">Sync</button>
                <button onClick={() => saveSources(sources.filter(x => x.id !== s.id))} className="btn-icon w-8 h-8 text-ink-500 hover:text-pop-coral" aria-label="Remove">✕</button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <select value={newType} onChange={e => setNewType(e.target.value as 'wishlist' | 'library')} className="field w-auto px-3">
                <option value="wishlist">Wishlist</option>
                <option value="library">Library</option>
              </select>
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="steamcommunity.com/id/you"
                className="field"
                onKeyDown={e => e.key === 'Enter' && addSource()}
              />
              <button onClick={addSource} disabled={!newUrl.trim()} className="btn-soft">Add</button>
            </div>
          </div>
        </Section>

        <Section title="💸 Prices" hint="Keyshop prices come from keyforsteam and store deals from IsThereAnyDeal. A background job keeps them fresh. This checks everything now.">
          <button onClick={refreshAllPrices} disabled={!!priceProgress && priceProgress.endsWith('…')} className="btn-soft w-full">
            Refresh all prices
          </button>
          {priceProgress && <p className="text-xs text-ink-300 mt-2">{priceProgress}</p>}
        </Section>

        <Section title="🖼️ Covers" hint="Re-fetch artwork for every Steam game. Broken covers also fix themselves as you scroll.">
          <button onClick={repairImages} className="btn-soft w-full">Repair all covers</button>
          {imageState && <p className="text-xs text-ink-300 mt-2">{imageState}</p>}
        </Section>

        <Section title="📦 Backup">
          <button onClick={exportJson} className="btn-soft w-full">Download JSON ({games.length} games)</button>
        </Section>

        <Section title="⚠️ Danger zone" hint='Type "DELETE ALL" to permanently remove every game.'>
          <div className="flex gap-2">
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE ALL" className="field" />
            <button onClick={deleteAll} disabled={confirmText !== 'DELETE ALL'} className="btn bg-pop-coral text-ink-950">Wipe</button>
          </div>
        </Section>

        <p className="text-center text-xs text-ink-600 pt-2">GameQueue v0.2 · made with ✨</p>
      </div>
    </Sheet>
  )
}
