import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { pushBack } from '../lib/backStack'

interface Props {
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  /** Extra style for the panel, e.g. an ambient colour */
  panelStyle?: CSSProperties
  wide?: boolean
  /** Hide the default header row (for sheets that draw their own hero) */
  bare?: boolean
}

let openCount = 0

/**
 * Bottom sheet on phones (drag the handle down to dismiss), centred dialog on desktop.
 * Integrates with the back button so Android/PWA "back" closes it.
 */
export function Sheet({ onClose, children, title, panelStyle, wide, bare }: Props) {
  const [dragY, setDragY] = useState(0)
  const [closing, setClosing] = useState(false)
  const startY = useRef<number | null>(null)
  const releaseBack = useRef<(() => void) | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    releaseBack.current = pushBack(() => { releaseBack.current = null; onCloseRef.current() })
    openCount++
    document.body.style.overflow = 'hidden'
    return () => {
      releaseBack.current?.()
      if (--openCount === 0) document.body.style.overflow = ''
    }
  }, [])

  function close() {
    setClosing(true)
    setTimeout(() => onCloseRef.current(), 180)
  }

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startY.current == null) return
    setDragY(Math.max(0, e.clientY - startY.current))
  }
  function onPointerUp() {
    if (startY.current == null) return
    startY.current = null
    if (dragY > 110) close()
    else setDragY(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div
        className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-200 ${closing ? 'opacity-0' : 'animate-fade-in'}`}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${wide ? 'md:max-w-2xl' : 'md:max-w-lg'} max-h-[92dvh] md:max-h-[86dvh] flex flex-col
          bg-ink-900 border border-white/[.07] rounded-t-4xl md:rounded-4xl shadow-2xl overflow-hidden
          ${closing ? 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0 transition duration-200' : 'animate-sheet-up md:animate-pop-in'}`}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : undefined, ...panelStyle }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="md:hidden absolute top-0 inset-x-0 h-7 z-20 flex justify-center pt-2.5 touch-none cursor-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="w-10 h-1.5 rounded-full bg-white/25" />
        </div>
        {!bare && (
          <div className="flex items-center justify-between gap-3 px-5 pt-6 md:pt-5 pb-3">
            <h2 className="font-display text-xl font-bold">{title}</h2>
            <button onClick={close} className="btn-icon -mr-2" aria-label="Close">✕</button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain flex-1 pb-safe">
          {children}
        </div>
        {bare && (
          <button onClick={close} className="btn-icon absolute top-3 right-3 z-20 bg-ink-950/50 backdrop-blur" aria-label="Close">✕</button>
        )}
      </div>
    </div>,
    document.body
  )
}
