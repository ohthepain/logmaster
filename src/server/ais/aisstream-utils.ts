import type { AisBoundingBox } from '../../domain/ais-vessel'

/** Decode AISStream WebSocket frames (UTF-8 JSON in binary or text frames). */
export async function decodeAisStreamWebSocketMessage(data: unknown): Promise<string> {
  if (typeof data === 'string') return data
  if (data instanceof Blob) return await data.text()
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
  }
  throw new Error('Unsupported AIS WebSocket message payload')
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Widen small map viewports so the AIS feed has time to report more targets. */
export function expandAisSubscriptionBbox(bbox: AisBoundingBox): AisBoundingBox {
  const latSpan = bbox.north - bbox.south
  const lonSpan = bbox.east - bbox.west
  const minSpan = 0.18
  const padLat = Math.max(latSpan * 0.15, (minSpan - latSpan) / 2, 0.015)
  const padLon = Math.max(lonSpan * 0.15, (minSpan - lonSpan) / 2, 0.015)

  return {
    north: Math.min(90, bbox.north + padLat),
    south: Math.max(-90, bbox.south - padLat),
    east: Math.min(180, bbox.east + padLon),
    west: Math.max(-180, bbox.west - padLon),
  }
}

const SUBSCRIPTION_TILE_SPAN_DEGREES = 2.5
const MAX_SUBSCRIPTION_TILES = 12

/** Split a large viewport into AISStream bounding boxes (one subscription, many tiles). */
export function splitAisSubscriptionBoxes(bbox: AisBoundingBox): AisBoundingBox[] {
  const expanded = expandAisSubscriptionBbox(bbox)
  const latSpan = expanded.north - expanded.south
  const lonSpan = expanded.east - expanded.west

  if (latSpan <= SUBSCRIPTION_TILE_SPAN_DEGREES && lonSpan <= SUBSCRIPTION_TILE_SPAN_DEGREES) {
    return [expanded]
  }

  const latSteps = Math.max(1, Math.ceil(latSpan / SUBSCRIPTION_TILE_SPAN_DEGREES))
  const lonSteps = Math.max(1, Math.ceil(lonSpan / SUBSCRIPTION_TILE_SPAN_DEGREES))
  const latStep = latSpan / latSteps
  const lonStep = lonSpan / lonSteps
  const boxes: AisBoundingBox[] = []

  for (let latIndex = 0; latIndex < latSteps; latIndex += 1) {
    for (let lonIndex = 0; lonIndex < lonSteps; lonIndex += 1) {
      if (boxes.length >= MAX_SUBSCRIPTION_TILES) return boxes
      boxes.push({
        south: expanded.south + latIndex * latStep,
        north: expanded.south + (latIndex + 1) * latStep,
        west: expanded.west + lonIndex * lonStep,
        east: expanded.west + (lonIndex + 1) * lonStep,
      })
    }
  }

  return boxes.length > 0 ? boxes : [expanded]
}

export function aisStreamBoxesFromBboxes(boxes: AisBoundingBox[]) {
  return boxes.map((bbox) => [
    [bbox.north, bbox.west],
    [bbox.south, bbox.east],
  ])
}

export function accumulationWaitForBbox(bbox: AisBoundingBox) {
  const latSpan = bbox.north - bbox.south
  const lonSpan = bbox.east - bbox.west
  const area = latSpan * lonSpan
  if (area > 25) {
    return { timeoutMs: 12_000, settleMs: 2500 }
  }
  if (area > 9) {
    return { timeoutMs: 10_000, settleMs: 2200 }
  }
  return { timeoutMs: 8000, settleMs: 2000 }
}

/**
 * Wait for AIS reports to accumulate instead of returning after the first vessel.
 * AIS position reports are broadcast periodically — dense areas need a few seconds.
 */
export async function waitForAisVesselAccumulation(
  bbox: AisBoundingBox,
  read: (bbox: AisBoundingBox) => number,
  options?: { timeoutMs?: number; pollMs?: number; settleMs?: number },
): Promise<number> {
  const defaults = accumulationWaitForBbox(bbox)
  const timeoutMs = options?.timeoutMs ?? defaults.timeoutMs
  const pollMs = options?.pollMs ?? 250
  const settleMs = options?.settleMs ?? defaults.settleMs
  const deadline = Date.now() + timeoutMs
  let lastCount = 0
  let lastIncreaseAt = Date.now()

  while (Date.now() < deadline) {
    const count = read(bbox)
    if (count > lastCount) {
      lastCount = count
      lastIncreaseAt = Date.now()
    } else if (count > 0 && Date.now() - lastIncreaseAt >= settleMs) {
      return count
    }
    await sleep(pollMs)
  }

  return read(bbox)
}

/** @deprecated Use {@link waitForAisVesselAccumulation}. */
export async function waitForAisVesselsInBbox(
  bbox: AisBoundingBox,
  read: (bbox: AisBoundingBox) => number,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<number> {
  return waitForAisVesselAccumulation(bbox, read, {
    timeoutMs: options?.timeoutMs,
    pollMs: options?.pollMs,
  })
}
