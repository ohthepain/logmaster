import { createFileRoute } from '@tanstack/react-router'
import { MapDefaultView } from '../../components/MapDefaultView'

export const Route = createFileRoute('/_main/map')({
  component: MapDefaultView,
})
