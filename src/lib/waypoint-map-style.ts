import { SailingMapColors } from './maplibre-sailing-theme'

/** Planned route line on the map — vivid orange, distinct from sailed track cyan. */
export const ROUTE_PLANNED_LINE_COLOR = '#ffb020'

/** Planned waypoint — matches sailed track cyan (trips + mid-route waypoints). */
export const WAYPOINT_MAP_COLOR = '#7ec8e8'

/** Next / active waypoint (trips only). */
export const WAYPOINT_ACTIVE_MAP_COLOR = '#e040fb'

/** Start waypoint flag. */
export const ROUTE_START_WAYPOINT_COLOR = '#43a047'

/** Finish waypoint — checkered; color is only used in the image cache key. */
export const ROUTE_FINISH_WAYPOINT_COLOR = 'checkered'

export type WaypointMapKind = 'waypoint' | 'waypoint-active'

export function waypointMapColor(kind: WaypointMapKind): string {
  return kind === 'waypoint-active' ? WAYPOINT_ACTIVE_MAP_COLOR : WAYPOINT_MAP_COLOR
}

export function isWaypointMapKind(kind: string): kind is WaypointMapKind {
  return kind === 'waypoint' || kind === 'waypoint-active'
}

/** Square outline with centred cross — distinct from circular log entries. */
function drawWaypointSquareFrame(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
) {
  const inset = 11
  const squareSize = size - inset * 2
  const x = inset
  const y = inset

  ctx.fillStyle = SailingMapColors.entryFill
  ctx.fillRect(x, y, squareSize, squareSize)

  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineJoin = 'miter'
  ctx.strokeRect(x + 2, y + 2, squareSize - 4, squareSize - 4)

  return { x, y, squareSize, center: size / 2 }
}

export function drawWaypointSquareCross(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
) {
  const { squareSize, center } = drawWaypointSquareFrame(ctx, size, color)

  const crossHalf = squareSize * 0.26
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(center - crossHalf, center)
  ctx.lineTo(center + crossHalf, center)
  ctx.moveTo(center, center - crossHalf)
  ctx.lineTo(center, center + crossHalf)
  ctx.lineWidth = 3
  ctx.lineCap = 'square'
  ctx.stroke()
}

/** Start waypoint — square frame with a small flag inside. */
export function drawRouteStartFlag(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string = ROUTE_START_WAYPOINT_COLOR,
) {
  const { squareSize, center } = drawWaypointSquareFrame(ctx, size, color)

  const poleX = center - squareSize * 0.14
  const poleTop = center - squareSize * 0.22
  const poleBottom = center + squareSize * 0.22

  ctx.strokeStyle = '#37474f'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(poleX, poleTop)
  ctx.lineTo(poleX, poleBottom)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(poleX, poleTop)
  ctx.lineTo(poleX + squareSize * 0.22, poleTop + squareSize * 0.08)
  ctx.lineTo(poleX, poleTop + squareSize * 0.16)
  ctx.closePath()
  ctx.fill()
}

/** Finish waypoint — square frame with a checkered band inside. */
export function drawRouteFinishLine(ctx: CanvasRenderingContext2D, size: number) {
  const frameColor = '#37474f'
  const { squareSize, center } = drawWaypointSquareFrame(ctx, size, frameColor)

  const bandWidth = squareSize * 0.62
  const bandHeight = squareSize * 0.24
  const left = center - bandWidth / 2
  const top = center - bandHeight / 2
  const cols = 6
  const rows = 2
  const cellW = bandWidth / cols
  const cellH = bandHeight / rows

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const isDark = (row + col) % 2 === 0
      ctx.fillStyle = isDark ? '#212121' : '#fafafa'
      ctx.fillRect(left + col * cellW, top + row * cellH, cellW + 0.5, cellH + 0.5)
    }
  }

  ctx.strokeStyle = '#212121'
  ctx.lineWidth = 1.5
  ctx.strokeRect(left, top, bandWidth, bandHeight)
}
