import type maplibregl from 'maplibre-gl'

function isGeoJsonSource(
  source: maplibregl.Source,
): source is maplibregl.GeoJSONSource {
  return source.type === 'geojson'
}

export function getGeoJsonSource(
  map: maplibregl.Map,
  id: string,
): maplibregl.GeoJSONSource | undefined {
  const source = map.getSource(id)
  if (!source || !isGeoJsonSource(source)) return undefined
  return source
}
