import { useState } from 'react'
import type { Game, GameStatus, SteamSearchResult, TabName } from '../lib/types'

interface Props {
  prefill: SteamSearchResult | null
  activeTab: TabName
  pendingQueue?: SteamSearchResult[]          // multiple games queued for bulk-add
  onConfirm: (game: Partial<Game>) => void
  onConfirmAll?: (games: Partial<Game>[]) => void
  onRemoveFromQueue?: (appid: number) => void
  onClose: () => void
}

function defaultStatusForTab(tab: TabName): GameStatus {
  if (tab === 'wishlist') return 'none'
  if (tab === 'archive') return 'done'
  return 'bought'
}

export function AddGameModal({
  prefill, activeTab, pendingQueue = [], onConfirm, onConfirmAll, onRemoveFromQueue, onClose
}: Props) {
  const [name, setName] = useState(prefill?.name ?? '')
  const [price, setPrice] = useState(prefill?.price ?? '')
  const [imageUrl, setImageUrl] = useState(prefill?.image_url ?? '')
  const [storeUrl, setStoreUrl] = useState('')
  const [tags, setTags] = useState((prefill?.tags ?? []).join(', '))
  const [status, setStatus] = useState<GameStatus>(defaultStatusForTab(activeTab))
  const [notes, setNotes] = useState('')

  const hasBulk = pendingQueue.length > 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onConfirm({
      name: name.trim(),
      price: price.trim() || null,
      image_url: imageUrl.trim() || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      status,
      notes: notes.trim() || null,
      steam_app_id: prefill?.appid ?? null,
      is_custom: !prefill?.appid,
      steam_url: prefill?.appid
        ? `https://store.steampowered.com/app/${prefill.appid}/`
        : (storeUrl.trim() || null),
    })
  }

  function addAll() {
    if (!onConfirmAll) return
    const all = [prefill, ...pendingQueue].filter(Boolean) as SteamSearchResult[]
    onConfirmAll(all.map(r => ({
      name: r.name,
      price: r.price || null,
      image_url: r.image_url || null,
      tags: r.tags ?? [],
      status,
      steam_app_id: r.appid,
      is_custom: false,
      steam_url: `https://store.steampowered.com/app/${r.appid}/`,
    })))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {prefill ? 'Add Game' : 'Add Custom Game'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        {/* Bulk queue preview */}
        {hasBulk && (
          <div className="mb-4 border border-[#2a2d35] rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-[#20242c] text-xs text-slate-400 flex justify-between items-center">
              <span>{pendingQueue.length + (prefill ? 1 : 0)} games queued</span>
              <button onClick={addAll} className="text-[#4fd1c5] hover:text-[#38b2ac] font-medium">Add all →</button>
            </div>
            <div className="max-h-36 overflow-y-auto">
              {prefill && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2a2d35]">
                  {prefill.image_url && <img src={prefill.image_url} alt="" className="w-10 h-[18px] rounded object-cover" />}
                  <span className="text-xs text-slate-200 flex-1 truncate">{prefill.name}</span>
                  <span className="text-xs text-slate-500 font-mono">{prefill.price}</span>
                </div>
              )}
              {pendingQueue.map(r => (
                <div key={r.appid} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2a2d35] last:border-0">
                  {r.image_url && <img src={r.image_url} alt="" className="w-10 h-[18px] rounded object-cover" />}
                  <span className="text-xs text-slate-200 flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-slate-500 font-mono mr-2">{r.price}</span>
                  {onRemoveFromQueue && (
                    <button onClick={() => onRemoveFromQueue(r.appid)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview image */}
        {(prefill?.image_url || imageUrl) && (
          <img
            src={prefill?.image_url || imageUrl}
            alt={name}
            className="w-full h-24 object-cover rounded mb-4"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Steam Price</label>
              <input
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. CHF 29.00"
                className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as GameStatus)}
                className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
              >
                <option value="none">Wishlist</option>
                <option value="bought">Bought</option>
                <option value="installed">Installed</option>
                <option value="playing">Playing</option>
                <option value="done">Done (Archive)</option>
              </select>
            </div>
          </div>

          {!prefill && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Store / Product URL</label>
                <input
                  value={storeUrl}
                  onChange={e => setStoreUrl(e.target.value)}
                  placeholder="https://store.steampowered.com/app/... or any store link"
                  className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Image URL</label>
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="RPG, Open World, Singleplayer"
              className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5] resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1">
              Add to {status === 'none' ? 'Wishlist' : status === 'done' ? 'Archive' : 'Queue'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost flex-1 border border-[#2a2d35]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
