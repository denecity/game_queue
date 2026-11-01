import type { GameStatus } from '../lib/types'
import { STATUS_META, STATUS_ORDER, haptic } from '../lib/utils'

export function StatusChip({ status, size = 'sm', onClick }: { status: GameStatus; size?: 'sm' | 'md'; onClick?: () => void }) {
  const meta = STATUS_META[status]
  const cls = `chip ${meta.chip} ${size === 'md' ? 'text-sm px-3 py-1.5' : ''} ${onClick ? 'active:scale-90 transition ease-spring' : ''}`
  const content = (
    <>
      {status === 'playing'
        ? <span className="playing-dot w-1.5 h-1.5 rounded-full bg-current text-pop-lime" />
        : <span aria-hidden>{meta.emoji}</span>}
      {meta.label}
    </>
  )
  return onClick
    ? <button type="button" className={cls} onClick={e => { e.stopPropagation(); onClick() }}>{content}</button>
    : <span className={cls}>{content}</span>
}

/** Big tappable status selector used in the game sheet and add form. */
export function StatusPicker({ value, onChange }: { value: GameStatus; onChange: (s: GameStatus) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {STATUS_ORDER.map(s => {
        const meta = STATUS_META[s]
        const active = s === value
        return (
          <button
            key={s}
            type="button"
            onClick={() => { haptic(); onChange(s) }}
            className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold transition duration-200 ease-spring active:scale-90
              ${active ? 'text-ink-950 scale-[1.04]' : 'bg-white/[.04] text-ink-300 hover:bg-white/[.08]'}`}
            style={active ? { background: meta.color, boxShadow: `0 8px 24px -8px ${meta.color}` } : undefined}
          >
            <span className={`text-lg ${active ? 'animate-wiggle' : ''}`}>{meta.emoji}</span>
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}
