import type { Feature, FeatureCollection, Point } from 'geojson'

export type OsmPointType = 'node' | 'way' | 'relation'

export type OsmPointProperties = {
  id: string
  osmType: OsmPointType
  osmId: number
  name: string | null
  kind: string
  tags: Record<string, string>
  sources: ['osm']
  depthLabel?: string | null
}

export type OsmPointFeature = Feature<Point, OsmPointProperties>
export type OsmPointFeatureCollection = FeatureCollection<
  Point,
  OsmPointProperties
>

export function osmPointFeatureCollection(
  features: OsmPointFeature[],
): OsmPointFeatureCollection {
  return { type: 'FeatureCollection', features }
}

export function mergeOsmPointFeatures(
  features: OsmPointFeature[],
): OsmPointFeature[] {
  const merged = new Map<string, OsmPointFeature>()
  for (const feature of features) {
    merged.set(feature.properties.id, feature)
  }
  return Array.from(merged.values()).sort((a, b) => {
    const nameA = a.properties.name ?? a.properties.id
    const nameB = b.properties.name ?? b.properties.id
    return nameA.localeCompare(nameB)
  })
}
