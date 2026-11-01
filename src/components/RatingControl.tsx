import { useEffect, useRef, useState } from 'react'
import { haptic } from '../lib/utils'

const FACES = ['😖', '😕', '😐', '🙂', '😊', '😄', '🤩']

function face(v: number) {
  return FACES[Math.min(FACES.length - 1, Math.floor((v / 10) * (FACES.length - 1) + 0.5))]
}

/** 0–10 in half steps: big number, emoji mood, and a chunky slider. */
export function RatingControl({ value: saved, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  // Local draft while dragging; the save goes out once the slider settles
  const [value, setValue] = useState(saved)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => setValue(saved), [saved])
  function set(v: number | null) {
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), 350)
  }
  const v = value ?? 0
  const pct = (v / 10) * 100
  return (
    <div className="rounded-3xl bg-white/[.03] ring-1 ring-white/[.06] p-4">
      <div className="flex items-center gap-3 mb-3">
        <span key={value ?? 'none'} className="text-3xl animate-pop-in">{value == null ? '🤔' : face(v)}</span>
        <span className="font-display text-4xl font-extrabold tabular-nums">
          {value == null ? <span className="text-ink-500">—</span> : <span className="text-gradient">{v.toFixed(1)}</span>}
        </span>
        <span className="text-ink-500 font-display font-bold">/ 10</span>
        {value != null && (
          <button onClick={() => set(null)} className="ml-auto text-xs text-ink-500 hover:text-pop-coral">Clear</button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={v}
        onChange={e => { haptic(4); set(parseFloat(e.target.value)) }}
        aria-label="Rating"
        className="w-full h-3 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_4px_14px_rgba(244,114,182,.6)] [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-pop-pink
          [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-pop-pink"
        style={{ background: `linear-gradient(90deg, #a78bfa, #f472b6 ${pct / 2}%, #fbbf24 ${pct}%, rgba(255,255,255,.08) ${pct}%)` }}
      />
    </div>
  )
}
