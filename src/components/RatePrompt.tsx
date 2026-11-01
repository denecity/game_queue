import type { Game } from '../lib/types'
import { Sheet } from './Sheet'
import { CoverImage } from './CoverImage'
import { haptic } from '../lib/utils'

const SCORES = [
  { v: 1, e: '😖' }, { v: 2, e: '😣' }, { v: 3, e: '😕' }, { v: 4, e: '😐' }, { v: 5, e: '🙂' },
  { v: 6, e: '😊' }, { v: 7, e: '😄' }, { v: 8, e: '😍' }, { v: 9, e: '🤩' }, { v: 10, e: '👑' },
]

/** Shown when a game moves to Done without a rating. */
export function RatePrompt({ game, onClose, onDone }: { game: Game; onClose: () => void; onDone: (rating: number | null) => void }) {
  return (
    <Sheet onClose={onClose} bare>
      <div className="relative">
        <CoverImage id={game.id} name={game.name} src={game.image_url} className="aspect-[460/215] w-full" eager />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 to-transparent" />
        <div className="absolute inset-0 grid place-items-center text-6xl animate-pop-in">🏆</div>
      </div>
      <div className="px-5 pb-6 -mt-4 relative text-center">
        <h2 className="font-display text-2xl font-extrabold">You finished it!</h2>
        <p className="text-ink-400 mt-1 mb-5">How was <b className="text-ink-100">{game.name}</b>?</p>
        <div className="grid grid-cols-5 gap-2">
          {SCORES.map(s => (
            <button
              key={s.v}
              onClick={() => { haptic(14); onDone(s.v) }}
              className="flex flex-col items-center gap-0.5 py-2.5 rounded-2xl bg-white/[.05] hover:bg-pop-violet hover:text-ink-950 transition duration-200 ease-spring hover:scale-110 active:scale-90"
            >
              <span className="text-2xl">{s.e}</span>
              <span className="font-display font-bold text-sm">{s.v}</span>
            </button>
          ))}
        </div>
        <button onClick={() => onDone(null)} className="mt-5 text-sm text-ink-400 hover:text-ink-100">Skip rating, just archive</button>
      </div>
    </Sheet>
  )
}
