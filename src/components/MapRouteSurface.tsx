import { lazy, Suspense } from 'react'

const MapDefaultView = lazy(() =>
  import('./MapDefaultView').then((module) => ({
    default: module.MapDefaultView,
  })),
)
const TripDetailPage = lazy(() =>
  import('./TripDetailPage').then((module) => ({
    default: module.TripDetailPage,
  })),
)

export type MapPage = { pathname: string; tripId?: string }

/** Remains in the same React tree position while boat pages cover the map. */
export function MapRouteSurface({
  page,
  covered,
  startFromLiveActivity,
}: {
  page: MapPage
  covered: boolean
  startFromLiveActivity: boolean
}) {
  return (
    <div aria-hidden={covered || undefined} inert={covered}>
      <Suspense fallback={null}>
        {page.tripId ? (
          <TripDetailPage
            tripId={page.tripId}
            startFromLiveActivity={!covered && startFromLiveActivity}
          />
        ) : (
          <MapDefaultView active={!covered} />
        )}
      </Suspense>
    </div>
  )
}
