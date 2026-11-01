import { useEffect, useState } from 'react'

interface ToastItem {
  id: number
  msg: string
  type: 'error' | 'success' | 'info'
  action?: { label: string; run: () => void }
}

let nextId = 0

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function handler(e: Event) {
      const { msg, type, action } = (e as CustomEvent).detail
      const id = nextId++
      // Only one undo-able toast at a time keeps the stack readable on phones
      setToasts(prev => [...prev.filter(t => !(action && t.action)).slice(-2), { id, msg, type, action }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), action ? 5000 : 3200)
    }
    window.addEventListener('gq:toast', handler)
    return () => window.removeEventListener('gq:toast', handler)
  }, [])

  return (
    <div className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none bottom-[calc(92px+var(--safe-bottom))] md:bottom-6">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 max-w-md w-full md:w-auto pl-4 pr-2 py-2 rounded-2xl bg-ink-700/95 backdrop-blur-xl border border-white/[.08] shadow-2xl animate-pop-in text-sm
            ${t.type === 'error' ? 'ring-1 ring-pop-coral/50' : t.type === 'success' ? 'ring-1 ring-pop-lime/40' : ''}`}
        >
          <span aria-hidden>{t.type === 'error' ? '😬' : t.type === 'success' ? '🎉' : '👉'}</span>
          <span className="flex-1 py-1">{t.msg}</span>
          {t.action && (
            <button
              onClick={() => { t.action!.run(); setToasts(prev => prev.filter(x => x.id !== t.id)) }}
              className="px-3 py-1.5 rounded-xl bg-pop-violet text-ink-950 font-bold text-xs active:scale-90 transition ease-spring"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
