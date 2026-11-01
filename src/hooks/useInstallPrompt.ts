import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

// Captured at module load so the event isn't missed before React mounts
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  listeners.forEach(l => l())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach(l => l())
})

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function useInstallPrompt() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force(n => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    listeners.forEach(l => l())
    return outcome === 'accepted'
  }, [])

  return {
    canPrompt: !!deferred,
    installed: isStandalone(),
    iosHint: isIos() && !isStandalone(),
    install,
  }
}
