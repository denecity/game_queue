import { useMemo, useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import type { DiscoverFilters, SteamTag } from '../lib/types'
import {
  CONTROLLER, EMPTY_DISCOVER_FILTERS, FLAG_OPTIONS, GENRE_TAGS, PLAYER_MODES, countFilters, toggled,
} from '../lib/discoverFilters'
import { haptic } from '../lib/utils'

interface Props {
  value: DiscoverFilters
  tags: SteamTag[]
  onApply: (f: DiscoverFilters) => void
  onClose: () => void
}

/** Pick what the deck should be limited to. Changes apply together, since each one rebuilds the deck. */
export function DiscoverFilterSheet({ value, tags, onApply, onClose }: Props) {
  const [draft, setDraft] = useState(value)
  const [query, setQuery] = useState('')

  const genres = useMemo(() => {
    const byName = new Map(tags.map(t => [t.name.toLowerCase(), t]))
    return GENRE_TAGS.map(n => byName.get(n.toLowerCase())).filter((t): t is SteamTag => !!t)
  }, [tags])
  const genreIds = useMemo(() => new Set(genres.map(g => g.id)), [genres])

  // Picked tags that aren't one of the genre shortcuts stay visible next to the search box
  const extraPicked = tags.filter(t => draft.tags.includes(t.id) && !genreIds.has(t.id))
  const q = query.trim().toLowerCase()
  const found = q ? tags.filter(t => t.name.toLowerCase().includes(q) && !extraPicked.includes(t)).slice(0, 14) : []

  const toggleTag = (id: number) => { haptic(6); setDraft(d => ({ ...d, tags: toggled(d.tags, id) })) }
  const toggleCat = (id: number) => { haptic(6); setDraft(d => ({ ...d, cats: toggled(d.cats, id) })) }
  const active = countFilters(draft)

  return (
    <Sheet onClose={onClose} title={<span>Filter suggestions <span className="text-gradient">✦</span></span>}>
      <div className="px-5 pb-28">
        <p className="text-sm text-ink-400 mb-5">Games have to match everything you pick. They're still ranked by your taste.</p>

        <Group title="Players">
          {PLAYER_MODES.map(o => (
            <Chip key={o.id} on={draft.cats.includes(o.id)} onClick={() => toggleCat(o.id)}>{o.emoji} {o.label}</Chip>
          ))}
        </Group>

        <Group title="Controller & device">
          <Chip on={draft.cats.includes(CONTROLLER.id)} onClick={() => toggleCat(CONTROLLER.id)}>{CONTROLLER.emoji} {CONTROLLER.label}</Chip>
          <Chip on={draft.deck} onClick={() => { haptic(6); setDraft(d => ({ ...d, deck: !d.deck })) }}>🕹️ Steam Deck Verified</Chip>
        </Group>

        <Group title="Genre">
          {genres.length === 0 && <span className="text-sm text-ink-500">Loading Steam's tags…</span>}
          {genres.map(t => <Chip key={t.id} on={draft.tags.includes(t.id)} onClick={() => toggleTag(t.id)}>{t.name}</Chip>)}
        </Group>

        <Group title="Any other tag">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search all Steam tags: pixel graphics, space, cats…"
            enterKeyHint="search"
            className="field h-11 mb-1"
          />
          {extraPicked.map(t => <Chip key={t.id} on onClick={() => toggleTag(t.id)}>{t.name}</Chip>)}
          {found.map(t => <Chip key={t.id} on={draft.tags.includes(t.id)} onClick={() => toggleTag(t.id)}>{t.name}</Chip>)}
          {q && found.length === 0 && <span className="text-sm text-ink-500">No tag called that.</span>}
        </Group>

        <Group title="Price & release">
          {FLAG_OPTIONS.filter(o => o.key !== 'deck').map(o => (
            <Chip key={o.key} on={draft[o.key]} onClick={() => { haptic(6); setDraft(d => ({ ...d, [o.key]: !d[o.key] })) }}>{o.emoji} {o.label}</Chip>
          ))}
        </Group>
      </div>

      <div className="sticky bottom-0 -mt-24 px-5 pt-8 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-ink-900 via-ink-900 to-transparent flex gap-3">
        <button onClick={() => setDraft(EMPTY_DISCOVER_FILTERS)} disabled={active === 0} className="btn-soft">Clear</button>
        <button onClick={() => { onApply(draft); onClose() }} className="btn-primary flex-1">
          {active === 0 ? 'Show everything' : `Show games · ${active} filter${active === 1 ? '' : 's'}`}
        </button>
      </div>
    </Sheet>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="label">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 px-3.5 rounded-2xl text-sm font-semibold transition duration-200 ease-spring active:scale-90
        ${on ? 'bg-pop-violet text-ink-950 shadow-[0_6px_18px_-6px_rgba(167,139,250,.8)]' : 'bg-white/[.06] text-ink-200 hover:bg-white/[.1]'}`}
    >
      {children}
    </button>
  )
}
