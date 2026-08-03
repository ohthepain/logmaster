import {
  CANADA_MARINA_BBOX,
  NORTH_AMERICA_MARINA_BBOX,
} from '../marinas/bboxes'
import { gridCellsForBbox } from '../marinas/grid'
import type { BuildMarinasPayload } from './marinas'

/** pg-boss default — too short for full marina grid builds. */
export const MARINA_QUEUE_EXPIRE_SECONDS = 8 * 60 * 60

/** pg-boss v12 rejects expireInSeconds when hours >= 24 (strict `<`). */
export const PG_BOSS_MAX_EXPIRE_SECONDS = 24 * 60 * 60 - 1

/** ~90s per cell including delay, with headroom. Capped below pg-boss 24h limit. */
export function marinaJobExpireSeconds(payload: BuildMarinasPayload): number {
  const bbox =
    payload.bbox ??
    (payload.region === 'canada'
      ? CANADA_MARINA_BBOX
      : NORTH_AMERICA_MARINA_BBOX)
  const gridStep = payload.gridStep ?? 3
  const totalCells = gridCellsForBbox(bbox, gridStep).length
  const cells = payload.limitCells ?? totalCells
  const estimated = Math.ceil(cells * 90 * 1.5)
  return Math.min(
    PG_BOSS_MAX_EXPIRE_SECONDS,
    Math.max(MARINA_QUEUE_EXPIRE_SECONDS, estimated),
  )
}
