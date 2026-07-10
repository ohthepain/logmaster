import { Link } from '@tanstack/react-router'
import { Sailboat } from 'lucide-react'
import { defaultBoatPhoto  } from '../domain/boat'
import type {Boat} from '../domain/boat';
import { cn } from '../lib/cn'

type BoatsGridProps = {
  boats: Boat[]
  className?: string
  iconClassName?: string
}

export function BoatsGrid({
  boats,
  className,
  iconClassName = 'size-32',
}: BoatsGridProps) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-3', className)}>
      {boats.map((boat) => {
        const cover = defaultBoatPhoto(boat.photos)

        return (
          <Link
            key={boat.id}
            to="/boats/$boatId"
            params={{ boatId: boat.id }}
            className="inline-flex w-32 flex-col items-center text-center no-underline transition hover:opacity-80"
          >
            {cover ? (
              <img
                src={cover.imageUrl}
                alt=""
                className={cn('rounded-2xl object-cover', iconClassName)}
              />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center text-[var(--sea-ink-soft)]',
                  iconClassName,
                )}
              >
                <Sailboat className="size-12" strokeWidth={1.5} aria-hidden />
              </div>
            )}
            <p className="m-0 mt-1.5 w-full truncate text-xs font-semibold text-[var(--sea-ink)] sm:text-sm">
              {boat.name}
            </p>
          </Link>
        )
      })}
    </div>
  )
}
