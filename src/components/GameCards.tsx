import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DraggableSyntheticListeners, DraggableAttributes } from '@dnd-kit/core'
import type { Game, GameStatus } from '../lib/types'
import { CoverImage } from './CoverImage'
import { StatusChip } from './StatusChip'
import { artColor, cachedArtColor } from '../lib/color'
import { bestPrice, nextStatus, prevStatus, STATUS_META, haptic } from '../lib/utils'

export interface DragHandleProps {
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}

export interface CardProps {
  game: Game
  onOpen: (id: string) => void
  onStatus: (id: string, status: GameStatus) => void
  handle?: DragHandleProps
  dragging?: boolean
}

export function useArtColor(url: string | null): string | null {
  const [color, setColor] = useState(() => cachedArtColor(url))
  useEffect(() => {
    if (!url) return
    const cached = cachedArtColor(url)
    if (cached) { setColor(cached); return }
    let alive = true
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200))
    idle(() => artColor(url).then(c => { if (alive && c) setColor(c) }))
    return () => { alive = false }
  }, [url])
  return color
}

function DragHandle({ handle, className = '' }: { handle: DragHandleProps; className?: string }) {
  return (
    <button
      type="button"
      {...handle.attributes}
      {...handle.listeners}
      onClick={e => e.stopPropagation()}
      className={`touch-none cursor-grab active:cursor-grabbing select-none flex items-center justify-center text-ink-300 hover:text-ink-100 ${className}`}
      aria-label="Drag to reorder"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
        {[3, 7, 11].flatMap(y => [4, 10].map(x => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" />))}
      </svg>
    </button>
  )
}

function PriceLine({ game, compact }: { game: Game; compact?: boolean }) {
  const best = bestPrice(game)
  const steamIsBest = best?.source === 'Steam'
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'justify-end' : 'flex-wrap'}`}>
      {game.deal_cut != null && game.deal_cut > 0 && (
        <span className="chip bg-pop-lime text-ink-950 px-2 py-0.5 text-[11px]">-{game.deal_cut}%</span>
      )}
      {best && (
        <span className="chip bg-white/[.07] text-ink-100 font-mono px-2 py-0.5 text-[12px]" title={`Best price via ${best.source}`}>
          {!steamIsBest && <span aria-hidden>🔑</span>}{best.label}
        </span>
      )}
      {!compact && best && !steamIsBest && game.price && (
        <span className="text-[11px] text-ink-500 font-mono line-through decoration-ink-600">{game.price}</span>
      )}
    </div>
  )
}

/** Big art-forward card for the covers grid. */
export const CoverCard = memo(function CoverCard({ game, onOpen, onStatus, handle, dragging }: CardProps) {
  const color = useArtColor(game.image_url)
  const glow = color ?? hexToRgbTriplet(STATUS_META[game.status].color)
  const next = nextStatus(game.status)

  return (
    <article
      onClick={() => onOpen(game.id)}
      className={`group relative rounded-3xl overflow-hidden cursor-pointer bg-ink-850 ring-1 ring-white/[.06]
        transition duration-300 ease-out hover:-translate-y-1 hover:ring-white/20 active:scale-[.98]
        ${dragging ? 'scale-[1.03] rotate-1 ring-2 ring-pop-violet z-10' : ''}`}
      style={{ boxShadow: `0 18px 40px -22px rgb(${glow} / .75)` } as CSSProperties}
    >
      <div className="relative aspect-[460/215]">
        <CoverImage id={game.id} name={game.name} src={game.image_url} className="absolute inset-0" imgClassName="group-hover:scale-105 transition-transform duration-700 ease-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
          {handle
            ? <DragHandle handle={handle} className="w-8 h-8 rounded-xl bg-ink-950/55 backdrop-blur-md" />
            : <span />}
          {game.rating != null && (
            <span className="chip bg-ink-950/60 backdrop-blur-md text-pop-amber font-mono">★ {game.rating.toFixed(1)}</span>
          )}
        </div>
        <div className="absolute bottom-0 inset-x-0 p-3.5 pt-8">
          <h3 className="font-display font-bold text-[17px] leading-tight text-white line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,.8)]">
            {game.name}
          </h3>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 pb-3 pt-1">
        <StatusChip
          status={game.status}
          onClick={next ? () => { haptic(12); onStatus(game.id, next) } : undefined}
        />
        <PriceLine game={game} compact />
      </div>
      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, rgb(${glow} / .8), transparent)` }} />
    </article>
  )
})

