import { useEffect } from 'react'
import type { TabName } from '../lib/types'

interface Options {
  onSearch: () => void
  onTabSwitch: (tab: TabName) => void
}

export function useKeyboardShortcuts({ onSearch, onTabSwitch }: Options) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (document.querySelector('[role="dialog"]')) return

      if (e.key === '/') { e.preventDefault(); onSearch() }
      if (e.key === '1') onTabSwitch('queue')
      if (e.key === '2') onTabSwitch('wishlist')
      if (e.key === '3') onTabSwitch('archive')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSearch, onTabSwitch])
}
