import { useEffect, useState } from 'react'
import type { Game, GameStatus, SteamSearchResult, TabName } from '../lib/types'
import { Sheet } from './Sheet'
import { StatusPicker } from './StatusChip'
import { GeneratedCover } from './CoverImage'
import { api } from '../lib/api'

interface Props {
  /** Steam result to prefill from, or a plain name for a custom game */
  prefill: SteamSearchResult | { customName: string }
  activeTab: TabName
  onConfirm: (game: Partial<Game>) => Promise<unknown>
  onClose: () => void
}

function defaultStatusForTab(tab: TabName): GameStatus {
  if (tab === 'wishlist') return 'none'
  if (tab === 'archive') return 'done'
  return 'bought'
}

export function AddGameSheet({ prefill, activeTab, onConfirm, onClose }: Props) {
  const steam = 'appid' in prefill ? prefill : null
  const [details, setDetails] = useState<SteamSearchResult | null>(steam)
  const [name, setName] = useState(steam?.name ?? ('customName' in prefill ? prefill.customName : ''))
  const [price, setPrice] = useState(steam?.price ?? '')
  const [imageUrl, setImageUrl] = useState(steam?.image_url ?? '')
  const [storeUrl, setStoreUrl] = useState('')
  const [tags, setTags] = useState((steam?.tags ?? []).join(', '))
  const [status, setStatus] = useState<GameStatus>(defaultStatusForTab(activeTab))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [imgOk, setImgOk] = useState(true)

  // Search results only carry a tiny capsule; pull full details (header art, tags, players)
  useEffect(() => {
    if (!steam) return
    api.steam.app(steam.appid).then(full => {
      setDetails(full)
      setImageUrl(full.image_url)
      setPrice(full.price)
      setTags(full.tags.join(', '))
    }).catch(() => {})
  }, [steam?.appid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setImgOk(true), [imageUrl])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onConfirm({
      name: name.trim(),
      price: price.trim() || null,
      image_url: imageUrl.trim() || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      status,
      notes: notes.trim() || null,
      steam_app_id: steam?.appid ?? null,
      is_custom: !steam,
      steam_url: steam ? `https://store.steampowered.com/app/${steam.appid}/` : (storeUrl.trim() || null),
      player_count: details?.player_count ?? null,
      player_count_recent: details?.player_count_recent ?? null,
    })
    setSaving(false)
  }

  return (
    <Sheet onClose={onClose} title={steam ? 'Add game' : 'Add custom game'}>
      <form onSubmit={submit} className="px-5 pb-6 space-y-4">
        <div className="rounded-3xl overflow-hidden aspect-[460/215] bg-ink-800 [container-type:inline-size]">
          {imageUrl && imgOk
            ? <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={() => setImgOk(false)} />
            : <GeneratedCover name={name || '?'} className="w-full h-full" />}
        </div>
        {details?.description && <p className="text-sm text-ink-400 leading-relaxed">{details.description}</p>}

        <div>
          <label className="label">Name</label>
          <input required value={name} onChange={e => setName(e.target.value)} className="field" />
        </div>

        <div>
          <div className="label">Status</div>
          <StatusPicker value={status} onChange={setStatus} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Price</label>
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="CHF 29.00" className="field" />
          </div>
          <div>
            <label className="label">Tags</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="RPG, Co-op" className="field" />
          </div>
        </div>

        {!steam && (
          <>
            <div>
              <label className="label">Store link</label>
              <input value={storeUrl} onChange={e => setStoreUrl(e.target.value)} placeholder="https://… (we'll grab its picture)" className="field" />
            </div>
            <div>
              <label className="label">Cover image URL (optional)</label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Leave empty and we'll find one" className="field" />
            </div>
          </>
        )}

        <div>
          <label className="label">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="field resize-none" />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full h-12 text-base">
          {saving ? 'Adding…' : `Add to ${status === 'none' ? 'Wishlist ✨' : status === 'done' ? 'Archive 🏆' : 'Queue 🎮'}`}
        </button>
      </form>
    </Sheet>
  )
}
