import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import type { Game } from '../lib/types'
import { GameCard } from './GameCard'

interface Props {
  games: Game[]
  onUpdate: (id: string, patch: Partial<Game>) => void
  onDelete: (id: string) => void
  onReorder: (games: Game[]) => void
  draggable: boolean
}

export function GameList({ games, onUpdate, onDelete, onReorder, draggable }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = games.findIndex(g => g.id === active.id)
    const newIndex = games.findIndex(g => g.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(games, oldIndex, newIndex)
    onReorder(reordered)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={games.map(g => g.id)} strategy={verticalListSortingStrategy}>
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            onUpdate={onUpdate}
            onDelete={onDelete}
            draggable={draggable}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}
