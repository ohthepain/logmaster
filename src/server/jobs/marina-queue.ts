import type { MapRegionId } from '../../lib/map-regions'
import {
  getMapRegion,
  isMapRegionId,
  marinaRegionForMapRegion,
} from '../../lib/map-regions'
import { getBoss } from './boss'
import { marinaJobExpireSeconds } from './marina-job-expire'
import { BUILD_MARINAS_QUEUE } from './marinas'
import type { BuildMarinasPayload } from './marinas'

export async function enqueueMarinasBuild(
  options: {
    regionId?: MapRegionId
    dryRun?: boolean
    limitCells?: number | null
    gridStep?: number
  } = {},
) {
  const boss = await getBoss()
  const regionId = options.regionId ?? 'north-america'
  const region = getMapRegion(regionId)
  if (region.layers['osm-marinas']?.available !== true) {
    throw new Error(`Marina builds are not available for region "${regionId}"`)
  }
  const marinaRegion = marinaRegionForMapRegion(regionId)
  const payload: BuildMarinasPayload = {
    regionId,
    region: marinaRegion,
    bbox: region.bbox,
    dryRun: options.dryRun ?? false,
    gridStep: options.gridStep ?? 3,
    limitCells: options.limitCells ?? null,
    delayMs: 1000,
  }
  const singletonKey = `marinas:${regionId}:${payload.dryRun ? 'dry' : 'upload'}:${payload.limitCells ?? 'all'}`
  const id = await boss.send(BUILD_MARINAS_QUEUE, payload, {
    singletonKey,
    retryLimit: 1,
    expireInSeconds: marinaJobExpireSeconds(payload),
  })
  return id ?? singletonKey
}

/** @deprecated Use enqueueMarinasBuild({ regionId }) */
export async function enqueueNorthAmericaMarinas(
  options: {
    dryRun?: boolean
    limitCells?: number | null
    region?: 'north-america' | 'canada'
  } = {},
) {
  return enqueueMarinasBuild({
    regionId: options.region ?? 'north-america',
    dryRun: options.dryRun,
    limitCells: options.limitCells,
  })
}

export function parseMarinasRegionId(value: unknown): MapRegionId | undefined {
  if (typeof value !== 'string' || !isMapRegionId(value)) return undefined
  const region = getMapRegion(value)
  if (region.layers['osm-marinas']?.available !== true) return undefined
  return value
}
