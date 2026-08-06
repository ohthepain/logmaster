import { getBoss } from './boss'
import { BUILD_OSM_POINTS_QUEUE } from './osm-points'
import type { BuildOsmPointsPayload } from './osm-points'
import { marinaRegionForMapRegion } from '../../lib/map-regions'
import type { MapRegionId } from '../../lib/map-regions'
import type { OsmPointDatasetId } from '../../lib/map-data-layers'

export async function enqueueOsmPointsBuild(
  dataset: OsmPointDatasetId,
  options: {
    dryRun?: boolean
    limitCells?: number | null
    regionId?: MapRegionId
  } = {},
) {
  const boss = await getBoss()
  const regionId = options.regionId ?? 'uk'
  const region = marinaRegionForMapRegion(regionId)
  const payload: BuildOsmPointsPayload = {
    dataset,
    region,
    dryRun: options.dryRun ?? false,
    gridStep: 3,
    limitCells: options.limitCells ?? null,
    delayMs: 1000,
  }
  const singletonKey = `osm_points:${dataset}:${regionId}:${payload.dryRun ? 'dry' : 'upload'}:${payload.limitCells ?? 'all'}`
  const id = await boss.send(BUILD_OSM_POINTS_QUEUE, payload, {
    singletonKey,
    retryLimit: 1,
  })
  return id ?? singletonKey
}
