import { useState, useRef, useEffect } from 'react'

interface Props {
  rating: number | null
  onChange: (r: number | null) => void
}

export function RatingSelector({ rating, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const values = Array.from({ length: 21 }, (_, i) => i * 0.5)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="font-mono text-sm text-[#4fd1c5] hover:text-[#38b2ac] transition-colors min-w-[48px] text-right"
        title="Click to rate"
      >
        {rating != null ? `★ ${rating.toFixed(1)}` : '☆ —'}
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 card shadow-xl animate-fade-in p-2 w-48">
          <div className="text-xs text-slate-400 mb-2 px-1">Rate this game (0–10)</div>
          <div className="grid grid-cols-5 gap-1">
            {values.map(v => (
              <button
                key={v}
                onClick={e => { e.stopPropagation(); onChange(v); setOpen(false) }}
                className={`text-xs py-1 px-1.5 rounded hover:bg-[#4fd1c5] hover:text-[#0f1115] transition-colors font-mono
                  ${rating === v ? 'bg-[#4fd1c5] text-[#0f1115]' : 'text-slate-300 bg-[#20242c]'}`}
              >
                {v.toFixed(1)}
              </button>
            ))}
          </div>
          {rating != null && (
            <button
              onClick={e => { e.stopPropagation(); onChange(null); setOpen(false) }}
              className="mt-2 w-full text-xs text-slate-400 hover:text-red-400 transition-colors text-center py-1"
            >
              Clear rating
            </button>
          )}
        </div>
      )}
    </div>
  )
}
