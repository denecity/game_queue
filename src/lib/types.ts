export type GameStatus = 'none' | 'bought' | 'installed' | 'playing' | 'done'

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
  key_price_url: string | null
  key_price_updated: string | null
}

export interface SteamSearchResult {
  appid: number
  name: string
  price: string
  image_url: string
  tags: string[]
}

export type TabName = 'queue' | 'wishlist' | 'archive'

export type SortOption =
  | 'manual'
  | 'rating_desc'
  | 'price_desc'
  | 'price_asc'
  | 'key_price_asc'
  | 'players_desc'
  | 'date_added_desc'
  | 'date_added_asc'
  | 'name_asc'

export interface FilterState {
  tags: string[]
  statuses: GameStatus[]
  rated: 'all' | 'rated' | 'unrated'
}

export interface ReorderPayload {
  id: string
  queue_position: number
}
