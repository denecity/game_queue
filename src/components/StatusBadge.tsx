import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { GameStatus } from '../lib/types'
import { statusLabel, statusColor } from '../lib/utils'

const ALL_STATUSES: GameStatus[] = ['none', 'bought', 'installed', 'playing', 'done']

interface Props {
  status: GameStatus
  onChange: (s: GameStatus) => void
}

export function StatusBadge({ status, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 120 })
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(120, Math.round(rect.width)),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()

    function onViewportChange() {
      updateMenuPosition()
    }

    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    function close(e: MouseEvent) {
      const target = e.target as Node
      const clickedRoot = rootRef.current?.contains(target)
      const clickedMenu = menuRef.current?.contains(target)
      if (!clickedRoot && !clickedMenu) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const dropdown = open ? createPortal(
    <div
      ref={menuRef}
      className="card shadow-xl animate-fade-in"
      style={{
        position: 'fixed',
        top: menuPos.top,
        left: menuPos.left,
        minWidth: `${menuPos.minWidth}px`,
        zIndex: 1000,
      }}
    >
      {ALL_STATUSES.map(s => (
        <button
          key={s}
          onClick={e => { e.stopPropagation(); onChange(s); setOpen(false) }}
          className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-[#20242c] transition-colors ${s === status ? 'text-[#4fd1c5]' : 'text-slate-300'}`}
        >
          <span className={`status-badge ${statusColor(s)} mr-2`}>{statusLabel(s)}</span>
        </button>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`status-badge cursor-pointer ${statusColor(status)} ${status === 'playing' ? 'playing-pulse' : ''}`}
      >
        {statusLabel(status)}
      </button>
      {dropdown}
    </div>
  )
}
