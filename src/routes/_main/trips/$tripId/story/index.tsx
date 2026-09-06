import { Link, createFileRoute } from '@tanstack/react-router'
import { TripStoryPageShell } from '../../../../../components/TripStoryPageShell'
import { TripStoryView } from '../../../../../components/TripStoryView'
import { useLogbookStore } from '../../../../../stores/logbook'

export const Route = createFileRoute('/_main/trips/$tripId/story/')({
  component: TripStoryPage,
})

function TripStoryPage() {
  const { tripId } = Route.useParams()
  const trip = useLogbookStore((state) =>
    state.trips.find((candidate) => candidate.id === tripId),
  )

  if (!trip) {
    return (
      <TripStoryPageShell>
        <div className="mx-auto max-w-lg px-4 py-12">
          <p className="text-sm text-[var(--sea-ink-soft)]">Trip not found.</p>
          <Link
            to="/trips"
            className="mt-4 inline-block text-sm text-[var(--brand)]"
          >
            Back to trips
          </Link>
        </div>
      </TripStoryPageShell>
    )
  }

  return (
    <TripStoryPageShell
      toolbar={
        <>
          <Link
            to="/trips/$tripId"
            params={{ tripId }}
            className="rounded-xl border border-[var(--chip-line)] px-3 py-1.5 text-sm text-[var(--sea-ink)]"
          >
            Trip
          </Link>
          <div className="flex gap-2">
            <Link
              to="/trips/$tripId/story/edit"
              params={{ tripId }}
              className="rounded-xl bg-[var(--btn-bg)] px-4 py-1.5 text-sm font-semibold text-[var(--btn-text)]"
            >
              Edit
            </Link>
          </div>
        </>
      }
    >
      {trip.storyHtml?.trim() ? (
        <TripStoryView html={trip.storyHtml} className="pb-12 pt-6" />
      ) : (
        <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <p className="text-sm text-[var(--sea-ink-soft)]">
            No story yet. Create one from your trip log and photos.
          </p>
          <Link
            to="/trips/$tripId/story/edit"
            params={{ tripId }}
            className="mt-4 inline-block text-sm font-semibold text-[var(--brand)]"
          >
            Write story
          </Link>
        </div>
      )}
    </TripStoryPageShell>
  )
}
