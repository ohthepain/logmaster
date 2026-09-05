import type maplibregl from 'maplibre-gl'

export const MAP_COVER_MAX_WIDTH = 960
export const MAP_COVER_JPEG_QUALITY = 0.82
export const MAP_COVER_CAPTURE_TIMEOUT_MS = 3000

export async function downscaleJpegDataUrl(
  dataUrl: string,
  maxWidth = MAP_COVER_MAX_WIDTH,
): Promise<string> {
  if (typeof document === 'undefined') return dataUrl

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(image.width, 1))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(dataUrl)
        return
      }
      context.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', MAP_COVER_JPEG_QUALITY))
    }
    image.onerror = () => reject(new Error('Could not process map image'))
    image.src = dataUrl
  })
}

async function waitForNextPaint(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    return
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 16))
}

/** Reject empty or all-black JPEG captures (common without preserveDrawingBuffer). */
export async function isBlankMapSnapshot(dataUrl: string | null): Promise<boolean> {
  if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 120) return true
  if (typeof document === 'undefined') return false

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(false)
        return
      }
      context.drawImage(image, 0, 0, 32, 32)
      const pixels = context.getImageData(0, 0, 32, 32).data
      let luminanceSum = 0
      for (let index = 0; index < pixels.length; index += 4) {
        luminanceSum += pixels[index]! + pixels[index + 1]! + pixels[index + 2]!
      }
      const averageLuminance = luminanceSum / (pixels.length / 4) / 3
      resolve(averageLuminance < 8)
    }
    image.onerror = () => resolve(true)
    image.src = dataUrl
  })
}

/** Wait for a render frame; bounded so capture never hangs if `idle` does not re-fire. */
export async function waitForMaplibreIdle(
  map: maplibregl.Map,
  timeoutMs = MAP_COVER_CAPTURE_TIMEOUT_MS,
): Promise<void> {
  if (!map.loaded()) {
    await Promise.race([
      new Promise<void>((resolve) => map.once('load', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ])
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      const finish = () => resolve()
      if (map.isMoving()) {
        map.once('moveend', () => map.once('idle', finish))
        return
      }
      // If the map is already idle, `idle` may not fire again until something changes.
      map.once('idle', finish)
      map.triggerRepaint()
    }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ])

  await waitForNextPaint()
}

export async function captureMaplibreSnapshot(map: maplibregl.Map): Promise<string | null> {
  if (!map.loaded()) return null

  await waitForMaplibreIdle(map)

  try {
    const raw = map.getCanvas().toDataURL('image/jpeg', MAP_COVER_JPEG_QUALITY)
    if (!raw || raw === 'data:,') return null
    if (await isBlankMapSnapshot(raw)) return null
    return downscaleJpegDataUrl(raw)
  } catch {
    return null
  }
}

export function withCaptureTimeout<T>(
  promise: Promise<T>,
  timeoutMs = MAP_COVER_CAPTURE_TIMEOUT_MS,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}
