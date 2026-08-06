import type { MapRegionId } from '../../lib/map-regions'
import { getMapRegion, isMapRegionId } from '../../lib/map-regions'
import type { GeoFeatureBbox } from '../geo-features/sources'
import { getBoss } from './boss'
import { BUILD_GEO_FEATURES_QUEUE } from './geo-features'
import type { BuildGeoFeaturesPayload } from './geo-features'

export async function enqueueGeoFeaturesBuild(
  options: {
    regionId?: MapRegionId
    bbox?: GeoFeatureBbox
    dryRun?: boolean
  } = {},
) {
  const boss = await getBoss()
  const regionId = options.regionId ?? 'europe'
  const region = getMapRegion(regionId)
  const bbox = options.bbox ?? (region.bbox as GeoFeatureBbox)
  const payload: BuildGeoFeaturesPayload = {
    regionId,
    bbox,
    dryRun: options.dryRun ?? false,
    sources: { geonames: true, naturalearth: false },
  }
  const singletonKey = `geo_features:geonames:${regionId}:${payload.dryRun ? 'dry' : 'upload'}`
  const id = await boss.send(BUILD_GEO_FEATURES_QUEUE, payload, {
    singletonKey,
    retryLimit: 1,
  })
  return id ?? singletonKey
}

/** @deprecated Use enqueueGeoFeaturesBuild({ regionId: 'europe' }) */
export async function enqueueEuropeGeoFeatures(
  options: { dryRun?: boolean } = {},
) {
  return enqueueGeoFeaturesBuild({ regionId: 'europe', dryRun: options.dryRun })
}

export function parseGeoFeaturesRegionId(
  value: unknown,
): MapRegionId | undefined {
  if (typeof value !== 'string' || !isMapRegionId(value)) return undefined
  const region = getMapRegion(value)
  if (region.layers['geonames-cities']?.available !== true) return undefined
  return value
}
