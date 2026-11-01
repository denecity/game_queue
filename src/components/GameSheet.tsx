import { useEffect, useRef, useState } from 'react'
import type { Game, GameStatus, Offer } from '../lib/types'
import { Sheet } from './Sheet'
import { CoverImage } from './CoverImage'
import { StatusPicker } from './StatusChip'
import { RatingControl } from './RatingControl'
import { useArtColor } from './GameCards'
import { api } from '../lib/api'
import { formatDate, formatMoney, formatPlayerCount, formatRelativeTime, bestPrice, showToast } from '../lib/utils'

interface Props {
  game: Game
  onClose: () => void
  onUpdate: (id: string, patch: Partial<Game>) => void
  onStatus: (id: string, status: GameStatus) => void
  onDelete: (id: string) => void
  onRefreshed: () => void
}

export function GameSheet({ game, onClose, onUpdate, onStatus, onDelete, onRefreshed }: Props) {
  const color = useArtColor(game.image_url)
  const [notes, setNotes] = useState(game.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [editingCover, setEditingCover] = useState(false)
  const [coverUrl, setCoverUrl] = useState(game.image_url ?? '')
  const notesRef = useRef(notes)
  notesRef.current = notes

  // Save notes when the sheet closes (and debounced while typing)
  useEffect(() => {
    const t = setTimeout(() => { if (notes !== (game.notes ?? '')) onUpdate(game.id, { notes: notes || null }) }, 900)
    return () => clearTimeout(t)
  }, [notes]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    if (notesRef.current !== (game.notes ?? '')) onUpdate(game.id, { notes: notesRef.current || null })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshPrices() {
    setRefreshing(true)
    try {
      await api.prices.refresh({ ids: [game.id] })
      onRefreshed()
    } catch (e) {
      showToast('Price refresh failed: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  async function findCover() {
    try {
      const { images } = await api.images.repair({ ids: [game.id] })
      const url = images[game.id]
      if (url && url !== game.image_url) { onUpdate(game.id, { image_url: url }); setCoverUrl(url); showToast('Found a new cover ✨', 'success') }
      else showToast('No better cover found. Paste an image URL instead.', 'info')
    } catch {
      showToast('Cover search failed', 'error')
    }
  }

  const best = bestPrice(game)
  const storeOffers = game.offers.filter(o => o.kind === 'store')
  const keyOffers = game.offers.filter(o => o.kind === 'key')
  const tint = color ?? '167 139 250'

  return (
    <Sheet
      onClose={onClose}
      bare
      wide
      panelStyle={{ background: `linear-gradient(180deg, rgb(${tint} / .28) 0%, #0c0e14 46%)` }}
    >
      <div className="relative">
        <CoverImage id={game.id} name={game.name} src={game.image_url} eager className="aspect-[460/215] w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent" />
      </div>

      <div className="px-5 -mt-8 relative space-y-6 pb-8">
        <div>
          <h2 className="font-display text-[26px] leading-tight font-extrabold drop-shadow-lg">{game.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {game.steam_url && (
              <a href={game.steam_url} target="_blank" rel="noopener noreferrer" className="chip bg-white/[.08] text-ink-200 hover:bg-white/[.14]">
                {game.steam_url.includes('steampowered') ? 'Steam' : 'Store'} ↗
              </a>
            )}
            {game.tags.slice(0, 6).map(t => (
              <span key={t} className="chip bg-white/[.04] text-ink-400 font-medium">{t}</span>
            ))}
          </div>
        </div>

        <section>
          <div className="label">Status</div>
          <StatusPicker value={game.status} onChange={s => onStatus(game.id, s)} />
        </section>

        <section>
          <div className="label">Your rating</div>
          <RatingControl value={game.rating} onChange={r => onUpdate(game.id, { rating: r })} />
        </section>

        {(game.price || game.offers.length > 0 || game.steam_app_id) && (
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <div className="label mb-0">Prices</div>
              {game.steam_app_id && (
                <button onClick={refreshPrices} disabled={refreshing} className="text-xs font-semibold text-pop-violet hover:text-pop-pink disabled:opacity-50">
                  {refreshing ? 'Checking…' : '↻ Refresh'}
                </button>
              )}
            </div>
            <div className="rounded-3xl bg-white/[.03] ring-1 ring-white/[.06] divide-y divide-white/[.05] overflow-hidden">
              {game.price && (
                <PriceRow shop="Steam" price={game.price} url={game.steam_url} best={best?.source === 'Steam'} />
              )}
              {storeOffers.filter(o => o.shop !== 'Steam').map((o, i) => <OfferRow key={`s${i}`} offer={o} best={best?.url === o.url && best.source === o.shop} />)}
              {keyOffers.length > 0 && (
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Keyshops via keyforsteam</div>
              )}
              {keyOffers.map((o, i) => <OfferRow key={`k${i}`} offer={o} best={i === 0 && best?.source === o.shop} />)}
              {!game.offers.length && game.key_price && game.key_price_url && (
                <PriceRow shop={`🔑 ${game.key_shop ?? 'Best key'}`} price={game.key_price} url={game.key_price_url} best={best?.url === game.key_price_url} />
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
              {game.historical_low != null && <span>All-time low {formatMoney(game.historical_low, game.deal_currency ?? 'CHF')}</span>}
              {game.prices_checked && <span>Checked {formatRelativeTime(game.prices_checked)}</span>}
            </div>
          </section>
        )}

        <section>
          <div className="label">Notes</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Why you want it, who to play with, where you left off…"
            rows={3}
            className="field resize-none"
          />
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Players" value={formatPlayerCount(game.player_count) ?? '—'} />
          <Stat label="Hours" value={game.hours_played ? `${game.hours_played}h` : '—'} />
          <Stat label="Added" value={formatDate(game.date_added)} />
          <Stat label="Finished" value={game.date_completed ? formatDate(game.date_completed) : '—'} />
        </section>

        <section>
          {editingCover ? (
            <div className="flex gap-2">
              <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://…/cover.jpg" className="field" />
              <button className="btn-soft" onClick={() => { onUpdate(game.id, { image_url: coverUrl.trim() || null }); setEditingCover(false) }}>Save</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn-soft text-sm" onClick={findCover}>🖼️ Find a better cover</button>
              <button className="btn-soft text-sm" onClick={() => setEditingCover(true)}>✏️ Custom cover URL</button>
            </div>
          )}
        </section>

        <section className="pt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { onDelete(game.id); onClose() }} className="btn flex-1 bg-pop-coral text-ink-950">Yes, remove it</button>
              <button onClick={() => setConfirmDelete(false)} className="btn-soft flex-1">Keep</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-sm text-ink-500 hover:text-pop-coral transition-colors">🗑 Remove from library</button>
          )}
        </section>
      </div>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[.03] ring-1 ring-white/[.06] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="font-display font-bold mt-0.5 truncate">{value}</div>
    </div>
  )
}

function PriceRow({ shop, price, url, best, cut }: { shop: string; price: string; url: string | null; best?: boolean; cut?: number }) {
  const inner = (
    <>
      <span className="flex-1 min-w-0 truncate font-medium">{shop}</span>
      {cut != null && cut > 0 && <span className="chip bg-pop-lime/15 text-pop-lime px-2 py-0.5 text-[11px]">-{cut}%</span>}
      <span className={`font-mono ${best ? 'text-pop-lime font-bold' : 'text-ink-200'}`}>{price}</span>
      {best && <span className="text-[10px] font-bold uppercase tracking-wider bg-pop-lime text-ink-950 rounded-full px-1.5 py-0.5">Best</span>}
    </>
  )
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 hover:bg-white/[.04] transition-colors">{inner}</a>
    : <div className="flex items-center gap-2 px-4 py-3">{inner}</div>
}

function OfferRow({ offer, best }: { offer: Offer; best?: boolean }) {
  return <PriceRow shop={offer.shop} price={formatMoney(offer.price, offer.currency) ?? ''} url={offer.url} cut={offer.cut} best={best} />
}
