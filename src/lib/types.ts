export type GameStatus = 'none' | 'bought' | 'installed' | 'playing' | 'done'

export interface Offer {
  kind: 'store' | 'key'
  shop: string
  price: number
  currency: string
  url: string
  cut?: number
}

export interface Game {
  id: string
  steam_app_id: number | null
  name: string
  image_url: string | null
  price: string | null
  rating: number | null
  status: GameStatus
  queue_position: number
  tags: string[]
  notes: string | null
  hours_played: number
  date_added: string
  date_completed: string | null
  is_custom: boolean
  steam_url: string | null
  player_count: number | null
  player_count_recent: number | null
  key_price: string | null
  key_price_eur: number | null
  key_price_url: string | null
  key_price_updated: string | null
  key_shop: string | null
  deal_price: number | null
  deal_currency: string | null
  deal_shop: string | null
  deal_url: string | null
  deal_cut: number | null
  historical_low: number | null
  offers: Offer[]
  prices_checked: string | null
}

export interface SteamSearchResult {
  appid: number
  name: string
  price: string
  image_url: string
  tags: string[]
  description?: string
  player_count?: number | null
  player_count_recent?: number | null
}

export type TabName = 'queue' | 'wishlist' | 'archive'

export type ViewMode = 'covers' | 'list'

export type SortOption =
  | 'manual'
  | 'rating_desc'
  | 'price_desc'
  | 'price_asc'
  | 'key_price_asc'
  | 'best_price_asc'
  | 'players_desc'
  | 'date_added_desc'
  | 'date_added_asc'
  | 'name_asc'

export interface FilterState {
  tags: string[]
  statuses: GameStatus[]
  rated: 'all' | 'rated' | 'unrated'
  onSale: boolean
}

export interface ReorderPayload {
  id: string
  queue_position: number
}

export interface SyncSource {
  id: string
  type: 'wishlist' | 'library'
  url: string
  label: string
  lastSynced: string | null
}
