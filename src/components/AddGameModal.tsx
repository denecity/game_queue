import { useState } from 'react'
import type { Game, GameStatus, SteamSearchResult } from '../lib/types'

interface Props {
  prefill: SteamSearchResult | null
  onConfirm: (game: Partial<Game>) => void
  onClose: () => void
}

export function AddGameModal({ prefill, onConfirm, onClose }: Props) {
  const [name, setName] = useState(prefill?.name ?? '')
  const [price, setPrice] = useState(prefill?.price ?? '')
  const [imageUrl, setImageUrl] = useState(prefill?.image_url ?? '')
  const [tags, setTags] = useState((prefill?.tags ?? []).join(', '))
  const [status, setStatus] = useState<GameStatus>('none')
  const [notes, setNotes] = useState('')

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
      steam_url: prefill?.appid ? `https://store.steampowered.com/app/${prefill.appid}/` : null,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-md shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {prefill ? 'Add Game' : 'Add Custom Game'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

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
              <label className="block text-xs text-slate-400 mb-1">Initial Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as GameStatus)}
                className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
              >
                <option value="none">Wishlist</option>
                <option value="bought">Bought</option>
                <option value="installed">Installed</option>
                <option value="playing">Playing</option>
              </select>
            </div>
          </div>

          {!prefill && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Image URL</label>
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
              />
            </div>
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
              Add to {status === 'none' ? 'Wishlist' : 'Queue'}
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
