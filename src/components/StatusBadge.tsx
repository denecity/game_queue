import { useState, useRef, useEffect } from 'react'
import type { GameStatus } from '../lib/types'
import { statusLabel, statusColor } from '../lib/utils'

const ALL_STATUSES: GameStatus[] = ['none', 'bought', 'installed', 'playing', 'done']

interface Props {
  status: GameStatus
  onChange: (s: GameStatus) => void
}

export function StatusBadge({ status, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`status-badge cursor-pointer ${statusColor(status)} ${status === 'playing' ? 'playing-pulse' : ''}`}
      >
        {statusLabel(status)}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 card shadow-xl animate-fade-in min-w-[120px]">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={e => { e.stopPropagation(); onChange(s); setOpen(false) }}
              className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-[#20242c] transition-colors ${s === status ? 'text-[#4fd1c5]' : 'text-slate-300'}`}
            >
              <span className={`status-badge ${statusColor(s)} mr-2`}>{statusLabel(s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
