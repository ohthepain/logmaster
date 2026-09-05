import type { LogEntry, LogEntryType, WeatherSnapshot } from '../domain/logbook'
import { LOG_ENTRY_TYPES } from '../domain/logbook'
import type { SignalKDelta } from './signalk-export'
import { isTripWaypointEntry } from './trip-waypoint-entry'

export const SIGNALK_LOG_ENTRY_PATH = 'logmaster.logEntry'
export const SIGNALK_WAYPOINTS_PATH = 'navigation.course.waypoints'

const EXPORT_SOURCE_LABEL = 'logmaster'

export type SignalKLogEntryExport = {
  type: LogEntryType
  timestamp: string
  latitude?: number | null
  longitude?: number | null
  heading?: number | null
  notes?: string | null
  data?: Record<string, unknown> | null
  weather?: WeatherSnapshot | null
}

export type SignalKWaypointExport = {
  name: string
  description?: string | null
  latitude: number
  longitude: number
  timestamp?: string | null
  symbol?: string | null
}

const LOG_ENTRY_TYPE_SET = new Set<string>(LOG_ENTRY_TYPES)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseLogEntryType(value: unknown): LogEntryType | null {
  if (typeof value !== 'string') return null
  return LOG_ENTRY_TYPE_SET.has(value) ? (value as LogEntryType) : null
}

export function serializeLogEntryForSignalK(entry: LogEntry): SignalKLogEntryExport | null {
  if (entry.deleted) return null
  return {
    type: entry.type,
    timestamp: entry.timestamp,
    latitude: entry.latitude ?? null,
    longitude: entry.longitude ?? null,
    heading: entry.heading ?? null,
    notes: entry.notes ?? null,
    data: entry.data ?? null,
    weather: entry.weather ?? null,
  }
}

export function exportableLogEntries(entries: LogEntry[]): SignalKLogEntryExport[] {
  return entries
    .flatMap((entry) => {
      const serialized = serializeLogEntryForSignalK(entry)
      return serialized ? [serialized] : []
    })
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
}

export function waypointFromLogEntry(entry: LogEntry): SignalKWaypointExport | null {
  if (entry.deleted) return null
  if (entry.latitude == null || entry.longitude == null) return null

  const data = entry.data
  const place = isRecord(data?.place) ? data.place : null
  const isWaypoint = isTripWaypointEntry(data) || place != null

  if (!isWaypoint && entry.type !== 'NOTE') return null
  if (!isWaypoint) return null

  const placeName = typeof place?.name === 'string' ? place.name.trim() : ''
  const name = placeName || entry.notes?.trim() || 'Waypoint'

  return {
    name,
    description: entry.notes?.trim() || null,
    latitude: entry.latitude,
    longitude: entry.longitude,
    timestamp: entry.timestamp,
    symbol: typeof data?.gpxSymbol === 'string' ? data.gpxSymbol : null,
  }
}

export function collectWaypointsFromEntries(entries: LogEntry[]): SignalKWaypointExport[] {
  const seen = new Set<string>()
  const waypoints: SignalKWaypointExport[] = []

  for (const entry of entries) {
    const waypoint = waypointFromLogEntry(entry)
    if (!waypoint) continue
    const key = `${waypoint.name}:${waypoint.latitude.toFixed(5)}:${waypoint.longitude.toFixed(5)}`
    if (seen.has(key)) continue
    seen.add(key)
    waypoints.push(waypoint)
  }

  return waypoints.sort(
    (left, right) =>
      Date.parse(left.timestamp ?? '') - Date.parse(right.timestamp ?? ''),
  )
}

export function logEntryExportToDelta(entry: SignalKLogEntryExport): SignalKDelta {
  return {
    context: 'vessels.self',
    updates: [
      {
        source: { label: EXPORT_SOURCE_LABEL },
        timestamp: entry.timestamp,
        values: [{ path: SIGNALK_LOG_ENTRY_PATH, value: entry }],
      },
    ],
  }
}