const SWIPE_TRIGGER = 84

/** Compact row for list view. Swipe right to move to the next status, left to step back. */
export const ListRow = memo(function ListRow({ game, onOpen, onStatus, handle, dragging }: CardProps) {
  const [dx, setDx] = useState(0)
  const gesture = useRef<{ x: number; y: number; active: boolean; locked: boolean } | null>(null)
  const justSwiped = useRef(false)
  const next = nextStatus(game.status)
  const prev = prevStatus(game.status)
  const color = useArtColor(game.image_url)

  function onPointerDown(e: React.PointerEvent) {
    justSwiped.current = false
    if (e.pointerType === 'mouse') return
    gesture.current = { x: e.clientX, y: e.clientY, active: false, locked: false }
  }
  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g || g.locked) return
    const mx = e.clientX - g.x, my = e.clientY - g.y
    if (!g.active) {
      if (Math.abs(my) > 10) { g.locked = true; return } // vertical scroll wins
      if (Math.abs(mx) > 10) { g.active = true; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* pointer already gone */ } }
      else return
    }
    const limit = (mx > 0 && !next) || (mx < 0 && !prev) ? 24 : 140
    const clamped = Math.max(-limit, Math.min(limit, mx))
    if (Math.abs(clamped) >= SWIPE_TRIGGER && Math.abs(dx) < SWIPE_TRIGGER) haptic(10)
    setDx(clamped)
  }
  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    if (g?.active) {
      justSwiped.current = true
      if (dx >= SWIPE_TRIGGER && next) onStatus(game.id, next)
      else if (dx <= -SWIPE_TRIGGER && prev) onStatus(game.id, prev)
    }
    setDx(0)
  }

  const reveal: ReactNode = dx > 0 && next
    ? <SwipeHint status={next} side="left" armed={dx >= SWIPE_TRIGGER} />
    : dx < 0 && prev
      ? <SwipeHint status={prev} side="right" armed={dx <= -SWIPE_TRIGGER} />
      : null

  return (
    <div className={`relative rounded-2xl overflow-hidden ${dragging ? 'z-10 ring-2 ring-pop-violet' : ''}`}>
      {reveal}
      <article
        onClick={() => { if (!justSwiped.current) onOpen(game.id) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex items-center gap-3 h-[76px] pr-3 bg-ink-850 ring-1 ring-inset ring-white/[.06] rounded-2xl cursor-pointer touch-pan-y hover:bg-ink-800 transition-colors"
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: dx ? 'none' : 'transform .35s cubic-bezier(.2,.9,.3,1.25)',
          backgroundImage: color ? `linear-gradient(90deg, rgb(${color} / .14), transparent 55%)` : undefined,
        }}
      >
        {handle
          ? <DragHandle handle={handle} className="self-stretch w-8 -mr-2 pl-1" />
          : <span className="w-1" />}
        <CoverImage id={game.id} name={game.name} src={game.image_url} className="h-[46px] sm:h-[56px] aspect-[460/215] rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[15px] leading-tight truncate">{game.name}</div>
          <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
            <StatusChip status={game.status} />
            {game.rating != null && <span className="text-xs font-mono text-pop-amber">★{game.rating.toFixed(1)}</span>}
            <span className="text-xs text-ink-500 truncate hidden md:inline">{game.tags.slice(0, 2).join(' · ')}</span>
            <span className="ml-auto sm:hidden"><PriceLine game={game} compact /></span>
          </div>
        </div>
        <span className="hidden sm:block"><PriceLine game={game} compact /></span>
      </article>
    </div>
  )
})

function SwipeHint({ status, side, armed }: { status: GameStatus; side: 'left' | 'right'; armed: boolean }) {
  const meta = STATUS_META[status]
  return (
    <div
      className={`absolute inset-0 flex items-center px-5 font-bold text-sm transition-colors ${side === 'left' ? 'justify-start' : 'justify-end'}`}
      style={{ background: armed ? meta.color : `${meta.color}33`, color: armed ? '#07080c' : meta.color }}
    >
      <span className={`flex items-center gap-1.5 transition-transform ease-spring duration-300 ${armed ? 'scale-110' : 'scale-90'}`}>
        {side === 'left' ? <>{meta.emoji} {meta.label} →</> : <>← {meta.emoji} {meta.label}</>}
      </span>
    </div>
  )
}

function hexToRgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
