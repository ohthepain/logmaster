import type { Trip } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { saveOrShareFile, sanitizeExportFileName } from './export-file'
import { buildTripGpx } from './gpx-export'
import { buildTripSignalKExport } from './signalk-export'
import { tripDisplayName } from './trip-display'

async function shareTextExport(
  trip: Trip,
  extension: string,
  mimeType: string,
  content: string,
): Promise<void> {
  const fileName = sanitizeExportFileName(tripDisplayName(trip), extension)
  const file = new File([content], fileName, { type: mimeType })
  await saveOrShareFile(file)
}

export async function exportTripAsGpx(trip: Trip, tracks: TripTrack[]): Promise<void> {
  const gpx = buildTripGpx(trip, tracks)
  await shareTextExport(trip, 'gpx', 'application/gpx+xml', gpx)
}

export async function exportTripAsSignalK(trip: Trip, tracks: TripTrack[]): Promise<void> {
  const json = buildTripSignalKExport(trip, tracks)
  await shareTextExport(trip, 'signalk.json', 'application/json', json)
}
