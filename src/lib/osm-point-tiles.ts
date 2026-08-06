import { getAppOrigin } from './app-origin'
import type { DegreeTile } from './geo-feature-tiles'
import type { OsmPointDatasetId } from './map-data-layers'
import { OSM_POINT_DATASETS } from './map-data-layers'

export type OsmPointProperties = {
  id: string
  osmType: 'node' | 'way' | 'relation'
  osmId: number
  name: string | null
  kind: string
  tags: Record<string, string>
  sources: ['osm']
}

export function appOsmPointTileUrl(
  dataset: OsmPointDatasetId,
  tile: Pick<DegreeTile, 'prefix'>,
): string {
  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  const meta = OSM_POINT_DATASETS[dataset]
  if (dataset === 'marinas') {
    return `${base}/api/marinas/${tile.prefix}/v1/tiles/${meta.tileFile}`
  }
  return `${base}/api/osm-points/${dataset}/${tile.prefix}/v1/tiles/${meta.tileFile}`
}
