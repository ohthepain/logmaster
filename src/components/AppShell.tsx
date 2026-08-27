import { useRouterState } from '@tanstack/react-router'
import Header from './Header'
import { BackgroundTripRecorder } from './BackgroundTripRecorder'
import { LiveActivityController } from './LiveActivityController'
import { DevComponentLabel } from './DevComponentLabel'
import { FtueGate } from './FtueGate'
import { isTripDetailImmersiveRoute } from '../lib/trip-map-overlay'

const NO_CHROME = new Set(['/sign-in', '/reset-password'])

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideChrome =
    NO_CHROME.has(pathname) || pathname.startsWith('/crew/invite/')
  const mapOverlayHeader = isTripDetailImmersiveRoute(pathname)
  return (
    <>
      <DevComponentLabel
        name="AppShell"
        className="pointer-events-none fixed bottom-2 left-2 z-[9999]"
      />
      <FtueGate>
        <BackgroundTripRecorder />
        <LiveActivityController />
        {hideChrome ? (
          children
        ) : (
          <>
            <Header mapOverlay={mapOverlayHeader} />
            {children}
          </>
        )}
      </FtueGate>
    </>
  )
}
