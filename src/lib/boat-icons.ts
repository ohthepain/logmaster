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

export function isBoatIconId(value: string | null | undefined): value is BoatIconId {
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
    reader.onerror = () => reject(reader.error ?? new Error('Could not read boat icon'))
    reader.readAsDataURL(blob)
  })
  dataUrlCache.set(src, dataUrl)
  return dataUrl
}
