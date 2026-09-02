import type { Leg } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { decodeTripTrack, isPositionTrack } from '../domain/trip-track'
import { generateLegColor, resolveLegColor } from './leg-colors'
import type { MapLngLat } from './logbook-map-geo'

function legColorLookup(legs: Leg[]): Map<string, string> {
  return new Map(
    legs.map((leg) => [leg.id, resolveLegColor(leg.color, leg.sequence)]),
  )
}

function colorForLegId(
  legId: string | null,
  legColors: Map<string, string>,
  fallbackSequence: number,
): string {
  if (legId && legColors.has(legId)) {
    return legColors.get(legId)!
  }
  return generateLegColor(fallbackSequence)
}

export function buildTripTracksGeoJson(tracks: TripTrack[], legs: Leg[] = []) {
  const legColors = legColorLookup(legs)

  const features = tracks.filter(isPositionTrack).flatMap((track, trackIndex) => {
    const samples = decodeTripTrack(track)
    if (samples.length < 2) return []

    return [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: samples.map(
            (sample) =>
              [sample.longitude, sample.latitude] as [number, number],
          ),
        },
        properties: {
          trackId: track.id,
          legId: track.legId ?? null,
          source: track.source,
          color: colorForLegId(track.legId ?? null, legColors, trackIndex),
        },
      },
    ]
  })

  return { type: 'FeatureCollection' as const, features }
}

export function trackSampleMapPoints(tracks: TripTrack[]): MapLngLat[] {
  return tracks.filter(isPositionTrack).flatMap((track) =>
    decodeTripTrack(track).map((sample) => ({
      longitude: sample.longitude,
      latitude: sample.latitude,
    })),
  )
}
