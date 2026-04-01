interface Props {
  onImportWishlist: () => void
  onAddCustom: () => void
}

export function EmptyState({ onImportWishlist, onAddCustom }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">🎮</div>
      <h2 className="text-xl font-semibold text-slate-200 mb-2">Your queue is empty!</h2>
      <p className="text-slate-400 mb-6">
        Search for a Steam game above to get started, or import your Steam wishlist.
      </p>
      <div className="flex gap-3">
        <button onClick={onImportWishlist} className="btn-primary">
          Import Steam Wishlist
        </button>
        <button onClick={onAddCustom} className="btn-ghost border border-[#2a2d35]">
          + Add Custom
        </button>
      </div>
    </div>
  )
}
