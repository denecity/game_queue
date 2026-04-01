import { useEffect } from 'react'
import type { TabName } from '../lib/types'

interface Options {
  onFocusSearch: () => void
  onTabSwitch: (tab: TabName) => void
  onEscape: () => void
}

export function useKeyboardShortcuts({ onFocusSearch, onTabSwitch, onEscape }: Options) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (e.key === 'Escape') {
        onEscape()
        return
      }

      if (isInput) return

      if (e.key === '/') {
        e.preventDefault()
        onFocusSearch()
        return
      }

      if (e.key === '1') onTabSwitch('queue')
      if (e.key === '2') onTabSwitch('wishlist')
      if (e.key === '3') onTabSwitch('archive')
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onFocusSearch, onTabSwitch, onEscape])
}
