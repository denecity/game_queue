interface Props {
  onImport: () => void
  onSearch: () => void
}

export function EmptyState({ onImport, onSearch }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-pop-in">
      <div className="text-7xl mb-5 animate-bob">🎮</div>
      <h2 className="font-display text-3xl font-extrabold mb-2">Your queue is <span className="text-gradient">wide open</span></h2>
      <p className="text-ink-400 mb-8 max-w-sm">Find games to add, or pull in your Steam wishlist in one go.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={onSearch} className="btn-primary">🔍 Find games</button>
        <button onClick={onImport} className="btn-soft">🔄 Import from Steam</button>
      </div>
    </div>
  )
}
