import { useState, useEffect } from 'react'

interface ToastItem {
  id: number
  msg: string
  type: 'error' | 'success'
}

let toastId = 0

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function handler(e: Event) {
      const { msg, type } = (e as CustomEvent).detail
      const id = toastId++
      setToasts(prev => [...prev, { id, msg, type }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3500)
    }
    window.addEventListener('gq:toast', handler)
    return () => window.removeEventListener('gq:toast', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-fade-in
            ${t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-[#4fd1c5]/90 text-[#0f1115]'}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}
