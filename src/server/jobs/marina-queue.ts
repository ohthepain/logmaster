import { getBoss } from './boss'
import { marinaJobExpireSeconds } from './marina-job-expire'
import { BUILD_MARINAS_QUEUE } from './marinas'
import type { BuildMarinasPayload } from './marinas'

export async function enqueueNorthAmericaMarinas(
  options: {
    dryRun?: boolean
    limitCells?: number | null
    region?: 'north-america' | 'canada'
  } = {},
) {
  const boss = await getBoss()
  const region = options.region ?? 'north-america'
  const payload: BuildMarinasPayload = {
    region,
    dryRun: options.dryRun ?? false,
    gridStep: 3,
    limitCells: options.limitCells ?? null,
    delayMs: 1000,
  }
  const singletonKey = `marinas:${region}:${payload.dryRun ? 'dry' : 'upload'}:${payload.limitCells ?? 'all'}`
  const id = await boss.send(BUILD_MARINAS_QUEUE, payload, {
    singletonKey,
    retryLimit: 1,
    expireInSeconds: marinaJobExpireSeconds(payload),
  })
  return id ?? singletonKey
}
