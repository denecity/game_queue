import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { DiscoverFilters, Game, GameStatus, Suggestion } from '../lib/types'
import { api } from '../lib/api'
import { useDiscover, useSteamTags } from '../hooks/useDiscover'
import { CATEGORY_OPTIONS, EMPTY_DISCOVER_FILTERS, FLAG_OPTIONS, countFilters } from '../lib/discoverFilters'
import { haptic, readLocal, writeLocal } from '../lib/utils'
import { detailsToGame } from './SearchSheet'
import { DiscoverFilterSheet } from './DiscoverFilterSheet'
import { ArtImg, GeneratedCover } from './CoverImage'
import { RatePrompt } from './RatePrompt'

interface Props {
  ownedAppIds: Set<number>
  /** Saves a game; resolves to null if it couldn't be added */
  onAdd: (game: Partial<Game>) => Promise<Game | null>
  onRemove: (id: string, opts?: { quiet?: boolean }) => Promise<void>
  onSearch: () => void
  onImport: () => void
}

type Dir = 'left' | 'right' | 'up'
interface Leaving { key: number; card: Suggestion; dir: Dir; fromX: number }
type Undo =
  | { card: Suggestion; kind: 'pass' }
  | { card: Suggestion; kind: 'add'; saved: Promise<Game | null> }

const FILTERS_KEY = 'gq_discover_filters'
const STAMP: Record<Dir, { text: string; cls: string }> = {
  right: { text: '✨ Wishlist', cls: 'left-4 -rotate-12 border-pop-violet text-pop-violet' },
  left: { text: '✕ Pass', cls: 'right-4 rotate-12 border-pop-coral text-pop-coral' },
  up: { text: 'Added', cls: 'left-1/2 -translate-x-1/2 border-pop-lime text-pop-lime' },
}
let leaveKey = 0

/**
 * A deck of suggestions to swipe through: right puts a game on the wishlist, left hides it for good.
 * The buttons underneath do the same, plus "queue" and "played" (which asks for a rating).
 */
