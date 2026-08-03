import type { FeatureCollection, Point } from 'geojson'
import { getAppOrigin } from './app-origin'
import type { DegreeTile } from './geo-feature-tiles'

export type MarinaProperties = {
  id: string
  osmType: 'node' | 'way' | 'relation'
  osmId: number
  name: string | null
  tags: Record<string, string>
  sources: ['osm']
}

export type MarinaFeatureCollection = FeatureCollection<Point, MarinaProperties>

export function appMarinaTileUrl(tile: Pick<DegreeTile, 'prefix'>): string {
  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  return `${base}/api/marinas/${tile.prefix}/v1/tiles/marinas.json.gz`
}
