import type { Feature, FeatureCollection, Point } from 'geojson'

export type MarinaOsmType = 'node' | 'way' | 'relation'

export type MarinaProperties = {
  id: string
  osmType: MarinaOsmType
  osmId: number
  name: string | null
  tags: Record<string, string>
  sources: ['osm']
}

export type MarinaFeature = Feature<Point, MarinaProperties>
export type MarinaFeatureCollection = FeatureCollection<Point, MarinaProperties>

export function marinaFeatureCollection(
  features: MarinaFeature[],
): MarinaFeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  }
}

export function mergeMarinaFeatures(features: MarinaFeature[]): MarinaFeature[] {
  const merged = new Map<string, MarinaFeature>()
  for (const feature of features) {
    merged.set(feature.properties.id, feature)
  }
  return Array.from(merged.values()).sort((a, b) => {
    const nameA = a.properties.name ?? a.properties.id
    const nameB = b.properties.name ?? b.properties.id
    return nameA.localeCompare(nameB)
  })
}
