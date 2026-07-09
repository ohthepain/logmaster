import { createFileRoute } from '@tanstack/react-router'
import { TripDetailPage } from '../../../components/TripDetailPage'

export const Route = createFileRoute('/_main/trips/$tripId')({
  component: TripRoutePage,
})

function TripRoutePage() {
  const { tripId } = Route.useParams()
  return <TripDetailPage tripId={tripId} />
}
