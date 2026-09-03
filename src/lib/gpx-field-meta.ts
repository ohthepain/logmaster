export const GPX_TRACK_KIND_PREFIX = 'gpx:'

/** GPX 1.1 `<speed>` is metres per second. */
export const GPX_MS_TO_KNOTS = 1.943_844_492_440_6

export type GpxFieldMeta = {
  label: string
  shortLabel: string
  unit: string
  scaleGroup: string
  formatValue: (value: number) => string
}

const KNOWN_GPX_FIELDS: Record<string, GpxFieldMeta> = {
  hr: {
    label: 'Heart rate',
    shortLabel: 'HR',
    unit: 'bpm',
    scaleGroup: 'gpx-field:hr',
    formatValue: (value) => `${Math.round(value)}`,
  },
  cad: {
    label: 'Cadence',
    shortLabel: 'Cad',
    unit: 'rpm',
    scaleGroup: 'gpx-field:cad',
    formatValue: (value) => `${Math.round(value)}`,
  },
  atemp: {
    label: 'Ambient temperature',
    shortLabel: 'Temp',
    unit: '°C',
    scaleGroup: 'temperature-c',
    formatValue: (value) => `${value.toFixed(1)}°C`,
  },
  power: {
    label: 'Power',
    shortLabel: 'Pow',
    unit: 'W',
    scaleGroup: 'gpx-field:power',
    formatValue: (value) => `${Math.round(value)} W`,
  },
  distance: {
    label: 'Distance',
    shortLabel: 'Dist',
    unit: 'm',
    scaleGroup: 'gpx-field:distance',
    formatValue: (value) => `${Math.round(value)} m`,
  },
}

export function normalizeGpxExtensionKey(tagName: string): string {
  const trimmed = tagName.trim()
  if (!trimmed) return ''
  const local = trimmed.includes(':') ? trimmed.split(':').pop()! : trimmed
  return local.toLowerCase()
}

export function gpxTrackKindForField(fieldKey: string): `gpx:${string}` {
  return `${GPX_TRACK_KIND_PREFIX}${fieldKey}`
}

export function parseGpxTrackKind(kind: string): string | null {
  if (!kind.startsWith(GPX_TRACK_KIND_PREFIX)) return null
  const fieldKey = kind.slice(GPX_TRACK_KIND_PREFIX.length)
  return fieldKey || null
}

export function isGpxImportScalarTrackKind(kind: string): boolean {
  return kind.startsWith(GPX_TRACK_KIND_PREFIX)
}

function humanizeGpxFieldKey(fieldKey: string): string {
  return fieldKey
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function gpxFieldMeta(fieldKey: string): GpxFieldMeta {
  const known = KNOWN_GPX_FIELDS[fieldKey]
  if (known) return known

  const label = humanizeGpxFieldKey(fieldKey)
  return {
    label,
    shortLabel: label.slice(0, 6),
    unit: '',
    scaleGroup: `gpx-field:${fieldKey}`,
    formatValue: (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1)),
  }
}

export function gpxFieldMetaForTrackKind(kind: string): GpxFieldMeta | null {
  const fieldKey = parseGpxTrackKind(kind)
  if (!fieldKey) return null
  return gpxFieldMeta(fieldKey)
}
