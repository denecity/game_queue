import type { TabName } from '../lib/types'

interface Props {
  active: TabName
  counts: Record<TabName, number>
  onSwitch: (tab: TabName) => void
}

const TABS: { key: TabName; label: string }[] = [
  { key: 'queue', label: 'Queue' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'archive', label: 'Archive' },
]

export function TabBar({ active, counts, onSwitch }: Props) {
  return (
    <div className="flex gap-1 border-b border-[#2a2d35]">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSwitch(key)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
            ${active === key
              ? 'border-[#4fd1c5] text-[#4fd1c5]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          {label}
          <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5
            ${active === key ? 'bg-[#4fd1c5]/20 text-[#4fd1c5]' : 'bg-[#2a2d35] text-slate-400'}`}>
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  )
}
