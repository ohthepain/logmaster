import { createFileRoute } from '@tanstack/react-router'
import { RoutesListPage } from '../../../components/RouteDetailPage'

export const Route = createFileRoute('/_main/routes/')({
  component: RoutesListPage,
})
