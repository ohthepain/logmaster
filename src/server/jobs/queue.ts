import { EUROPE_GEO_FEATURE_BBOX } from '../geo-features/build'
import { getBoss } from './boss'
import { BUILD_GEO_FEATURES_QUEUE } from './geo-features'
import type { BuildGeoFeaturesPayload } from './geo-features'

export async function enqueueEuropeGeoFeatures(
  options: { dryRun?: boolean } = {},
) {
  const boss = await getBoss()
  const payload: BuildGeoFeaturesPayload = {
    bbox: EUROPE_GEO_FEATURE_BBOX,
    dryRun: options.dryRun ?? false,
    sources: { geonames: true, naturalearth: false },
  }
  const singletonKey = `geo_features:geonames:europe:${payload.dryRun ? 'dry' : 'upload'}`
  const id = await boss.send(BUILD_GEO_FEATURES_QUEUE, payload, {
    singletonKey,
    retryLimit: 1,
  })
  return id ?? singletonKey
}
