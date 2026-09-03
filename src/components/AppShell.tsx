import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import Header from './Header'
import { BackgroundTripRecorder } from './BackgroundTripRecorder'
import { LiveActivityController } from './LiveActivityController'
import { DevComponentLabel } from './DevComponentLabel'
import { DevTripReplayController } from './DevTripReplayController'
import { FtueGate } from './FtueGate'
import { isTripDetailImmersiveRoute } from '../lib/trip-map-overlay'
import { useLogbookStore } from '../stores/logbook'

const NO_CHROME = new Set(['/sign-in', '/reset-password'])

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideChrome =
    NO_CHROME.has(pathname) || pathname.startsWith('/crew/invite/')
  const mapOverlayHeader = isTripDetailImmersiveRoute(pathname)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const setOnline = useLogbookStore.getState().setOnline
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  return (
    <>
      <DevComponentLabel
        name="AppShell"
        className="pointer-events-none fixed bottom-2 left-2 z-[9999]"
      />
      <FtueGate>
        <DevTripReplayController />
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
