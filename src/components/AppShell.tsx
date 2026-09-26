import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import Header from './Header'
import { BackgroundTripRecorder } from './BackgroundTripRecorder'
import { LiveActivityController } from './LiveActivityController'
import { DevComponentLabel } from './DevComponentLabel'
import { DevTripReplayController } from './DevTripReplayController'
import { DevTripRetripController } from './DevTripRetripController'
import { AuthGate } from './AuthGate'
import { FtueGate } from './FtueGate'
import {
  isNativeAppleMapUnderlayRoute,
  isBoatMenuRoute,
  isMapPageRoute,
  isTripStoryRoute,
} from '../lib/trip-map-overlay'
import { useLogbookStore } from '../stores/logbook'
import { getNativePlatform } from '../lib/platform'
import { useIosNativeMapTouchPassthrough } from '../lib/native/ios-map-touch-passthrough'
import { requestIosMapTouchSync } from '../lib/native/ios-map-touch-suspend'
import { IosBlockingOverlayTouchBridge } from './IosBlockingOverlayTouchBridge'
import { BoatMenuFrame } from './BoatMenuFrame'
import { MapRouteSurface } from './MapRouteSurface'
import type { MapPage } from './MapRouteSurface'

const NO_CHROME = new Set(['/sign-in', '/reset-password', '/about', '/contact'])

function useMobileViewport() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return mobile
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname, tripId, liveActivity } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      tripId: (
        s.matches.find((match) => match.routeId === '/_main/trips/$tripId/')
          ?.params as { tripId?: string } | undefined
      )?.tripId,
      liveActivity: s.location.search.liveActivity,
    }),
  })
  const navigate = useNavigate()
  const boatMenuOpen = isBoatMenuRoute(pathname)
  const mapPage = useMemo<MapPage | null>(
    () => (isMapPageRoute(pathname) ? { pathname, tripId } : null),
    [pathname, tripId],
  )
  const [lastMapPage, setLastMapPage] = useState<MapPage | null>(null)
  useEffect(() => {
    if (mapPage) setLastMapPage(mapPage)
    else if (!boatMenuOpen) setLastMapPage(null)
  }, [mapPage, boatMenuOpen])
  const backgroundMap = mapPage ?? lastMapPage ?? { pathname: '/map' }
  const closeBoatMenu = () => {
    if (backgroundMap.tripId) {
      void navigate({
        to: '/trips/$tripId',
        params: { tripId: backgroundMap.tripId },
      })
    } else {
      void navigate({ to: backgroundMap.pathname === '/' ? '/' : '/map' })
    }
  }
  const mobileViewport = useMobileViewport()
  useIosNativeMapTouchPassthrough(
    getNativePlatform() === 'ios' && isNativeAppleMapUnderlayRoute(pathname),
  )
  const hideChrome =
    NO_CHROME.has(pathname) ||
    pathname.startsWith('/crew/invite/') ||
    pathname.startsWith('/invite/') ||
    isTripStoryRoute(pathname) ||
    (mobileViewport && pathname === '/messages')
  const mapOverlayHeader = isNativeAppleMapUnderlayRoute(pathname)

  useEffect(() => {
    if (getNativePlatform() !== 'ios' || !mapOverlayHeader) return
    requestIosMapTouchSync()
  }, [mapOverlayHeader, pathname])

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
      <IosBlockingOverlayTouchBridge />
      <DevComponentLabel
        name="AppShell"
        className="pointer-events-none fixed bottom-2 left-2 z-[9999]"
      />
      <FtueGate>
        <DevTripReplayController />
        <DevTripRetripController />
        <BackgroundTripRecorder />
        <LiveActivityController />
        {mapPage || boatMenuOpen ? (
          <AuthGate>
            <MapRouteSurface
              page={backgroundMap}
              covered={boatMenuOpen}
              startFromLiveActivity={liveActivity === 'start'}
            />
          </AuthGate>
        ) : null}
        {hideChrome ? (
          <AuthGate>{children}</AuthGate>
        ) : (
          <>
            <div inert={boatMenuOpen} aria-hidden={boatMenuOpen || undefined}>
              <Header mapOverlay={mapOverlayHeader} />
            </div>
            {boatMenuOpen ? (
              <BoatMenuFrame onClose={closeBoatMenu}>
                <Header onClose={closeBoatMenu} />
                <AuthGate>{children}</AuthGate>
              </BoatMenuFrame>
            ) : !mapPage ? (
              <AuthGate>{children}</AuthGate>
            ) : null}
          </>
        )}
      </FtueGate>
    </>
  )
}
