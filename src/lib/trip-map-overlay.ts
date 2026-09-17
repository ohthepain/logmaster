/** Shared glass surface for map overlay chrome (controls + bottom sheet + trip header). */
export const TRIP_MAP_OVERLAY_SURFACE_CLASS = 'bg-black/30' as const

export const TRIP_MAP_OVERLAY_BORDER_CLASS = 'border-white/25' as const

export const TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS =
  'border-white/25 bg-black/30' as const

export function isTripDetailImmersiveRoute(pathname: string): boolean {
  return /^\/trips\/[^/]+$/.test(pathname)
}

export function isTripStoryRoute(pathname: string): boolean {
  return /^\/trips\/[^/]+\/story(\/edit)?\/?$/.test(pathname)
}

/** Routes where the native Apple MapKit view sits under the WebView on iOS. */
export function isNativeAppleMapUnderlayRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/map' ||
    isTripDetailImmersiveRoute(pathname)
  )
}
