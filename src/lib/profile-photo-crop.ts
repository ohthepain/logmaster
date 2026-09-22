export type ProfilePhotoCrop = {
  /** Left edge as a fraction of image width (0–1). */
  x: number
  /** Top edge as a fraction of image height (0–1). */
  y: number
  /** Square side length as a fraction of min(width, height) (0–1]. */
  s: number
}

const MIN_CROP_FRACTION = 0.08

export function defaultProfilePhotoCrop(
  imageWidth: number,
  imageHeight: number,
): ProfilePhotoCrop {
  const minDim = Math.min(imageWidth, imageHeight)
  const side = minDim
  return {
    x: (imageWidth - side) / 2 / imageWidth,
    y: (imageHeight - side) / 2 / imageHeight,
    s: 1,
  }
}

export function cropToPixelRect(
  crop: ProfilePhotoCrop,
  imageWidth: number,
  imageHeight: number,
) {
  const minDim = Math.min(imageWidth, imageHeight)
  const side = Math.max(1, Math.round(crop.s * minDim))
  let left = Math.round(crop.x * imageWidth)
  let top = Math.round(crop.y * imageHeight)

  left = clamp(left, 0, Math.max(0, imageWidth - side))
  top = clamp(top, 0, Math.max(0, imageHeight - side))

  const width = Math.min(side, imageWidth - left, imageHeight - top)
  const height = width

  return { left, top, width, height }
}

export function normalizeProfilePhotoCrop(
  crop: ProfilePhotoCrop,
  imageWidth: number,
  imageHeight: number,
): ProfilePhotoCrop {
  const minDim = Math.min(imageWidth, imageHeight)
  const minSide = Math.max(1, Math.round(MIN_CROP_FRACTION * minDim))
  const maxSide = minDim

  let side = clamp(Math.round(crop.s * minDim), minSide, maxSide)
  let left = Math.round(crop.x * imageWidth)
  let top = Math.round(crop.y * imageHeight)

  left = clamp(left, 0, imageWidth - side)
  top = clamp(top, 0, imageHeight - side)

  return {
    x: left / imageWidth,
    y: top / imageHeight,
    s: side / minDim,
  }
}

export function parseProfilePhotoCrop(value: unknown): ProfilePhotoCrop | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.x !== 'number' ||
    typeof row.y !== 'number' ||
    typeof row.s !== 'number'
  ) {
    return null
  }
  if (!Number.isFinite(row.x) || !Number.isFinite(row.y) || !Number.isFinite(row.s)) {
    return null
  }
  if (row.s <= 0 || row.x < 0 || row.y < 0) return null
  return { x: row.x, y: row.y, s: row.s }
}

export function moveProfilePhotoCrop(
  crop: ProfilePhotoCrop,
  imageWidth: number,
  imageHeight: number,
  deltaX: number,
  deltaY: number,
): ProfilePhotoCrop {
  const rect = cropToPixelRect(crop, imageWidth, imageHeight)
  return normalizeProfilePhotoCrop(
    {
      x: (rect.left + deltaX) / imageWidth,
      y: (rect.top + deltaY) / imageHeight,
      s: crop.s,
    },
    imageWidth,
    imageHeight,
  )
}

export function resizeProfilePhotoCrop(
  crop: ProfilePhotoCrop,
  imageWidth: number,
  imageHeight: number,
  deltaSide: number,
): ProfilePhotoCrop {
  const rect = cropToPixelRect(crop, imageWidth, imageHeight)
  const nextSide = rect.width + deltaSide
  return normalizeProfilePhotoCrop(
    {
      x: rect.left / imageWidth,
      y: rect.top / imageHeight,
      s: nextSide / Math.min(imageWidth, imageHeight),
    },
    imageWidth,
    imageHeight,
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
