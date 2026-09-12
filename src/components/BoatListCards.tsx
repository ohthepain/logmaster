import { Link } from '@tanstack/react-router'
import { Sailboat, Trash2 } from 'lucide-react'
import { defaultBoatPhoto } from '../domain/boat'
import type { Boat } from '../domain/boat'
import { useTranslation } from '../lib/i18n'

type BoatListCardsProps = {
  boats: Boat[]
  onDelete?: (boat: Boat) => void
}

export function BoatListCards({ boats, onDelete }: BoatListCardsProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-8">
      {boats.map((boat) => {
        const cover = defaultBoatPhoto(boat.photos)
        return (
          <article key={boat.id} className="group">
            <div className="page-wrap px-3 sm:px-4">
              <div className="relative overflow-hidden rounded-2xl bg-[var(--panel)]">
                <Link
                  to="/boats/$boatId"
                  params={{ boatId: boat.id }}
                  className="block no-underline"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden sm:aspect-[5/3]">
                    {cover ? (
                      <img
                        src={cover.imageUrl}
                        alt={boat.name}
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-[var(--panel)]">
                        <Sailboat className="size-10 text-[var(--sea-ink-soft)]" />
                      </div>
                    )}
                  </div>
                </Link>
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(boat)}
                    className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--overlay)] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-90 transition sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={t('deleteNamed', { name: boat.name })}
                  >
                    <Trash2 className="size-3.5" />
                    {t('delete')}
                  </button>
                ) : null}
              </div>
              <Link
                to="/boats/$boatId"
                params={{ boatId: boat.id }}
                className="mt-3 block no-underline"
              >
                <h2 className="m-0 text-[1.35rem] font-semibold leading-tight text-[var(--sea-ink)] sm:text-2xl">
                  {boat.name}
                </h2>
              </Link>
            </div>
          </article>
        )
      })}
    </div>
  )
}
