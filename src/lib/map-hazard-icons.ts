import type maplibregl from 'maplibre-gl'

export const HAZARD_WRECK_ICON = 'hazard-wreck'
export const HAZARD_RESTRICTED_ICON = 'hazard-restricted'
export const HAZARD_NOTICE_ICON = 'hazard-notice'
export const HAZARD_OTHER_ICON = 'hazard-other'

const HAZARD_ICON_IDS = [
  HAZARD_WRECK_ICON,
  HAZARD_RESTRICTED_ICON,
  HAZARD_NOTICE_ICON,
  HAZARD_OTHER_ICON,
] as const

const ICON_SIZE = 48

function drawBadgeCircle(ctx: CanvasRenderingContext2D, fill: string) {
  const radius = ICON_SIZE / 2
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(radius, radius, radius - 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 3
  ctx.stroke()
}

function createHazardIconImage(
  draw: (ctx: CanvasRenderingContext2D) => void,
): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create hazard icon canvas')
  draw(ctx)
  return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE)
}

function drawWreckIcon(ctx: CanvasRenderingContext2D) {
  drawBadgeCircle(ctx, '#dc2626')
  const center = ICON_SIZE / 2
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.arc(center, center - 8, 5, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(center, center - 3)
  ctx.lineTo(center, center + 10)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(center - 10, center + 2)
  ctx.lineTo(center + 10, center + 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(center - 10, center + 2)
  ctx.lineTo(center - 12, center + 11)
  ctx.moveTo(center + 10, center + 2)
  ctx.lineTo(center + 12, center + 11)
  ctx.stroke()
}

function drawRestrictedIcon(ctx: CanvasRenderingContext2D) {
  const center = ICON_SIZE / 2
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.moveTo(center, 6)
  ctx.lineTo(ICON_SIZE - 6, ICON_SIZE - 6)
  ctx.lineTo(6, ICON_SIZE - 6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('!', center, center + 4)
}

function drawNoticeIcon(ctx: CanvasRenderingContext2D) {
  drawBadgeCircle(ctx, '#2563eb')
  const center = ICON_SIZE / 2
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('i', center, center + 1)
}

function drawOtherHazardIcon(ctx: CanvasRenderingContext2D) {
  drawBadgeCircle(ctx, '#64748b')
  const center = ICON_SIZE / 2
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(center, center, 5, 0, Math.PI * 2)
  ctx.fill()
}

const HAZARD_ICON_BUILDERS: Record<(typeof HAZARD_ICON_IDS)[number], () => ImageData> = {
  [HAZARD_WRECK_ICON]: () => createHazardIconImage(drawWreckIcon),
  [HAZARD_RESTRICTED_ICON]: () => createHazardIconImage(drawRestrictedIcon),
  [HAZARD_NOTICE_ICON]: () => createHazardIconImage(drawNoticeIcon),
  [HAZARD_OTHER_ICON]: () => createHazardIconImage(drawOtherHazardIcon),
}

export function hazardIconForKind(kind: string | null | undefined): string {
  if (kind === 'wreck') return HAZARD_WRECK_ICON
  if (kind === 'restricted') return HAZARD_RESTRICTED_ICON
  if (kind === 'notice') return HAZARD_NOTICE_ICON
  return HAZARD_OTHER_ICON
}

export function hazardIconImageExpression(): maplibregl.ExpressionSpecification {
  return [
    'match',
    ['get', 'kind'],
    'wreck',
    HAZARD_WRECK_ICON,
    'restricted',
    HAZARD_RESTRICTED_ICON,
    'notice',
    HAZARD_NOTICE_ICON,
    HAZARD_OTHER_ICON,
  ]
}

export function hazardIconSizeExpression(): maplibregl.ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 8, 0.65, 12, 0.85, 16, 1]
}

export function installMapHazardIcons(map: maplibregl.Map) {
  for (const iconId of HAZARD_ICON_IDS) {
    if (map.hasImage(iconId)) continue
    map.addImage(iconId, HAZARD_ICON_BUILDERS[iconId](), { pixelRatio: 2 })
  }
}
