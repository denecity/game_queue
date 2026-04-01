import { useState, useRef, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Game } from '../lib/types'
import { StatusBadge } from './StatusBadge'
import { RatingSelector } from './RatingSelector'
import { formatPlayerCount, formatRelativeTime, formatDate, isKeyPriceStale } from '../lib/utils'

interface Props {
  game: Game
  onUpdate: (id: string, patch: Partial<Game>) => void
  onDelete: (id: string) => void
  draggable: boolean
}

// Steam header images are 460×215 px → ratio 460/215 ≈ 2.14
// We fix the width and let the height follow: h = w / 2.14
// Using w-[107px] → h ≈ 50px, close enough; we use aspect-[460/215]
function GameImage({ game }: { game: Game }) {
  const [errored, setErrored] = useState(false)
  if (!game.image_url || errored) {
    return (
      <div
        className="flex-shrink-0 self-stretch bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center rounded overflow-hidden"
        style={{ aspectRatio: '460/215', height: '100%' }}
      >
        <span className="text-lg">🎮</span>
      </div>
    )
  }
  return (
    <div
      className="flex-shrink-0 self-stretch overflow-hidden rounded"
      style={{ aspectRatio: '460/215', height: '100%' }}
    >
      <img
        src={game.image_url}
        alt={game.name}
        className="w-full h-full object-cover"
        onError={() => setErrored(true)}
      />
    </div>
  )
}

export function GameCard({ game, onUpdate, onDelete, draggable }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: game.id, disabled: !draggable })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  const handleStatusChange = useCallback((newStatus: Parameters<typeof onUpdate>[1]['status']) => {
    if (!newStatus) return
    if (newStatus === 'done' && game.rating == null) {
      setPendingStatus(newStatus as string)
    } else {
      onUpdate(game.id, { status: newStatus })
    }
  }, [game.id, game.rating, onUpdate])

  const handleNotesChange = useCallback((notes: string) => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      onUpdate(game.id, { notes })
    }, 1000)
  }, [game.id, onUpdate])

  const keyStale = isKeyPriceStale(game.key_price_updated)

  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className={`card card-hover mb-2 ${isDragging ? 'shadow-2xl' : ''}`}
    >
      {/* Collapsed row */}
      <div
        className="flex items-stretch gap-0 cursor-pointer select-none overflow-hidden rounded-lg"
        style={{ minHeight: '64px' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Drag handle */}
        <div
          {...(draggable ? { ...attributes, ...listeners } : {})}
          className={`flex-shrink-0 flex items-center text-slate-600 hover:text-slate-400 transition-colors px-2
            ${draggable ? 'cursor-grab active:cursor-grabbing' : 'opacity-0 pointer-events-none w-0'}`}
          onClick={e => e.stopPropagation()}
        >
          ⠿
        </div>

        {/* Image — fills full height */}
        <GameImage game={game} />

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-slate-100 truncate text-sm">{game.name}</div>
            {game.steam_url && (
              <a
                href={game.steam_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-[#4fd1c5] transition-colors flex-shrink-0 text-xs"
                title="Open on Steam"
                onClick={e => e.stopPropagation()}
              >
                ↗
              </a>
            )}
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {game.tags.slice(0, 3).join(', ') || (game.is_custom ? 'Custom' : '')}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={game.status} onChange={handleStatusChange} />
            {game.player_count != null && (
              <span className="text-xs text-slate-500">
                {formatPlayerCount(game.player_count)} ♟
              </span>
            )}
          </div>
        </div>

        {/* Price + Rating */}
        <div className="flex-shrink-0 text-right flex flex-col items-end justify-center gap-1 pr-3" onClick={e => e.stopPropagation()}>
          {game.price && (
            game.steam_url
              ? <a href={game.steam_url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-300 font-mono hover:text-[#4fd1c5] transition-colors" onClick={e => e.stopPropagation()}>{game.price}</a>
              : <div className="text-sm text-slate-300 font-mono">{game.price}</div>
          )}
          {game.key_price && game.key_price_url && (
            <a
              href={game.key_price_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#4fd1c5] hover:text-[#38b2ac] flex items-center gap-0.5"
              title={keyStale ? 'Price may be outdated' : 'Best key price'}
              onClick={e => e.stopPropagation()}
            >
              🔑 {game.key_price}{keyStale && ' ⏳'}
            </a>
          )}
          <RatingSelector
            rating={game.rating}
            onChange={r => onUpdate(game.id, { rating: r })}
          />
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-[#2a2d35] px-4 py-3 animate-fade-in">
          {/* Tags + player counts + dates */}
          <div className="flex flex-wrap gap-1 mb-2">
            {game.tags.map(t => (
              <span key={t} className="bg-[#20242c] border border-[#2a2d35] text-xs px-2 py-0.5 rounded-full text-slate-400">{t}</span>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-3">
            {game.player_count != null && (
              <span>♟ ~{formatPlayerCount(game.player_count)} all-time{game.player_count_recent ? ` · ~${formatPlayerCount(game.player_count_recent)} recently` : ''}</span>
            )}
            {game.key_price_updated && (
              <span>Key updated {formatRelativeTime(game.key_price_updated)}{keyStale ? ' ⏳' : ''}</span>
            )}
            <span title={game.date_added}>Added {formatDate(game.date_added)}</span>
            {game.date_completed && (
              <span title={game.date_completed}>Completed {formatDate(game.date_completed)}</span>
            )}
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              defaultValue={game.notes ?? ''}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Add notes..."
              className="w-full bg-[#20242c] border border-[#2a2d35] rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#4fd1c5] resize-none min-h-[80px]"
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Are you sure?</span>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(game.id) }}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded px-2 py-1"
                >
                  Delete
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                🗑 Delete
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); setExpanded(false) }}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Collapse ▲
            </button>
          </div>
        </div>
      )}

      {/* Rating prompt when archiving unrated game */}
      {pendingStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPendingStatus(null)}
        >
          <div className="card p-6 w-80 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-100 mb-2">Rate before archiving?</h3>
            <p className="text-sm text-slate-400 mb-4">You haven't rated <strong className="text-slate-200">{game.name}</strong> yet.</p>
            <RatingSelector
              rating={game.rating}
              onChange={r => {
                onUpdate(game.id, { rating: r, status: pendingStatus as Game['status'] })
                setPendingStatus(null)
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { onUpdate(game.id, { status: pendingStatus as Game['status'] }); setPendingStatus(null) }}
                className="flex-1 text-sm text-slate-400 hover:text-slate-200 border border-[#2a2d35] rounded py-1.5"
              >
                Skip
              </button>
              <button
                onClick={() => setPendingStatus(null)}
                className="flex-1 text-sm text-slate-400 hover:text-slate-200 border border-[#2a2d35] rounded py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
