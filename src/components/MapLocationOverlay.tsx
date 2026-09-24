import { Compass, LoaderCircle, MapPinOff } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { MapLocationState } from '../lib/use-map-location'
import { openBackgroundLocationSettings } from '../lib/native/background-tracker'
import { requestIosMapTouchSync } from '../lib/native/ios-map-touch-suspend'

export function MapLocationOverlay({
  state,
  onContinue,
  onBrowse,
}: {
  state: MapLocationState
  onContinue: () => void
  onBrowse: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [settingsError, setSettingsError] = useState(false)
  const visible = !['idle', 'ready', 'browsing'].includes(state)
  const permission = state === 'permission' || state === 'requesting'
  const busy =
    state === 'checking' || state === 'locating' || state === 'requesting'
  const denied = state === 'denied'
  useEffect(() => {
    requestIosMapTouchSync()
    if (!visible) return
    const previous = document.activeElement
    if (!document.documentElement.hasAttribute('data-ftue-active')) {
      panelRef.current?.focus({ preventScroll: true })
    }
    return () => {
      requestIosMapTouchSync()
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [visible])
  if (!visible) return null
  const title = permission
    ? 'Where are you?'
    : denied
      ? 'Location access is off'
      : busy
        ? 'Getting your location…'
        : 'We couldn’t get your location'
  const description = permission
    ? 'Logmaster needs location permission to show your position on the map.'
    : denied
      ? Capacitor.isNativePlatform()
        ? 'Allow location access for Logmaster in Settings to show your position on the map.'
        : 'Allow location access in your browser’s site settings, then try again.'
      : state === 'checking'
        ? 'Checking location access on your device.'
        : busy
          ? 'Waiting for your device to report its position.'
          : state === 'timeout'
            ? 'Your device is taking longer than expected to find a position. Try again or browse the map.'
            : 'Check that location services are on, then try again. You can also browse the map.'
  return (
    <div
      data-map-touch-zone
      className={`ios-map-touch-target pointer-events-auto absolute inset-0 z-40 flex items-center justify-center overflow-auto p-5 ${permission ? 'bg-[#102f3c]/15' : 'bg-[#eaf3f2]'}`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/95 p-7 text-center text-[#153e49] shadow-[0_24px_80px_-24px_rgba(10,45,57,0.45)] outline-none sm:p-9"
      >
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[#e6f1ee] text-[#287c76]">
          {busy ? (
            <LoaderCircle
              className="size-6 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : denied ? (
            <MapPinOff className="size-6" aria-hidden />
          ) : (
            <Compass className="size-7" strokeWidth={1.5} aria-hidden />
          )}
        </div>
        <div role="status" aria-live="polite">
          <h2
            id={titleId}
            className="m-0 text-3xl font-semibold tracking-tight"
          >
            {title}
          </h2>
          <p
            id={descriptionId}
            className="mb-0 mt-3 text-sm leading-relaxed text-[#526d73]"
          >
            {description}
          </p>
        </div>
        {!busy && (
          <button
            type="button"
            onClick={() => {
              if (denied && Capacitor.isNativePlatform()) {
                void openBackgroundLocationSettings().catch(() =>
                  setSettingsError(true),
                )
              } else onContinue()
            }}
            className="mt-7 min-h-12 w-full rounded-full bg-[#174f54] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#20676c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#174f54]"
          >
            {permission
              ? 'Continue'
              : denied && Capacitor.isNativePlatform()
                ? 'Open Settings'
                : 'Try again'}
          </button>
        )}
        {settingsError && (
          <p className="mt-3 text-sm">
            Open your device’s Settings and allow location access for Logmaster.
          </p>
        )}
        {!permission && state !== 'checking' && (
          <button
            type="button"
            onClick={onBrowse}
            className="mt-3 min-h-11 rounded-full px-5 py-2 text-sm font-medium text-[#526d73] hover:text-[#153e49]"
          >
            Browse map
          </button>
        )}
      </div>
    </div>
  )
}
