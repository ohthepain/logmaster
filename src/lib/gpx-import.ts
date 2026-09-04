import { normalizeBearing360 } from './angle'
import { normalizeGpxExtensionKey } from './gpx-field-meta'

export const GPX_IMPORT_SOURCE = 'gpx-import'
export const GPX_IMPORT_MAX_TRACK_POINTS = 1500

export type GpxTrackPoint = {
  latitude: number
  longitude: number
  time: string
  elevationM: number | null
  heading: number | null
  /** Numeric extension and standard GPX fields keyed by normalized name (e.g. hr, speed). */
  extensions: Record<string, number>
}

export type GpxWaypoint = {
  name: string | null
  description: string | null
  symbol: string | null
  latitude: number
  longitude: number
  time: string | null
}

export type GpxTrackSegment = {
  /** Optional segment label from parent track name (OpenCPN track export). */
  trackName: string | null
  points: GpxTrackPoint[]
}

export type ParsedGpxTrack = {
  name: string | null
  /** All sailed points, flattened across segments (for scalars and summary). */
  points: GpxTrackPoint[]
  /** One entry per GPX trkseg (and trk boundary when flattening multiple tracks). */
  segments: GpxTrackSegment[]
  waypoints: GpxWaypoint[]
  /** True when points came from a route or waypoint list, not a recorded track. */
  routeOnly: boolean
  /** True when at least one segment came from `<trk>` / `<trkseg>`. */
  hasTrkData: boolean
}

export type GpxRawDocument = {
  metadataName: string | null
  waypoints: GpxWaypoint[]
  trackSegments: GpxTrackSegment[]
  routeSegments: GpxTrackSegment[]
}

export type GpxImportFile = {
  gpxXml: string
  fileName?: string
}

export class GpxImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GpxImportError'
  }
}

