import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/boats/new')({
  beforeLoad: () => {
    throw redirect({ to: '/boats', search: { addBoat: true } })
  },
})