export function Discover({ ownedAppIds, onAdd, onRemove, onSearch, onImport }: Props) {
  const [filters, setFiltersState] = useState<DiscoverFilters>(() => ({ ...EMPTY_DISCOVER_FILTERS, ...readLocal<Partial<DiscoverFilters>>(FILTERS_KEY, {}) }))
  const [showFilters, setShowFilters] = useState(false)
  const [leaving, setLeaving] = useState<Leaving[]>([])
  const [undo, setUndo] = useState<Undo | null>(null)
  const [rating, setRating] = useState<Suggestion | null>(null)
  const tags = useSteamTags()
  const { deck, meta, loading, error, exhausted, take, putBack, retry } = useDiscover(filters, ownedAppIds)
  const top = deck[0]
  const filterCount = countFilters(filters)

  const setFilters = useCallback((f: DiscoverFilters) => {
    setFiltersState(f)
    writeLocal(FILTERS_KEY, f)
    setUndo(null)
  }, [])

  const leave = useCallback((card: Suggestion, dir: Dir, fromX = 0) => {
    haptic(10)
    take(card.appid)
    setLeaving(l => [...l, { key: ++leaveKey, card, dir, fromX }])
  }, [take])

  const pass = useCallback((card: Suggestion, fromX?: number) => {
    leave(card, 'left', fromX)
    api.discover.dismiss(card.appid).catch(() => {})
    setUndo({ card, kind: 'pass' })
  }, [leave])

  const add = useCallback((card: Suggestion, status: GameStatus, dir: Dir, extra: Partial<Game> = {}, fromX?: number) => {
    leave(card, dir, fromX)
    // Steam details load in the background so the next card is there straight away
    const saved = detailsToGame(card, status).then(game => onAdd({ ...game, ...extra }))
    setUndo({ card, kind: 'add', saved })
  }, [leave, onAdd])

  const undoLast = useCallback(async () => {
    if (!undo) return
    setUndo(null)
    haptic(6)
    if (undo.kind === 'pass') {
      api.discover.restore(undo.card.appid).catch(() => {})
    } else {
      const game = await undo.saved
      if (game) await onRemove(game.id, { quiet: true })
    }
    putBack(undo.card)
  }, [undo, onRemove, putBack])

  // Desktop: arrows to swipe, letters for the rest
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return
      const k = e.key.toLowerCase()
      if (k === 'z') undoLast()
      if (!top) return
      if (e.key === 'ArrowLeft') pass(top)
      if (e.key === 'ArrowRight') add(top, 'none', 'right')
      if (k === 'q') add(top, 'bought', 'up')
      if (k === 'p') setRating(top)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [top, pass, add, undoLast])

  const b = meta?.basedOn
  const noLibrary = !!b && b.wishlist + b.queue + b.archive === 0
  const sources = b ? [
    b.wishlist && `${b.wishlist} wishlisted`,
    b.queue && `${b.queue} queued`,
    b.archive && `${b.archive} played`,
  ].filter(Boolean).join(', ') : ''

  const filterChips: Array<{ key: string; label: string; off: () => void }> = [
    ...filters.cats.map(id => {
      const o = CATEGORY_OPTIONS.find(c => c.id === id)
      return { key: `c${id}`, label: o ? `${o.emoji} ${o.label}` : `#${id}`, off: () => setFilters({ ...filters, cats: filters.cats.filter(c => c !== id) }) }
    }),
    ...FLAG_OPTIONS.filter(o => filters[o.key]).map(o => ({ key: o.key, label: `${o.emoji} ${o.label}`, off: () => setFilters({ ...filters, [o.key]: false }) })),
    ...filters.tags.map(id => ({
      key: `t${id}`,
      label: tags.find(t => t.id === id)?.name ?? '…',
      off: () => setFilters({ ...filters, tags: filters.tags.filter(t => t !== id) }),
    })),
  ]

  return (
    // Cards fly off sideways; clip that at the screen edge instead of letting the page scroll
    <div className="-mx-4 px-4 md:-mx-6 md:px-6 overflow-x-clip">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="font-display font-extrabold text-2xl md:text-3xl flex items-center gap-2">
            <span aria-hidden>🧭</span> Discover
          </h2>
          <button
            onClick={() => setShowFilters(true)}
            className={`h-10 px-3.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition ease-spring active:scale-95
              ${filterCount ? 'bg-pop-violet text-ink-950' : 'bg-white/[.06] text-ink-200 hover:bg-white/[.1]'}`}
          >
            ⚡ Filter
            {filterCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-ink-950/20 text-[11px] grid place-items-center tabular-nums">{filterCount}</span>}
          </button>
        </div>

        {filterChips.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 mb-3 h-8">
            {filterChips.map(c => (
              <button key={c.key} onClick={c.off} className="chip flex-shrink-0 h-8 bg-pop-violet/15 text-pop-violet ring-1 ring-pop-violet/30 active:scale-95 transition">
                {c.label} <span className="opacity-60">✕</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-400 mb-3 h-8 truncate leading-8 [@media(max-height:780px)]:hidden">
            {sources ? `Picked for you from ${sources}` : ' '}
          </p>
        )}

        <div className="grid grid-cols-1">
          {top ? (
            <>
              {deck.slice(0, 2).reverse().map(card => (
                <SwipeCard
                  key={card.appid}
                  card={card}
                  isTop={card === top}
                  onSwipe={(dir, fromX) => dir === 'left' ? pass(card, fromX) : add(card, 'none', 'right', {}, fromX)}
                />
              ))}
            </>
          ) : (
            <div className="[grid-area:1/1] rounded-4xl bg-ink-850 border border-white/[.06] min-h-[420px] grid place-items-center p-8 text-center">
              {loading || (!error && !exhausted && !noLibrary) ? (
                <div className="w-full self-stretch flex flex-col gap-4" aria-label="Finding games">
                  <div className="skeleton rounded-3xl aspect-[16/9]" />
                  <div className="skeleton rounded-xl h-7 w-2/3" />
                  <div className="skeleton rounded-xl h-4 w-1/2" />
                  <div className="skeleton rounded-xl h-16" />
                  <p className="text-sm text-ink-400 mt-auto">Finding games you might like…</p>
                </div>
              ) : error ? (
                <Notice emoji="📡" title="Couldn't reach Steam" text="Check your connection and try again.">
                  <button onClick={retry} className="btn-primary">Try again</button>
                </Notice>
              ) : noLibrary ? (
                <Notice emoji="🌱" title="Nothing to go on yet" text="Add a few games you like, own or want, and suggestions will show up here.">
                  <button onClick={onSearch} className="btn-primary">🔍 Find games</button>
                  <button onClick={onImport} className="btn-soft">🔄 Import from Steam</button>
                </Notice>
              ) : filterCount > 0 ? (
                <Notice emoji="🧐" title="That's all for these filters" text="Loosen them up, or look again for a fresh batch.">
                  <button onClick={() => setFilters(EMPTY_DISCOVER_FILTERS)} className="btn-primary">Clear filters</button>
                  <button onClick={retry} className="btn-soft">Look again</button>
                </Notice>
              ) : (
                <Notice emoji="🎉" title="You've seen it all" text="For now, anyway. A new look picks different games of yours to start from.">
                  <button onClick={retry} className="btn-primary">Look again</button>
                </Notice>
              )}
            </div>
          )}
          {leaving.map(l => (
            <LeavingCard key={l.key} leaving={l} onDone={() => setLeaving(ls => ls.filter(x => x.key !== l.key))} />
          ))}
        </div>

        <div className="flex items-start justify-center gap-2.5 mt-4">
          <Action label="Undo" size="sm" onClick={undoLast} disabled={!undo} className="bg-white/[.06] text-ink-200">↩</Action>
          <Action label="Pass" onClick={() => top && pass(top)} disabled={!top} className="bg-pop-coral/15 text-pop-coral ring-1 ring-pop-coral/40">✕</Action>
          <Action label="Played" onClick={() => top && setRating(top)} disabled={!top} className="bg-pop-pink/15 ring-1 ring-pop-pink/40">🏆</Action>
          <Action label="Queue" onClick={() => top && add(top, 'bought', 'up')} disabled={!top} className="bg-pop-amber/15 ring-1 ring-pop-amber/40">🎮</Action>
          <Action label="Wishlist" size="lg" onClick={() => top && add(top, 'none', 'right')} disabled={!top} className="btn-primary p-0 shadow-[0_10px_30px_-6px_rgba(244,114,182,.8)]">✨</Action>
        </div>
        <p className="hidden md:block text-center text-xs text-ink-500 mt-4">
          <Key>←</Key> pass · <Key>→</Key> wishlist · <Key>Q</Key> queue · <Key>P</Key> played · <Key>Z</Key> undo
        </p>
      </div>

      {showFilters && (
        <DiscoverFilterSheet value={filters} tags={tags} onApply={setFilters} onClose={() => setShowFilters(false)} />
      )}

      {rating && (
        <RatePrompt
          game={{ name: rating.name, image_url: rating.image_url }}
          title="Already played it?"
          skipLabel="Skip rating, just add it to Archive"
          onClose={() => setRating(null)}
          onDone={score => {
            add(rating, 'done', 'up', { rating: score, date_completed: new Date().toISOString() })
            setRating(null)
          }}
        />
      )}
    </div>
  )
}

function Notice({ emoji, title, text, children }: { emoji: string; title: string; text: string; children: ReactNode }) {
  return (
    <div className="animate-pop-in">
      <div className="text-6xl mb-4">{emoji}</div>
      <h3 className="font-display text-2xl font-extrabold mb-1.5">{title}</h3>
      <p className="text-ink-400 text-sm mb-6 max-w-xs mx-auto">{text}</p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  )
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="font-mono bg-white/[.08] rounded-md px-1.5 py-0.5 text-ink-300">{children}</kbd>
}

function Action({ label, size = 'md', className, children, ...rest }: {
  label: string
  size?: 'sm' | 'md' | 'lg'
  className: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  const box = size === 'lg' ? 'w-16 h-16 text-3xl rounded-[24px]' : size === 'sm' ? 'w-11 h-11 text-lg rounded-2xl mt-2.5' : 'w-14 h-14 text-2xl rounded-[20px] mt-1'
  return (
    <div className={`flex flex-col items-center gap-1.5 ${size === 'lg' ? 'w-16' : size === 'sm' ? 'w-12' : 'w-14'}`}>
      <button
        {...rest}
        aria-label={label}
        className={`grid place-items-center transition duration-200 ease-spring active:scale-90 hover:scale-105 disabled:opacity-35 disabled:pointer-events-none select-none ${box} ${className}`}
      >
        {children}
      </button>
      <span className="text-[10px] font-bold tracking-wide text-ink-400">{label}</span>
    </div>
  )
}

const tilt = (x: number) => `translateX(${x}px) rotate(${x / 22}deg)`

function SwipeCard({ card, isTop, onSwipe }: { card: Suggestion; isTop: boolean; onSwipe: (dir: 'left' | 'right', fromX: number) => void }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; id: number } | null>(null)
  const last = useRef({ x: 0, t: 0, v: 0 })
  /** A drag just ended, so the click that follows it is not a tap */
  const dragged = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    if (!isTop || (e.pointerType === 'mouse' && e.button !== 0)) return
    start.current = { x: e.clientX, id: e.pointerId }
    last.current = { x: e.clientX, t: e.timeStamp, v: 0 }
    dragged.current = false
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || e.pointerId !== start.current.id) return
    const x = e.clientX - start.current.x
    if (!dragging) {
      if (Math.abs(x) < 8) return
      // Capture only once it's clearly a drag, so plain taps still reach the buttons inside the card
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      setDragging(true)
      dragged.current = true
    }
    const dt = e.timeStamp - last.current.t
    if (dt > 0) last.current = { x: e.clientX, t: e.timeStamp, v: (e.clientX - last.current.x) / dt }
    setDx(x)
  }

  function end() {
    if (!start.current) return
    start.current = null
    if (!dragging) return
    setDragging(false)
    const flick = Math.abs(last.current.v) > 0.5 && Math.abs(dx) > 30 && Math.sign(last.current.v) === Math.sign(dx)
    if (Math.abs(dx) > 100 || flick) onSwipe(dx < 0 ? 'left' : 'right', dx)
    else setDx(0)
  }

  const pull = Math.min(1, Math.abs(dx) / 90)
  return (
    <div
      className={`[grid-area:1/1] relative select-none touch-pan-y ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
      style={{
        transform: isTop ? tilt(dx) : 'translateY(22px) scale(.94)',
        opacity: isTop ? 1 : 0.55,
        transition: dragging ? 'none' : 'transform .32s cubic-bezier(.2,.9,.3,1.2), opacity .3s',
      }}
      aria-hidden={!isTop}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={() => { start.current = null; setDragging(false); setDx(0) }}
      onClickCapture={e => { if (dragged.current) { dragged.current = false; e.stopPropagation(); e.preventDefault() } }}
    >
      <CardFace card={card} live={isTop} />
      {dx !== 0 && <Stamp dir={dx > 0 ? 'right' : 'left'} opacity={pull} />}
    </div>
  )
}

function Stamp({ dir, opacity }: { dir: Dir; opacity: number }) {
  return (
    <div
      className={`absolute top-6 px-3 py-1 rounded-xl border-[3px] font-display font-extrabold text-xl uppercase tracking-wide bg-ink-950/70 backdrop-blur-sm pointer-events-none ${STAMP[dir].cls}`}
      style={{ opacity }}
    >
      {STAMP[dir].text}
    </div>
  )
}

/** The card that was just swiped or tapped away, finishing its exit on top of the deck. */
function LeavingCard({ leaving: l, onDone }: { leaving: Leaving; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useLayoutEffect(() => {
    const w = window.innerWidth
    const to = l.dir === 'left' ? `translate(${-w}px, 40px) rotate(-22deg)`
      : l.dir === 'right' ? `translate(${w}px, 40px) rotate(22deg)`
      : 'translateY(-60vh) scale(.7)'
    const anim = ref.current!.animate(
      [{ transform: tilt(l.fromX), opacity: 1 }, { transform: to, opacity: 0 }],
      { duration: 300, easing: 'cubic-bezier(.4,0,.9,.6)', fill: 'forwards' }
    )
    anim.onfinish = () => done.current()
    return () => anim.cancel()
  }, [l])

  return (
    <div ref={ref} className="[grid-area:1/1] relative pointer-events-none z-10" aria-hidden>
      <CardFace card={l.card} live={false} />
      <Stamp dir={l.dir} opacity={1} />
    </div>
  )
}

function CardFace({ card, live }: { card: Suggestion; live: boolean }) {
  const like = card.because.map(x => x.wishlist ? `${x.name} ✨` : x.name).join(' & ')
  const reason = [like && `Like ${like}`, card.match.join(', ')].filter(Boolean).join(' · ')
  return (
    <article className="rounded-4xl overflow-hidden bg-ink-850 border border-white/[.08] shadow-[0_24px_60px_-20px_rgba(0,0,0,.9)]">
      <Gallery card={card} live={live} />
      <div className="p-4 pt-3.5">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[22px] font-extrabold leading-tight truncate flex-1 min-w-0">{card.name}</h3>
          <a
            href={`https://store.steampowered.com/app/${card.appid}/`}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            tabIndex={live ? 0 : -1}
            className="chip flex-shrink-0 h-8 bg-white/[.07] text-ink-200 hover:bg-white/[.12]"
          >
            Steam ↗
          </a>
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 overflow-hidden">
          <span className="chip bg-white/[.07] font-mono text-ink-100">{card.price}</span>
          {card.discount_pct ? <span className="chip bg-pop-lime/15 text-pop-lime">-{card.discount_pct}%</span> : null}
          {card.review_pct != null && <span className="chip bg-white/[.07] text-ink-200">👍 {card.review_pct}%</span>}
          {card.coming_soon
            ? <span className="chip bg-pop-sky/15 text-pop-sky">Coming soon</span>
            : card.year && <span className="chip bg-white/[.07] text-ink-300">{card.year}</span>}
        </div>
        <p className="text-xs text-pop-violet mt-3 truncate h-4">{reason}</p>
        <p className="text-sm leading-5 text-ink-300 mt-1.5 line-clamp-3 h-[60px] [@media(max-height:780px)]:line-clamp-2 [@media(max-height:780px)]:h-10 [@media(max-height:700px)]:!hidden">{card.description}</p>
        <div className="flex gap-1.5 mt-3 h-[26px] overflow-hidden flex-wrap">
          {card.tags.map(t => <span key={t} className="chip bg-white/[.05] text-ink-400">{t}</span>)}
        </div>
      </div>
    </article>
  )
}

/** Cover first, then screenshots. Tap the right side for the next picture, the left for the previous. */
function Gallery({ card, live }: { card: Suggestion; live: boolean }) {
  const slides = [card.image_url, ...card.screenshots]
  const [i, setI] = useState(0)
  const [broken, setBroken] = useState<number[]>([])
  const src = slides[i]

  // Warm up the next picture so tapping through feels instant
  useEffect(() => {
    if (!live || i + 1 >= slides.length) return
    const img = new Image()
    // Same mode as ArtImg, so the warmed-up copy is the one that gets shown
    if (/steamstatic/.test(slides[i + 1])) img.crossOrigin = 'anonymous'
    img.src = slides[i + 1]
  }, [live, i]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative aspect-[16/9] [@media(max-height:780px)]:aspect-[2/1] bg-ink-800 overflow-hidden">
      {broken.includes(i) ? (
        <div className="absolute inset-0 [container-type:inline-size]"><GeneratedCover name={card.name} className="w-full h-full" /></div>
      ) : (
        <>
          <ArtImg src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-70" />
          <ArtImg
            src={src}
            alt=""
            draggable={false}
            onError={() => setBroken(list => [...list, i])}
            className="relative w-full h-full object-contain"
          />
        </>
      )}
      {slides.length > 1 && (
        <>
          <div className="absolute top-2.5 inset-x-4 flex gap-1 pointer-events-none">
            {slides.map((_, j) => (
              <span key={j} className={`h-1 flex-1 rounded-full shadow-[0_1px_3px_rgba(0,0,0,.5)] transition-colors ${j === i ? 'bg-white' : 'bg-white/35'}`} />
            ))}
          </div>
          <button
            tabIndex={-1}
            aria-label="Previous picture"
            className="absolute inset-y-0 left-0 w-[35%]"
            onClick={() => { haptic(4); setI(Math.max(0, i - 1)) }}
          />
          <button
            tabIndex={-1}
            aria-label="Next picture"
            className="absolute inset-y-0 right-0 w-[65%]"
            onClick={() => { haptic(4); setI((i + 1) % slides.length) }}
          />
        </>
      )}
    </div>
  )
}
