import type { DiscoverFilters } from './types'

export const EMPTY_DISCOVER_FILTERS: DiscoverFilters = { tags: [], cats: [], deck: false, sale: false, free: false, released: false }

interface CategoryOption {
  /** Steam category id, as declared by the developer on the store page */
  id: number
  label: string
  emoji: string
}

export const PLAYER_MODES: CategoryOption[] = [
  { id: 2, label: 'Singleplayer', emoji: '🧍' },
  { id: 9, label: 'Co-op', emoji: '🤝' },
  { id: 39, label: 'Couch co-op', emoji: '🛋️' },
  { id: 38, label: 'Online co-op', emoji: '🌐' },
  { id: 24, label: 'Split screen', emoji: '📺' },
  { id: 49, label: 'PvP', emoji: '⚔️' },
  { id: 44, label: 'Remote Play Together', emoji: '📡' },
]

export const CONTROLLER: CategoryOption = { id: 28, label: 'Full controller support', emoji: '🎮' }

export const CATEGORY_OPTIONS: CategoryOption[] = [...PLAYER_MODES, CONTROLLER]

/** Steam tag names offered as one-tap genres. Anything else is reachable through the tag search. */
export const GENRE_TAGS = [
  'Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Puzzle', 'Platformer', 'Roguelike', 'Roguelite',
  'Shooter', 'FPS', 'Survival', 'Horror', 'Open World', 'Sandbox', 'Story Rich', 'Metroidvania', 'Souls-like',
  'City Builder', 'Management', 'Deckbuilding', 'Turn-Based Strategy', 'Tower Defense', 'Stealth', 'Racing',
  'Sports', 'Fighting', 'Party Game', 'Visual Novel', 'Point & Click', 'Rhythm', 'Cozy', 'Casual',
]

export const FLAG_OPTIONS: Array<{ key: 'deck' | 'sale' | 'free' | 'released'; label: string; emoji: string }> = [
  { key: 'deck', label: 'Steam Deck Verified', emoji: '🕹️' },
  { key: 'sale', label: 'On sale', emoji: '🏷️' },
  { key: 'free', label: 'Free to play', emoji: '🆓' },
  { key: 'released', label: 'Out now', emoji: '📅' },
]

export function countFilters(f: DiscoverFilters): number {
  return f.tags.length + f.cats.length + FLAG_OPTIONS.filter(o => f[o.key]).length
}

export function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item]
}