/** OpenCPN sometimes exports a folder named like `Trip.gpx` — pick that folder, not the folder as a file. */
export class GpxFolderImportNeededError extends GpxImportError {
  constructor(
    message = 'Select the OpenCPN export folder to import the GPX files inside it.',
  ) {
    super(message)
    this.name = 'GpxFolderImportNeededError'
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

function decodeXmlTextOnce(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function decodeXmlText(text: string): string {
  let decoded = text
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next = decodeXmlTextOnce(decoded)
    if (next === decoded) return next
    decoded = next
  }
  return decoded
}

function readChildText(content: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(content)
  if (!match) return null
  const text = decodeXmlText(match[1]?.trim() ?? '')
  return text || null
}

function parseExtensionsNumeric(block: string): Record<string, number> {
  const extMatch = /<extensions\b[^>]*>([\s\S]*?)<\/extensions>/i.exec(block)
  if (!extMatch) return {}

  const result: Record<string, number> = {}
  const leafPattern = /<([^\s>/]+)(?:\s[^>]*)?>([^<]+)<\/\1>/gi
  for (const match of extMatch[1].matchAll(leafPattern)) {
    const key = normalizeGpxExtensionKey(match[1] ?? '')
    if (!key) continue
    const value = parseNumber(match[2]?.trim())
    if (value != null) result[key] = value
  }
  return result
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
  const extensions = parseExtensionsNumeric(block)
  const speed = parseNumber(readChildText(block, 'speed'))
  if (speed != null) extensions.speed = speed

  return {
    latitude: lat,
    longitude: lon,
    time: time ?? '',
    elevationM,
    heading: course != null ? normalizeBearing360(course) : null,
    extensions,
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

function parseWaypointBlock(block: string, attrs: string): GpxWaypoint | null {
  const lat = parseNumber(/lat="([^"]+)"/i.exec(attrs)?.[1])
  const lon = parseNumber(/lon="([^"]+)"/i.exec(attrs)?.[1])
  if (lat == null || lon == null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  return {
    name: readChildText(block, 'name')?.trim() || null,
    description: readChildText(block, 'desc')?.trim() || null,
    symbol: readChildText(block, 'sym')?.trim() || null,
    latitude: lat,
    longitude: lon,
    time: parseIsoTime(readChildText(block, 'time')),
  }
}

function parseWaypoints(xml: string): GpxWaypoint[] {
  const waypoints: GpxWaypoint[] = []
  const pattern = /<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/gi
  for (const match of xml.matchAll(pattern)) {
    const waypoint = parseWaypointBlock(match[2] ?? '', match[1] ?? '')
    if (waypoint) waypoints.push(waypoint)
  }
  return waypoints
}

function parseTrackSegments(xml: string): GpxTrackSegment[] {
  const segments: GpxTrackSegment[] = []
  const trackPattern = /<trk\b[^>]*>([\s\S]*?)<\/trk>/gi

  for (const trackMatch of xml.matchAll(trackPattern)) {
    const trackBlock = trackMatch[1] ?? ''
    const trackName = readChildText(trackBlock, 'name')?.trim() || null
    const segmentPattern = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/gi
    let foundSegment = false

    for (const segmentMatch of trackBlock.matchAll(segmentPattern)) {
      const points = parsePointTags(segmentMatch[1] ?? '', 'trkpt')
      if (points.length === 0) continue
      foundSegment = true
      segments.push({ trackName, points })
    }

    if (!foundSegment) {
      const points = parsePointTags(trackBlock, 'trkpt')
      if (points.length > 0) {
        segments.push({ trackName, points })
      }
    }
  }

  return segments
}

function parseRouteSegments(xml: string): GpxTrackSegment[] {
  const segments: GpxTrackSegment[] = []
  const routePattern = /<rte\b[^>]*>([\s\S]*?)<\/rte>/gi

  for (const routeMatch of xml.matchAll(routePattern)) {
    const routeBlock = routeMatch[1] ?? ''
    const routeName = readChildText(routeBlock, 'name')?.trim() || null
    const points = parsePointTags(routeBlock, 'rtept')
    if (points.length > 0) {
      segments.push({ trackName: routeName, points })
    }
  }

  return segments
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
  if (maxPoints < 2) return [points[0]!]

  const sampled: GpxTrackPoint[] = [points[0]!]
  const step = (points.length - 1) / (maxPoints - 1)
  for (let index = 1; index < maxPoints - 1; index += 1) {
    sampled.push(points[Math.round(index * step)]!)
  }
  sampled.push(points[points.length - 1]!)
  return sampled
}

export function downsampleGpxSegments(
  segments: GpxTrackSegment[],
  maxPoints: number,
): GpxTrackSegment[] {
  const total = segments.reduce((sum, segment) => sum + segment.points.length, 0)
  if (total <= maxPoints) return segments

  return segments.map((segment) => {
    if (segment.points.length <= 1) return segment
    const budget = Math.max(
      2,
      Math.round((maxPoints * segment.points.length) / total),
    )
    return {
      ...segment,
      points: downsampleGpxPoints(segment.points, Math.min(budget, segment.points.length)),
    }
  })
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

function segmentStartMs(segment: GpxTrackSegment): number {
  for (const point of segment.points) {
    const ms = Date.parse(point.time)
    if (Number.isFinite(ms)) return ms
  }
  return Number.POSITIVE_INFINITY
}

function prepareSegment(segment: GpxTrackSegment): GpxTrackSegment {
  const points = enrichHeadings(assignMissingTimes(sortTrackPoints(segment.points)))
  return { ...segment, points }
}

function sortSegmentsChronologically(segments: GpxTrackSegment[]): GpxTrackSegment[] {
  return [...segments].sort((a, b) => segmentStartMs(a) - segmentStartMs(b))
}

function flattenSegmentPoints(segments: GpxTrackSegment[]): GpxTrackPoint[] {
  return segments.flatMap((segment) => segment.points)
}

function primaryTrackName(segments: GpxTrackSegment[], metadataName: string | null): string | null {
  for (const segment of segments) {
    if (segment.trackName?.trim()) return segment.trackName.trim()
  }
  return metadataName
}

export function looksLikeGpx(xml: string): boolean {
  const trimmed = xml.trim()
  return trimmed.startsWith('<?xml') || /^<gpx[\s>]/i.test(trimmed)
}

function dedupeWaypoints(waypoints: GpxWaypoint[]): GpxWaypoint[] {
  const seen = new Set<string>()
  return waypoints.filter((waypoint) => {
    const key = `${waypoint.latitude.toFixed(6)},${waypoint.longitude.toFixed(6)},${waypoint.name ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function finalizeParsedGpx(raw: GpxRawDocument): ParsedGpxTrack {
  let segments = raw.trackSegments
  let routeOnly = false
  const hasTrkData = segments.length > 0

  if (segments.length === 0 && raw.routeSegments.length > 0) {
    segments = raw.routeSegments
    routeOnly = true
  }

  if (segments.length === 0 && raw.waypoints.length > 0) {
    throw new GpxImportError(
      'This GPX only contains marks or waypoints. Select your tracks GPX file as well (OpenCPN exports these separately).',
    )
  }

  if (segments.length === 0) {
    throw new GpxImportError('No track points were found in this GPX file.')
  }

  segments = sortSegmentsChronologically(segments.map(prepareSegment))
  segments = segments.map(prepareSegment)

  const points = flattenSegmentPoints(segments)

  return {
    name: primaryTrackName(segments, raw.metadataName),
    points,
    segments,
    waypoints: raw.waypoints,
    routeOnly,
    hasTrkData,
  }
}

export function parseGpxRaw(xml: string): GpxRawDocument {
  const trimmed = xml.trim()
  if (!trimmed) {
    throw new GpxImportError('The GPX file is empty.')
  }
  if (!looksLikeGpx(trimmed)) {
    throw new GpxImportError('This does not look like a GPX file.')
  }

  return {
    metadataName: readMetadataName(trimmed),
    waypoints: parseWaypoints(trimmed),
    trackSegments: parseTrackSegments(trimmed),
    routeSegments: parseRouteSegments(trimmed),
  }
}

export function mergeGpxRawDocuments(rawDocuments: GpxRawDocument[]): ParsedGpxTrack {
  if (rawDocuments.length === 0) {
    throw new GpxImportError('No GPX files were provided.')
  }
  if (rawDocuments.length === 1) {
    return finalizeParsedGpx(rawDocuments[0]!)
  }

  const trackSegments = rawDocuments.flatMap((document) => document.trackSegments)
  const routeSegments = rawDocuments.flatMap((document) => document.routeSegments)
  const waypoints = dedupeWaypoints(rawDocuments.flatMap((document) => document.waypoints))
  const metadataName =
    rawDocuments.map((document) => document.metadataName?.trim()).find(Boolean) ?? null

  if (trackSegments.length === 0 && routeSegments.length === 0 && waypoints.length > 0) {
    throw new GpxImportError(
      'These GPX files only contain marks or waypoints. Include a tracks GPX file from your OpenCPN export.',
    )
  }

  return finalizeParsedGpx({
    metadataName,
    waypoints,
    trackSegments,
    routeSegments,
  })
}

export function parseAndMergeGpx(files: GpxImportFile[]): ParsedGpxTrack {
  if (files.length === 0) {
    throw new GpxImportError('No GPX files were provided.')
  }
  if (files.length === 1) {
    return parseGpx(files[0]!.gpxXml)
  }
  return mergeGpxRawDocuments(files.map((file) => parseGpxRaw(file.gpxXml)))
}

export function parseGpx(xml: string): ParsedGpxTrack {
  return finalizeParsedGpx(parseGpxRaw(xml))
}

const GPX_SCALAR_MIN_SAMPLES = 2

/** Discover numeric GPX fields present on enough points to graph (excludes speed → SOG). */
export function discoverGpxScalarFieldKeys(points: GpxTrackPoint[]): string[] {
  const counts = new Map<string, number>()
  for (const point of points) {
    for (const [key, value] of Object.entries(point.extensions)) {
      if (key === 'speed') continue
      if (!Number.isFinite(value)) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= GPX_SCALAR_MIN_SAMPLES)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => key)
}

export function gpxScalarSamplesForField(
  points: GpxTrackPoint[],
  fieldKey: string,
  transform?: (value: number) => number,
): { time: string; value: number }[] {
  return points.flatMap((point) => {
    if (!point.time) return []
    const raw = point.extensions[fieldKey]
    if (raw == null || !Number.isFinite(raw)) return []
    const value = transform ? transform(raw) : raw
    if (!Number.isFinite(value)) return []
    return [{ time: point.time, value }]
  })
}

export function nearestTrackPointTime(
  points: GpxTrackPoint[],
  latitude: number,
  longitude: number,
): string | null {
  if (points.length === 0) return null

  let nearest = points[0]!
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const point of points) {
    const dLat = point.latitude - latitude
    const dLon = point.longitude - longitude
    const distance = dLat * dLat + dLon * dLon
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = point
    }
  }

  return nearest.time || null
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

export function isLikelyGpxFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.name.toLowerCase().endsWith('.gpx')) return true
  if (file.type.includes('xml')) return true
  return false
}

/** macOS/OpenCPN export folders are often named `Something.gpx` and surface as empty files. */
export function isLikelyGpxExportFolder(file: Pick<File, 'name' | 'size' | 'type'>): boolean {
  if (!file.name.toLowerCase().endsWith('.gpx')) return false
  return file.size === 0
}

export function filterGpxImportFiles(files: File[]): File[] {
  return files
    .filter((file) => file.name.toLowerCase().endsWith('.gpx'))
    .sort((left, right) => {
      const leftPath = left.webkitRelativePath || left.name
      const rightPath = right.webkitRelativePath || right.name
      return leftPath.localeCompare(rightPath)
    })
}

type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
}

export async function listGpxFilesFromDirectoryHandle(
  directory: FileSystemDirectoryHandle,
): Promise<File[]> {
  const files: File[] = []
  const entries = (directory as DirectoryHandleWithEntries).entries()
  for await (const [name, entry] of entries) {
    if (entry.kind !== 'file') continue
    if (!name.toLowerCase().endsWith('.gpx')) continue
    files.push(await (entry as FileSystemFileHandle).getFile())
  }
  return files.sort((left, right) => left.name.localeCompare(right.name))
}

export async function readGpxImportFilesFromFileList(
  files: File[],
): Promise<GpxImportFile[]> {
  const gpxFiles = filterGpxImportFiles(files)

  if (gpxFiles.length === 0) {
    if (files.some(isLikelyGpxExportFolder)) {
      throw new GpxFolderImportNeededError()
    }
    throw new GpxImportError('No GPX files were found in that selection.')
  }

  if (gpxFiles.length === 1 && isLikelyGpxExportFolder(gpxFiles[0]!)) {
    throw new GpxFolderImportNeededError()
  }

  const imported: GpxImportFile[] = []
  for (const file of gpxFiles) {
    try {
      imported.push(await readGpxImportFile(file))
    } catch (error) {
      if (
        gpxFiles.length === 1 &&
        (isLikelyGpxExportFolder(file) ||
          (error instanceof GpxImportError && file.name.toLowerCase().endsWith('.gpx')))
      ) {
        throw new GpxFolderImportNeededError()
      }
      throw error
    }
  }

  return imported
}

export async function readGpxImportFile(file: File): Promise<GpxImportFile> {
  if (isLikelyGpxExportFolder(file)) {
    throw new GpxFolderImportNeededError()
  }
  if (file.size === 0) {
    throw new GpxImportError(`"${file.name}" is empty.`)
  }
  if (!isLikelyGpxFile(file)) {
    throw new GpxImportError(
      `"${file.name}" does not look like a GPX file. Select the OpenCPN export folder, or the .gpx files inside it.`,
    )
  }

  const gpxXml = await file.text()
  if (!looksLikeGpx(gpxXml)) {
    if (file.name.toLowerCase().endsWith('.gpx')) {
      throw new GpxFolderImportNeededError()
    }
    throw new GpxImportError(
      `"${file.name}" is not valid GPX. For OpenCPN exports, select the export folder or the tracks and marks files inside it.`,
    )
  }

  return { gpxXml, fileName: file.name }
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
