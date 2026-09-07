import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/boats/$boatId')({
  component: BoatLayout,
})

function BoatLayout() {
  return <Outlet />
}
