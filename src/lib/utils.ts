import type { Game, GameStatus, TabName } from './types'

export function tabForStatus(status: GameStatus): TabName {
  if (status === 'done') return 'archive'
  if (status === 'none') return 'wishlist'
  return 'queue'
}

export function statusLabel(status: GameStatus): string {
  switch (status) {
    case 'none': return 'None'
    case 'bought': return 'Bought'
    case 'installed': return 'Installed'
    case 'playing': return 'Playing'
    case 'done': return 'Done'
  }
}

export function statusColor(status: GameStatus): string {
  switch (status) {
    case 'none': return 'bg-gray-600 text-gray-200'
    case 'bought': return 'bg-amber-500 text-white'
    case 'installed': return 'bg-orange-500 text-white'
    case 'playing': return 'bg-green-500 text-white'
    case 'done': return 'bg-blue-500 text-white'
  }
}

export function formatPlayerCount(count: number | null): string | null {
  if (count == null) return null
  if (count >= 1_000_000) return `~${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `~${Math.round(count / 1_000)}K`
  return `~${count}`
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-CA') // YYYY-MM-DD
}

export function generateId(): string {
  return crypto.randomUUID()
}

export const POSITION_GAP = 1000

export function calcMidpoint(a: number, b: number): number {
  return Math.floor((a + b) / 2)
}

export function rebalancePositions(games: Game[]): { id: string; queue_position: number }[] {
  return games.map((g, i) => ({ id: g.id, queue_position: (i + 1) * POSITION_GAP }))
}

export function maxPosition(games: Game[]): number {
  if (games.length === 0) return 0
  return Math.max(...games.map(g => g.queue_position))
}

export function isSteamUrl(value: string): boolean {
  return /store\.steampowered\.com\/app\/(\d+)/i.test(value)
}

export function extractAppIdFromUrl(url: string): number | null {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

export function isKeyPriceStale(updatedAt: string | null): boolean {
  if (!updatedAt) return false
  const age = Date.now() - new Date(updatedAt).getTime()
  return age > 12 * 60 * 60 * 1000 // 12 hours
}
