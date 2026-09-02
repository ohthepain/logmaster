import type { Trip } from '../domain/logbook'
import type { PositionTrackSample, TripTrack } from '../domain/trip-track'
import { decodeTripTrack, positionTracksForTrip } from '../domain/trip-track'
import { tripDisplayName } from './trip-display'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatGpxPoint(sample: PositionTrackSample): string {
  const lines = [
    `      <trkpt lat="${sample.latitude.toFixed(7)}" lon="${sample.longitude.toFixed(7)}">`,
    `        <time>${sample.time}</time>`,
  ]
  if (sample.elevationM != null && Number.isFinite(sample.elevationM)) {
    lines.push(`        <ele>${sample.elevationM.toFixed(2)}</ele>`)
  }
  if (sample.heading != null && Number.isFinite(sample.heading)) {
    lines.push(`        <course>${Math.round(sample.heading)}</course>`)
  }
  lines.push('      </trkpt>')
  return lines.join('\n')
}

export function positionSamplesForTripExport(
  tripId: string,
  tracks: TripTrack[],
): PositionTrackSample[] {
  return positionTracksForTrip(tripId, tracks)
    .flatMap((track) => decodeTripTrack(track))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
}

export function buildTripGpx(trip: Trip, tracks: TripTrack[]): string {
  const samples = positionSamplesForTripExport(trip.id, tracks)
  if (samples.length === 0) {
    throw new Error('This trip has no track points to export.')
  }

  const name = tripDisplayName(trip)
  const startedAt = samples[0]?.time ?? trip.startedAt

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="logmaster" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${startedAt}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${samples.map(formatGpxPoint).join('\n')}
    </trkseg>
  </trk>
</gpx>
`
}
