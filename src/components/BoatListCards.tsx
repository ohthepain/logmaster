import { Link } from '@tanstack/react-router'
import { Sailboat, Trash2 } from 'lucide-react'
import { defaultBoatPhoto } from '../domain/boat'
import type { Boat } from '../domain/boat'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'

type BoatListCardsProps = {
  boats: Boat[]
  onDelete?: (boat: Boat) => void
}

function BoatCard({
  boat,
  compact,
  onDelete,
}: {
  boat: Boat
  compact: boolean
  onDelete?: (boat: Boat) => void
}) {
  const { t } = useTranslation()
  const cover = defaultBoatPhoto(boat.photos)

  return (
    <article className="group min-w-0">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl bg-[var(--panel)]',
          compact && 'rounded-xl',
        )}
      >
        <Link
          to="/boats/$boatId"
          params={{ boatId: boat.id }}
          className="block no-underline"
        >
          <div
            className={cn(
              'aspect-[16/10] w-full overflow-hidden sm:aspect-[5/3]',
              compact && 'aspect-[4/3] sm:aspect-[4/3]',
            )}
          >
            {cover ? (
              <img
                src={cover.imageUrl}
                alt={boat.name}
                className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-[var(--panel)]">
                <Sailboat
                  className={cn(
                    'text-[var(--sea-ink-soft)]',
                    compact ? 'size-8' : 'size-10',
                  )}
                />
              </div>
            )}
          </div>
        </Link>
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(boat)}
            className={cn(
              'absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--overlay)] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-90 transition sm:opacity-0 sm:group-hover:opacity-100',
              compact && 'right-2 top-2 px-2 py-1 text-[10px]',
            )}
            aria-label={t('deleteNamed', { name: boat.name })}
          >
            <Trash2 className={compact ? 'size-3' : 'size-3.5'} />
            {t('delete')}
          </button>
        ) : null}
      </div>
      <Link
        to="/boats/$boatId"
        params={{ boatId: boat.id }}
        className={cn('mt-3 block no-underline', compact && 'mt-2')}
      >
        <h2
          className={cn(
            'm-0 font-semibold leading-tight text-[var(--sea-ink)]',
            compact ? 'text-base sm:text-lg' : 'text-[1.35rem] sm:text-2xl',
          )}
        >
          {boat.name}
        </h2>
      </Link>
    </article>
  )
}

export function BoatListCards({ boats, onDelete }: BoatListCardsProps) {
  const compact = boats.length > 1

  if (!compact) {
    const boat = boats[0]
    if (!boat) return null
    return (
      <div className="space-y-8">
        <div className="page-wrap px-3 sm:px-4">
          <BoatCard boat={boat} compact={false} onDelete={onDelete} />
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap grid grid-cols-1 gap-5 px-3 sm:grid-cols-2 sm:px-4 sm:gap-4 lg:grid-cols-3 lg:gap-5">
      {boats.map((boat) => (
        <BoatCard key={boat.id} boat={boat} compact onDelete={onDelete} />
      ))}
    </div>
  )
}
