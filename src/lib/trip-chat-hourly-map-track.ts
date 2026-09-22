import type { LogEntry } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { decodeTripTrack, isPositionTrack } from '../domain/trip-track'
import {
  entryHasMapPosition,
  sortLogEntriesChronologically,
} from './logbook-entry-order'

export type TripChatTrackCoordinate = [number, number]

function validTimeMs(value: string): number | null {
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function sameCoordinate(
  a: TripChatTrackCoordinate,
  b: TripChatTrackCoordinate,
): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

function coordinatesFromPositionTracks(
  tracks: TripTrack[],
  endMs: number,
): TripChatTrackCoordinate[] {
  const coordinates: TripChatTrackCoordinate[] = []
  for (const track of tracks.filter(isPositionTrack)) {
    const samples = decodeTripTrack(track).filter((sample) => {
      const ms = validTimeMs(sample.time)
      return ms != null && ms <= endMs
    })
    for (const sample of samples) {
      const next: TripChatTrackCoordinate = [sample.longitude, sample.latitude]
      const previous = coordinates[coordinates.length - 1]
      if (!previous || !sameCoordinate(previous, next)) {
        coordinates.push(next)
      }
    }
  }
  return coordinates
}

function coordinatesFromEntries(
  entries: LogEntry[],
  endMs: number,
): TripChatTrackCoordinate[] {
  return sortLogEntriesChronologically(entries)
    .filter((entry) => {
      const ms = validTimeMs(entry.timestamp)
      return ms != null && ms <= endMs && entryHasMapPosition(entry)
    })
    .map(
      (entry) => [entry.longitude!, entry.latitude!] as TripChatTrackCoordinate,
    )
}

/** Track line for trip chat maps — geometry up to (and including) the log entry. */
export function buildTripChatTrackCoordinates(input: {
  entries: LogEntry[]
  tracks: TripTrack[]
  endTimestamp: string
  endLongitude: number
  endLatitude: number
}): TripChatTrackCoordinate[] {
  const endMs = validTimeMs(input.endTimestamp)
  if (endMs == null) {
    return [[input.endLongitude, input.endLatitude]]
  }

  const trackCoords = coordinatesFromPositionTracks(input.tracks, endMs)
  const entryCoords = coordinatesFromEntries(input.entries, endMs)
  let coordinates =
    trackCoords.length >= 2
      ? trackCoords
      : entryCoords.length >= 2
        ? entryCoords
        : trackCoords.length > 0
          ? trackCoords
          : entryCoords

  const end: TripChatTrackCoordinate = [input.endLongitude, input.endLatitude]
  const last = coordinates[coordinates.length - 1]
  if (!last || !sameCoordinate(last, end)) {
    coordinates = [...coordinates, end]
  }

  return coordinates.length > 0 ? coordinates : [end]
}
