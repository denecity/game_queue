import { useState, useRef, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Game } from '../lib/types'
import { StatusBadge } from './StatusBadge'
import { RatingSelector } from './RatingSelector'
import {
  formatPlayerCount, formatRelativeTime, formatDate, isKeyPriceStale
} from '../lib/utils'

interface Props {
  game: Game
  onUpdate: (id: string, patch: Partial<Game>) => void
  onDelete: (id: string) => void
  draggable: boolean
}

function GameImage({ game }: { game: Game }) {
  const [errored, setErrored] = useState(false)
  if (!game.image_url || errored) {
    return (
      <div className="w-24 h-11 rounded bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
        <span className="text-lg">🎮</span>
      </div>
    )
  }
  return (
    <img
      src={game.image_url}
      alt={game.name}
      className="w-24 h-11 rounded object-cover flex-shrink-0"
      onError={() => setErrored(true)}
    />
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
        className="flex items-center gap-3 p-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Drag handle */}
        <div
          {...(draggable ? { ...attributes, ...listeners } : {})}
          className={`flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors px-1
            ${draggable ? 'cursor-grab active:cursor-grabbing' : 'opacity-0 pointer-events-none'}`}
          onClick={e => e.stopPropagation()}
        >
          ⠿
        </div>

        {/* Image */}
        <GameImage game={game} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-100 truncate text-sm">{game.name}</div>
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
        <div className="flex-shrink-0 text-right flex flex-col items-end gap-1" onClick={e => e.stopPropagation()}>
          {game.price && (
            <div className="text-sm text-slate-300 font-mono">{game.price}</div>
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
          <div className="flex gap-4">
            {/* Large image */}
            {game.image_url && (
              <img
                src={game.image_url}
                alt={game.name}
                className="w-40 h-[74px] rounded object-cover flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-100 text-base">{game.name}</div>
              <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-1">
                {game.tags.map(t => (
                  <span key={t} className="bg-[#20242c] border border-[#2a2d35] px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <div className="flex flex-col">
                  {game.price && <span className="font-mono text-slate-300">{game.price}</span>}
                  {game.key_price && game.key_price_url && (
                    <a
                      href={game.key_price_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#4fd1c5] hover:underline"
                    >
                      🔑 {game.key_price} {keyStale && <span title="Price may be outdated">⏳</span>}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                {game.player_count != null && (
                  <span>~{formatPlayerCount(game.player_count)} all-time{game.player_count_recent ? ` · ~${formatPlayerCount(game.player_count_recent)} recently` : ''}</span>
                )}
                {game.key_price_updated && (
                  <span>Key updated {formatRelativeTime(game.key_price_updated)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Hours + links */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <label className="flex items-center gap-2 text-slate-400">
              Hours played:
              <input
                type="number"
                min={0}
                step={0.5}
                defaultValue={game.hours_played}
                onBlur={e => onUpdate(game.id, { hours_played: parseFloat(e.target.value) || 0 })}
                className="bg-[#20242c] border border-[#2a2d35] rounded px-2 py-0.5 w-20 text-slate-200 focus:outline-none focus:border-[#4fd1c5]"
                onClick={e => e.stopPropagation()}
              />
              hrs
            </label>
            {game.steam_url && (
              <a
                href={game.steam_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4fd1c5] hover:text-[#38b2ac] text-xs"
              >
                🔗 Steam
              </a>
            )}
            {game.key_price_url && (
              <a
                href={game.key_price_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4fd1c5] hover:text-[#38b2ac] text-xs"
              >
                🔑 Keys
              </a>
            )}
          </div>

          {/* Dates */}
          <div className="flex gap-6 mt-2 text-xs text-slate-500">
            <span title={game.date_added}>Added {formatRelativeTime(game.date_added)} ({formatDate(game.date_added)})</span>
            {game.date_completed && (
              <span title={game.date_completed}>Completed {formatRelativeTime(game.date_completed)} ({formatDate(game.date_completed)})</span>
            )}
          </div>

          {/* Notes */}
          <div className="mt-3">
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
          <div className="flex justify-between items-center mt-3">
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

      {/* Rating prompt modal (when archiving without rating) */}
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
