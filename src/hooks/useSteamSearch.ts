import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { SteamSearchResult } from '../lib/types'
import { isSteamUrl, extractAppIdFromUrl } from '../lib/utils'

export function useSteamSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SteamSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        if (isSteamUrl(query)) {
          const appId = extractAppIdFromUrl(query)
          if (appId) {
            const result = await api.steam.app(appId)
            setResults([result])
          }
        } else {
          const data = await api.steam.search(query)
          setResults(data)
        }
      } catch (e) {
        setError(String(e))
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return { query, setQuery, results, loading, error }
}