export function waypointsToSignalKValue(
  waypoints: SignalKWaypointExport[],
): Array<{
  name?: string
  description?: string
  position: { latitude: number; longitude: number }
}> {
  return waypoints.map((waypoint) => ({
    name: waypoint.name,
    ...(waypoint.description ? { description: waypoint.description } : {}),
    position: {
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
    },
  }))
}

export function waypointsDelta(
  waypoints: SignalKWaypointExport[],
  timestamp: string,
): SignalKDelta | null {
  if (waypoints.length === 0) return null
  return {
    context: 'vessels.self',
    updates: [
      {
        source: { label: EXPORT_SOURCE_LABEL },
        timestamp,
        values: [
          {
            path: SIGNALK_WAYPOINTS_PATH,
            value: waypointsToSignalKValue(waypoints),
          },
        ],
      },
    ],
  }
}

export function parseSignalKLogEntryExport(value: unknown): SignalKLogEntryExport | null {
  if (!isRecord(value)) return null
  const type = parseLogEntryType(value.type)
  const timestamp =
    typeof value.timestamp === 'string' && Number.isFinite(Date.parse(value.timestamp))
      ? new Date(value.timestamp).toISOString()
      : null
  if (!type || !timestamp) return null

  return {
    type,
    timestamp,
    latitude: typeof value.latitude === 'number' ? value.latitude : null,
    longitude: typeof value.longitude === 'number' ? value.longitude : null,
    heading: typeof value.heading === 'number' ? value.heading : null,
    notes: typeof value.notes === 'string' ? value.notes : null,
    data: isRecord(value.data) ? value.data : null,
    weather: isRecord(value.weather) ? (value.weather as WeatherSnapshot) : null,
  }
}

export function parseSignalKWaypointExport(value: unknown): SignalKWaypointExport | null {
  if (!isRecord(value)) return null

  let latitude: number | null =
    typeof value.latitude === 'number' ? value.latitude : null
  let longitude: number | null =
    typeof value.longitude === 'number' ? value.longitude : null

  const position = value.position
  if (isRecord(position)) {
    latitude = typeof position.latitude === 'number' ? position.latitude : latitude
    longitude = typeof position.longitude === 'number' ? position.longitude : longitude
  }

  if (latitude == null || longitude == null) return null

  const name =
    (typeof value.name === 'string' && value.name.trim()) ||
    (typeof value.description === 'string' && value.description.trim()) ||
    'Waypoint'

  const timestamp =
    typeof value.timestamp === 'string' && Number.isFinite(Date.parse(value.timestamp))
      ? new Date(value.timestamp).toISOString()
      : null

  return {
    name,
    description:
      typeof value.description === 'string' ? value.description.trim() || null : null,
    latitude,
    longitude,
    timestamp,
    symbol: typeof value.symbol === 'string' ? value.symbol : null,
  }
}

export function parseSignalKWaypointsValue(value: unknown): SignalKWaypointExport[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const waypoint = parseSignalKWaypointExport(item)
    return waypoint ? [waypoint] : []
  })
}

export function dedupeLogEntryExports(
  entries: SignalKLogEntryExport[],
): SignalKLogEntryExport[] {
  const seen = new Set<string>()
  const deduped: SignalKLogEntryExport[] = []

  for (const entry of entries) {
    const timeMs = Date.parse(entry.timestamp)
    const key = `${entry.type}:${Number.isFinite(timeMs) ? timeMs : entry.timestamp}:${entry.latitude ?? ''}:${entry.longitude ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }

  return deduped.sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  )
}

export function dedupeWaypointExports(
  waypoints: SignalKWaypointExport[],
): SignalKWaypointExport[] {
  const seen = new Set<string>()
  const deduped: SignalKWaypointExport[] = []

  for (const waypoint of waypoints) {
    const key = `${waypoint.name}:${waypoint.latitude.toFixed(5)}:${waypoint.longitude.toFixed(5)}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(waypoint)
  }

  return deduped.sort(
    (left, right) =>
      Date.parse(left.timestamp ?? '') - Date.parse(right.timestamp ?? ''),
  )
}
