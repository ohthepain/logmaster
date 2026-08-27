import { createFileRoute } from '@tanstack/react-router'
import { TripDetailPage } from '../../../components/TripDetailPage'

type TripSearch = {
  liveActivity?: 'start'
}

export const Route = createFileRoute('/_main/trips/$tripId')({
  validateSearch: (search: Record<string, unknown>): TripSearch =>
    search.liveActivity === 'start' ? { liveActivity: 'start' } : {},
  component: TripRoutePage,
})

function TripRoutePage() {
  const { tripId } = Route.useParams()
  const { liveActivity } = Route.useSearch()
  return (
    <TripDetailPage
      tripId={tripId}
      startFromLiveActivity={liveActivity === 'start'}
    />
  )
}
