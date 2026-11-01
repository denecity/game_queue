import type { Game, GameStatus, TabName } from './types'

export const STATUS_ORDER: GameStatus[] = ['none', 'bought', 'installed', 'playing', 'done']

interface StatusMeta {
  label: string
  emoji: string
  /** Solid colour used for dots, glows and chips */
  color: string
  /** Tailwind classes for a chip on dark backgrounds */
  chip: string
}

export const STATUS_META: Record<GameStatus, StatusMeta> = {
  none:      { label: 'Wishlist',  emoji: '✨', color: '#a78bfa', chip: 'bg-pop-violet/15 text-pop-violet ring-1 ring-pop-violet/30' },
  bought:    { label: 'Bought',    emoji: '🛒', color: '#fbbf24', chip: 'bg-pop-amber/15 text-pop-amber ring-1 ring-pop-amber/30' },
  installed: { label: 'Installed', emoji: '💾', color: '#38bdf8', chip: 'bg-pop-sky/15 text-pop-sky ring-1 ring-pop-sky/30' },
  playing:   { label: 'Playing',   emoji: '🎮', color: '#a3e635', chip: 'bg-pop-lime/15 text-pop-lime ring-1 ring-pop-lime/30' },
  done:      { label: 'Done',      emoji: '🏆', color: '#f472b6', chip: 'bg-pop-pink/15 text-pop-pink ring-1 ring-pop-pink/30' },
}

export function statusLabel(status: GameStatus): string {
  return STATUS_META[status].label
}

export function nextStatus(status: GameStatus): GameStatus | null {
  const i = STATUS_ORDER.indexOf(status)
  return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null
}

export function prevStatus(status: GameStatus): GameStatus | null {
  const i = STATUS_ORDER.indexOf(status)
  return i > 0 ? STATUS_ORDER[i - 1] : null
}

export function tabForStatus(status: GameStatus): TabName {
  if (status === 'done') return 'archive'
  if (status === 'none') return 'wishlist'
  return 'queue'
}

export const TAB_META: Record<TabName, { label: string; emoji: string; empty: string }> = {
  queue:    { label: 'Queue',    emoji: '🎮', empty: 'Nothing queued. Move something from your wishlist!' },
  wishlist: { label: 'Wishlist', emoji: '✨', empty: 'Your wishlist is empty. Tap + to find games.' },
  archive:  { label: 'Archive',  emoji: '🏆', empty: "You haven't finished anything yet. Go play!" },
}

/** "CHF 29.00" / "29,99€" / "Free to Play" → number (free = 0, unknown = null) */
export function parsePrice(price: string | null | undefined): number | null {
  if (!price) return null
  if (/free/i.test(price)) return 0
  const m = price.replace(/\s/g, '').match(/(\d+(?:[.,]\d{1,2})?)/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

// Rough EUR→CHF factor, only used to rank prices from different currencies against each other
const EUR_TO_CHF = 0.94

export function toChf(amount: number, currency: string): number {
  return currency === 'EUR' ? amount * EUR_TO_CHF : amount
}

export function formatMoney(amount: number | null | undefined, currency = 'CHF'): string | null {
  if (amount == null) return null
  if (amount === 0) return 'Free'
  return currency === 'EUR' ? `€${amount.toFixed(2)}` : `${currency} ${amount.toFixed(2)}`
}

/** Cheapest known way to get the game, normalised to CHF for comparison. */
export function bestPrice(g: Game): { amount: number; chf: number; label: string; url: string | null; source: string } | null {
  const options: { amount: number; chf: number; label: string; url: string | null; source: string }[] = []
  const steam = parsePrice(g.price)
  if (steam != null) options.push({ amount: steam, chf: steam, label: g.price!, url: g.steam_url, source: 'Steam' })
  if (g.key_price_eur != null) {
    options.push({ amount: g.key_price_eur, chf: toChf(g.key_price_eur, 'EUR'), label: formatMoney(g.key_price_eur, 'EUR')!, url: g.key_price_url, source: g.key_shop ?? 'Keyshop' })
  }
  if (g.deal_price != null && g.deal_currency) {
    options.push({ amount: g.deal_price, chf: toChf(g.deal_price, g.deal_currency), label: formatMoney(g.deal_price, g.deal_currency)!, url: g.deal_url, source: g.deal_shop ?? 'Store' })
  }
  if (!options.length) return null
  options.sort((a, b) => a.chf - b.chf)
  return options[0]
}

export function formatPlayerCount(count: number | null): string | null {
  if (count == null) return null
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`
  return `${count}`
}

export function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const POSITION_GAP = 1000

export function maxPosition(games: Game[]): number {
  let max = 0
  for (const g of games) if (g.queue_position > max) max = g.queue_position
  return max
}

export function isSteamUrl(value: string): boolean {
  return /store\.steampowered\.com\/app\/(\d+)/i.test(value)
}

export function extractAppIdFromUrl(url: string): number | null {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

export function isStale(updatedAt: string | null, hours = 12): boolean {
  if (!updatedAt) return false
  return Date.now() - new Date(updatedAt).getTime() > hours * 60 * 60 * 1000
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
}

export function showToast(msg: string, type: 'error' | 'success' | 'info' = 'info', action?: { label: string; run: () => void }) {
  window.dispatchEvent(new CustomEvent('gq:toast', { detail: { msg, type, action } }))
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}
