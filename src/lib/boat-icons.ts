export const BOAT_ICON_IDS = [
  'barge',
  'bigyacht',
  'canoe',
  'cat',
  'dinghy',
  'lounger',
  'medium',
  'rowboat',
  'speed',
  'steamer',
] as const

export type BoatIconId = (typeof BOAT_ICON_IDS)[number]

export const DEFAULT_BOAT_ICON_ID: BoatIconId = 'medium'

const BOAT_ICON_LABELS: Record<BoatIconId, string> = {
  barge: 'Barge',
  bigyacht: 'Big yacht',
  canoe: 'Canoe',
  cat: 'Catamaran',
  dinghy: 'Dinghy',
  lounger: 'Lounger',
  medium: 'Sailboat',
  rowboat: 'Rowboat',
  speed: 'Speedboat',
  steamer: 'Steamer',
}

export type BoatIconOption = {
  id: BoatIconId
  label: string
  src: string
}

export const BOAT_ICONS: BoatIconOption[] = BOAT_ICON_IDS.map((id) => ({
  id,
  label: BOAT_ICON_LABELS[id],
  src: `/boats/boat_${id}.png`,
}))

export function isBoatIconId(
  value: string | null | undefined,
): value is BoatIconId {
  return BOAT_ICON_IDS.includes(value as BoatIconId)
}

export function boatIconSrc(iconId: string | null | undefined): string {
  const id = isBoatIconId(iconId) ? iconId : DEFAULT_BOAT_ICON_ID
  return `/boats/boat_${id}.png`
}

export function boatIconLabel(iconId: string | null | undefined): string {
  const id = isBoatIconId(iconId) ? iconId : DEFAULT_BOAT_ICON_ID
  return BOAT_ICON_LABELS[id]
}

/** Longest box the map marker may occupy, in CSS pixels. */
export const BOAT_ICON_MARKER_MAX_WIDTH = 32
export const BOAT_ICON_MARKER_MAX_HEIGHT = 40

export function fittedBoatIconSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth = BOAT_ICON_MARKER_MAX_WIDTH,
  maxHeight = BOAT_ICON_MARKER_MAX_HEIGHT,
): { width: number; height: number } {
  if (
    !(naturalWidth > 0) ||
    !(naturalHeight > 0) ||
    !(maxWidth > 0) ||
    !(maxHeight > 0)
  ) {
    return { width: maxWidth, height: maxHeight }
  }
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight)
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  }
}

const dataUrlCache = new Map<string, string>()

export async function loadBoatIconDataUrl(
  iconId: string | null | undefined,
): Promise<string> {
  const src = boatIconSrc(iconId)
  const cached = dataUrlCache.get(src)
  if (cached) return cached

  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Could not load boat icon (${response.status})`)
  }
  const blob = await response.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read boat icon'))
    }
    reader.onerror = () =>
      reject(reader.error ?? new Error('Could not read boat icon'))
    reader.readAsDataURL(blob)
  })
  const contained = await containBoatIconDataUrl(dataUrl)
  dataUrlCache.set(src, contained)
  return contained
}

/**
 * Draw the icon aspect-fit into the native marker box.
 * MapKit stretches the bitmap to a fixed 32×40 point view, so the pixels
 * themselves have to already match that frame.
 */
async function containBoatIconDataUrl(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined') return dataUrl
  const image = await loadHtmlImage(dataUrl)
  const fitted = fittedBoatIconSize(image.naturalWidth, image.naturalHeight)
  const pixelScale = 2
  const canvas = document.createElement('canvas')
  canvas.width = BOAT_ICON_MARKER_MAX_WIDTH * pixelScale
  canvas.height = BOAT_ICON_MARKER_MAX_HEIGHT * pixelScale
  const context = canvas.getContext('2d')
  if (!context || !(fitted.width > 0) || !(fitted.height > 0)) return dataUrl
  const width = fitted.width * pixelScale
  const height = fitted.height * pixelScale
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    image,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  )
  return canvas.toDataURL('image/png')
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read boat icon'))
    image.src = src
  })
}
