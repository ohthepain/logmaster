import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/map')({
  // AppShell keeps the map mounted while a boat menu covers it.
  component: () => null,
})
