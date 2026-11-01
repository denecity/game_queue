import { memo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Game, GameStatus, ViewMode } from '../lib/types'
import { CoverCard, ListRow, type CardProps } from './GameCards'
import { haptic } from '../lib/utils'

interface Props {
  games: Game[]
  view: ViewMode
  draggable: boolean
  onOpen: (id: string) => void
  onStatus: (id: string, status: GameStatus) => void
  onReorder: (games: Game[]) => void
}

const SortableCard = memo(function SortableCard({ Card, ...props }: CardProps & { Card: typeof CoverCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.game.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
    >
      <Card {...props} handle={{ attributes, listeners }} />
    </div>
  )
})

export function GameList({ games, view, draggable, onOpen, onStatus, onReorder }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const Card = view === 'covers' ? CoverCard : ListRow
  const layout = view === 'covers'
    ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
    : 'flex flex-col gap-2'

  if (!draggable) {
    return (
      <div className={layout}>
        {games.map(g => (
          <Card key={g.id} game={g} onOpen={onOpen} onStatus={onStatus} />
        ))}
      </div>
    )
  }

  function handleDragStart(e: DragStartEvent) {
    haptic(15)
    setActiveId(String(e.active.id))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const from = games.findIndex(g => g.id === active.id)
    const to = games.findIndex(g => g.id === over.id)
    if (from === -1 || to === -1) return
    haptic(8)
    onReorder(arrayMove(games, from, to))
  }

  const active = activeId ? games.find(g => g.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={games.map(g => g.id)} strategy={view === 'covers' ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={layout}>
          {games.map(g => (
            <SortableCard key={g.id} Card={Card} game={g} onOpen={onOpen} onStatus={onStatus} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(.2,.9,.3,1.25)' }}>
        {active ? <Card game={active} onOpen={() => {}} onStatus={() => {}} dragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
