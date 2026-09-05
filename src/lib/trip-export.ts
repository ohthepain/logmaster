import type { Trip, LogEntry } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { saveTextExport, sanitizeExportFileName } from './export-file'
import { buildTripGpx } from './gpx-export'
import { buildTripSignalKExport } from './signalk-export'
import { tripDisplayName } from './trip-display'

export async function exportTripAsGpx(trip: Trip, tracks: TripTrack[]): Promise<void> {
  const gpx = buildTripGpx(trip, tracks)
  const fileName = sanitizeExportFileName(tripDisplayName(trip), 'gpx')
  await saveTextExport(fileName, gpx, 'application/gpx+xml')
}

export async function exportTripAsSignalK(
  trip: Trip,
  tracks: TripTrack[],
  entries: LogEntry[] = [],
): Promise<void> {
  const json = buildTripSignalKExport(trip, tracks, entries)
  const fileName = sanitizeExportFileName(`${tripDisplayName(trip)} signalk`, 'json')
  await saveTextExport(fileName, json, 'application/json')
}
