import type { TabName } from '../lib/types'
import { TAB_META, haptic } from '../lib/utils'

const TABS: TabName[] = ['queue', 'wishlist', 'archive']

interface Props {
  active: TabName
  counts: Record<TabName, number>
  onSwitch: (t: TabName) => void
}

/** Segmented pill tabs for desktop. */
export function TabPills({ active, counts, onSwitch }: Props) {
  return (
    <div className="inline-flex p-1 rounded-2xl bg-white/[.05]">
      {TABS.map(t => (
        <button
          key={t}
          onClick={() => onSwitch(t)}
          className={`relative px-4 h-9 rounded-xl text-sm font-bold flex items-center gap-2 transition duration-300 ease-spring
            ${active === t ? 'bg-white text-ink-950 shadow-lg' : 'text-ink-300 hover:text-ink-100'}`}
        >
          <span aria-hidden>{TAB_META[t].emoji}</span>
          {TAB_META[t].label}
          <span className={`text-[11px] tabular-nums rounded-full px-1.5 ${active === t ? 'bg-ink-950/10' : 'bg-white/[.08] text-ink-400'}`}>{counts[t]}</span>
        </button>
      ))}
    </div>
  )
}

/** Floating glass tab bar with a centre add button, for phones. */
export function BottomNav({ active, counts, onSwitch, onAdd, onSettings }: Props & { onAdd: () => void; onSettings: () => void }) {
  const left: TabName[] = ['queue', 'wishlist']
  const item = (t: TabName) => (
    <button
      key={t}
      onClick={() => { haptic(6); onSwitch(t) }}
      className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 h-14 rounded-2xl transition duration-300 ease-spring active:scale-90
        ${active === t ? 'text-ink-100' : 'text-ink-500'}`}
    >
      <span className={`text-xl transition-transform duration-300 ease-spring ${active === t ? 'scale-110 -translate-y-0.5' : 'grayscale opacity-70'}`}>{TAB_META[t].emoji}</span>
      <span className="text-[10px] font-bold tracking-wide">{TAB_META[t].label}</span>
      {counts[t] > 0 && (
        <span className={`absolute top-1.5 right-[calc(50%-22px)] min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center
          ${active === t ? 'bg-pop-violet text-ink-950' : 'bg-ink-700 text-ink-300'}`}>{counts[t]}</span>
      )}
      {active === t && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-pop-violet" />}
    </button>
  )

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(10px+var(--safe-bottom))] pointer-events-none">
      <div className="pointer-events-auto glass rounded-[28px] shadow-[0_10px_40px_-10px_rgba(0,0,0,.8)] flex items-center px-2 gap-1">
        {left.map(item)}
        <button
          onClick={() => { haptic(12); onAdd() }}
          aria-label="Add game"
          className="w-14 h-14 -mt-6 rounded-[22px] btn-primary p-0 text-2xl text-ink-950 shadow-[0_10px_30px_-6px_rgba(244,114,182,.8)] active:rotate-90"
        >
          ＋
        </button>
        {item('archive')}
        <button
          onClick={() => { haptic(6); onSettings() }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 h-14 rounded-2xl text-ink-500 transition ease-spring active:scale-90"
        >
          <span className="text-xl grayscale opacity-70">⚙️</span>
          <span className="text-[10px] font-bold tracking-wide">Settings</span>
        </button>
      </div>
    </nav>
  )
}
