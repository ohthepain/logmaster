import { createFileRoute } from '@tanstack/react-router'
import { RouteDetailPage } from '../../../components/RouteDetailPage'

export const Route = createFileRoute('/_main/routes/$routeId')({
  component: RouteDetailRoutePage,
})

function RouteDetailRoutePage() {
  const { routeId } = Route.useParams()
  return <RouteDetailPage routeId={routeId} />
}
