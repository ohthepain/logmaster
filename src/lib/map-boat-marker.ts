import { boatIconSrc } from './boat-icons'
import { normalizeBearing360 } from './angle'

export const BOAT_MAP_MARKER_WIDTH = 36
export const BOAT_MAP_MARKER_HEIGHT = 44

type MapPoint = {
  latitude: number
  longitude: number
}

function bearingBetween(from: MapPoint, to: MapPoint): number {
  const latitude1 = (from.latitude * Math.PI) / 180
  const latitude2 = (to.latitude * Math.PI) / 180
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2)
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta)
  return normalizeBearing360((Math.atan2(y, x) * 180) / Math.PI)
}

export function resolveBoatMapHeading(
  heading: number | null | undefined,
  previous: MapPoint | null,
  current: MapPoint,
): number {
  if (heading != null && Number.isFinite(heading)) {
    return normalizeBearing360(heading)
  }
  if (previous) {
    return bearingBetween(previous, current)
  }
  return 0
}

export function boatMapMarkerRotation(heading: number | null | undefined): number {
  if (heading == null || !Number.isFinite(heading)) return 0
  return heading
}

export function createBoatMapMarkerElement(options: {
  iconSrc: string
  heading?: number | null
}): HTMLDivElement {
  const root = document.createElement('div')
  root.className = 'trip-boat-map-marker'
  root.setAttribute('aria-label', 'Boat position')
  root.style.cssText =
    'width:36px;height:44px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));pointer-events:none;'

  const headingWrap = document.createElement('div')
  headingWrap.dataset.boatHeading = 'true'
  headingWrap.style.cssText =
    'width:32px;height:40px;transform-origin:50% 50%;transition:transform 80ms linear;display:flex;align-items:center;justify-content:center;'
  headingWrap.style.transform = `rotate(${boatMapMarkerRotation(options.heading)}deg)`

  const image = document.createElement('img')
  image.src = options.iconSrc
  image.alt = ''
  image.draggable = false
  image.style.cssText = 'max-width:32px;max-height:40px;width:auto;height:auto;object-fit:contain;'

  headingWrap.append(image)
  root.append(headingWrap)
  return root
}

export function updateBoatMapMarkerElement(
  element: HTMLElement,
  options: {
    iconSrc?: string
    heading?: number | null
  },
) {
  if (options.iconSrc) {
    const image = element.querySelector('img')
    if (image instanceof HTMLImageElement && image.src !== options.iconSrc) {
      image.src = options.iconSrc
    }
  }
  const headingWrap = element.querySelector<HTMLElement>('[data-boat-heading]')
  if (headingWrap && options.heading !== undefined) {
    headingWrap.style.transform = `rotate(${boatMapMarkerRotation(options.heading)}deg)`
  }
}

export function createBoatMapMarkerElementForIconId(
  iconId: string | null | undefined,
  heading?: number | null,
) {
  return createBoatMapMarkerElement({
    iconSrc: boatIconSrc(iconId),
    heading,
  })
}
