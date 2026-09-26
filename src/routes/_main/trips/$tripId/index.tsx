import { createFileRoute } from '@tanstack/react-router'

type TripSearch = {
  liveActivity?: 'start'
}

export const Route = createFileRoute('/_main/trips/$tripId/')({
  validateSearch: (search: Record<string, unknown>): TripSearch =>
    search.liveActivity === 'start' ? { liveActivity: 'start' } : {},
  // AppShell owns TripDetailPage so opening a boat preserves this map instance.
  component: () => null,
})
