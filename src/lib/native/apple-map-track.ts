import type { MapCoordinate } from 'logmaster-apple-map'

/** Keep each GeoJSON path separate so MapKit cannot connect unrelated ends. */
export function appleMapTrackOverlays(collection: GeoJSON.FeatureCollection) {
  const trackSegments: MapCoordinate[][] = collection.features.flatMap(
    (feature) => {
      if (feature.geometry?.type !== 'LineString') return []
      const coordinates = feature.geometry.coordinates
      // Reject a malformed path rather than joining across invalid positions.
      if (
        coordinates.length < 2 ||
        coordinates.some(
          ([longitude, latitude]) =>
            !Number.isFinite(longitude) || !Number.isFinite(latitude),
        )
      )
        return []
      return [
        coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
      ]
    },
  )
  return {
    trackSegments,
    // Installed older iOS builds still require this field. Updated builds
    // prefer trackSegments; the segment fix takes effect with the app update.
    track: trackSegments.flat(),
  }
}
