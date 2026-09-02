import { normalizeBearing360 } from './angle'

export const GPX_IMPORT_SOURCE = 'gpx-import'
export const GPX_IMPORT_MAX_TRACK_POINTS = 1500

export type GpxTrackPoint = {
  latitude: number
  longitude: number
  time: string
  elevationM: number | null
  heading: number | null
}

export type ParsedGpxTrack = {
  name: string | null
  points: GpxTrackPoint[]
}

export class GpxImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GpxImportError'
  }
}

function parseNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseIsoTime(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const ms = Date.parse(value.trim())
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function readChildText(content: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(content)
  if (!match) return null
  const text = match[1]?.trim()
  return text || null
}

function parsePointBlock(
  block: string,
  attrs: string,
): GpxTrackPoint | null {
  const lat = parseNumber(/lat="([^"]+)"/i.exec(attrs)?.[1])
  const lon = parseNumber(/lon="([^"]+)"/i.exec(attrs)?.[1])
  if (lat == null || lon == null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  const time = parseIsoTime(readChildText(block, 'time'))
  const elevationM = parseNumber(readChildText(block, 'ele'))
  const course = parseNumber(readChildText(block, 'course'))

  return {
    latitude: lat,
    longitude: lon,
    time: time ?? '',
    elevationM,
    heading: course != null ? normalizeBearing360(course) : null,
  }
}

function parsePointTags(xml: string, tag: 'trkpt' | 'rtept' | 'wpt'): GpxTrackPoint[] {
  const points: GpxTrackPoint[] = []
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  for (const match of xml.matchAll(pattern)) {
    const attrs = match[1] ?? ''
    const block = match[2] ?? ''
    const point = parsePointBlock(block, attrs)
    if (point) points.push(point)
  }
  return points
}

function readTrackName(xml: string): string | null {
  const trackSection = /<trk\b[\s\S]*?<\/trk>/i.exec(xml)?.[0]
  if (!trackSection) return null
  const name = readChildText(trackSection, 'name')
  return name?.trim() || null
}

function readMetadataName(xml: string): string | null {
  const metadataSection = /<metadata\b[\s\S]*?<\/metadata>/i.exec(xml)?.[0]
  if (!metadataSection) return null
  const name = readChildText(metadataSection, 'name')
  return name?.trim() || null
}

function bearingBetween(
  from: Pick<GpxTrackPoint, 'latitude' | 'longitude'>,
  to: Pick<GpxTrackPoint, 'latitude' | 'longitude'>,
): number {
  const latitude1 = (from.latitude * Math.PI) / 180
  const latitude2 = (to.latitude * Math.PI) / 180
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2)
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta)
  return normalizeBearing360((Math.atan2(y, x) * 180) / Math.PI)
}

export function downsampleGpxPoints(
  points: GpxTrackPoint[],
  maxPoints: number,
): GpxTrackPoint[] {
  if (points.length <= maxPoints) return points
  if (maxPoints < 2) return [points[0]]

  const sampled: GpxTrackPoint[] = [points[0]]
  const step = (points.length - 1) / (maxPoints - 1)
  for (let index = 1; index < maxPoints - 1; index += 1) {
    sampled.push(points[Math.round(index * step)])
  }
  sampled.push(points[points.length - 1])
  return sampled
}

function assignMissingTimes(points: GpxTrackPoint[]): GpxTrackPoint[] {
  const knownTimes = points
    .map((point) => Date.parse(point.time))
    .filter((ms) => Number.isFinite(ms))
  const anchorMs =
    knownTimes.length > 0
      ? Math.min(...knownTimes)
      : Date.now() - Math.max(0, points.length - 1) * 60_000

  return points.map((point, index) => {
    const parsed = Date.parse(point.time)
    if (Number.isFinite(parsed)) return point
    return {
      ...point,
      time: new Date(anchorMs + index * 60_000).toISOString(),
    }
  })
}

function enrichHeadings(points: GpxTrackPoint[]): GpxTrackPoint[] {
  return points.map((point, index) => {
    if (point.heading != null) return point
    const next = points[index + 1]
    if (!next) {
      const previous = points[index - 1]
      if (!previous) return point
      return {
        ...point,
        heading: bearingBetween(previous, point),
      }
    }
    return {
      ...point,
      heading: bearingBetween(point, next),
    }
  })
}

function sortTrackPoints(points: GpxTrackPoint[]): GpxTrackPoint[] {
  return [...points].sort((a, b) => {
    const aMs = Date.parse(a.time)
    const bMs = Date.parse(b.time)
    if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) {
      return aMs - bMs
    }
    return 0
  })
}

export function parseGpx(xml: string): ParsedGpxTrack {
  const trimmed = xml.trim()
  if (!trimmed) {
    throw new GpxImportError('The GPX file is empty.')
  }
  if (!/<gpx[\s>]/i.test(trimmed)) {
    throw new GpxImportError('This does not look like a GPX file.')
  }

  let points = parsePointTags(trimmed, 'trkpt')
  if (points.length === 0) points = parsePointTags(trimmed, 'rtept')
  if (points.length === 0) points = parsePointTags(trimmed, 'wpt')

  if (points.length === 0) {
    throw new GpxImportError('No track points were found in this GPX file.')
  }

  points = assignMissingTimes(sortTrackPoints(points))
  points = downsampleGpxPoints(points, GPX_IMPORT_MAX_TRACK_POINTS)
  points = enrichHeadings(points)

  return {
    name: readTrackName(trimmed) ?? readMetadataName(trimmed),
    points,
  }
}

export function gpxImportBoatName(
  parsed: ParsedGpxTrack,
  fileName?: string | null,
  override?: string | null,
): string {
  const custom = override?.trim()
  if (custom) return custom
  if (parsed.name?.trim()) return parsed.name.trim()
  const fromFile = fileName?.replace(/\.gpx$/i, '').trim()
  if (fromFile) return fromFile
  return 'Imported trip'
}

export function gpxImportTripTitle(
  boatName: string,
  startedAt: string,
): string {
  const startedDate = new Date(startedAt)
  const monthYear = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(startedDate)
  return `${boatName.trim()} - ${monthYear}`
}

export function gpxImportSummary(parsed: ParsedGpxTrack) {
  const startedAt = parsed.points[0]?.time
  const completedAt = parsed.points[parsed.points.length - 1]?.time
  if (!startedAt || !completedAt) {
    throw new GpxImportError('Could not determine trip start and end times.')
  }
  return { startedAt, completedAt }
}
