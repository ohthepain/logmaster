import { bottomSheetPeekHeight, measureSafeAreaInsetBottom } from '../safe-area'

export type MapPassThroughZone = {
  x: number
  y: number
  width: number
  height: number
}

const MIN_SIZE = 1
const ZONE_PADDING_PX = 12
const MAP_CONTROL_EDGE_PX = 80

const MAP_TOUCH_ZONE_SELECTOR = [
  '[data-map-touch-zone]',
  '[data-trip-operational-controls]',
].join(', ')

function inflateRect(rect: DOMRect, padding = ZONE_PADDING_PX): MapPassThroughZone {
  const x = Math.max(0, rect.left - padding)
  const y = Math.max(0, rect.top - padding)
  const width = Math.min(window.innerWidth - x, rect.width + padding * 2)
  const height = Math.min(window.innerHeight - y, rect.height + padding * 2)
  return { x, y, width, height }
}

function pushZone(zones: MapPassThroughZone[], rect: DOMRect) {
  if (rect.width >= MIN_SIZE && rect.height >= MIN_SIZE) {
    zones.push(inflateRect(rect))
  }
}

export function hasBlockingMapOverlay() {
  return document.querySelector('[data-blocking-overlay]') != null
}

/** Web UI regions that must stay above the native map gesture layer. */
export function readMapPassThroughZones(): MapPassThroughZone[] {
  if (hasBlockingMapOverlay()) {
    return [
      {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      },
    ]
  }

  const zones: MapPassThroughZone[] = []

  const header = document.querySelector('header')
  if (header) {
    const rect = header.getBoundingClientRect()
    const menu = document.querySelector('[role="menu"][aria-label="Account"]')
    const menuBottom = menu?.getBoundingClientRect().bottom ?? rect.bottom + 16
    zones.push({
      x: rect.left,
      y: rect.top,
      width: Math.max(MIN_SIZE, rect.width),
      height: Math.max(MIN_SIZE, Math.max(rect.height + 240, menuBottom - rect.top)),
    })
  }

  const viewportH = window.innerHeight
  const safeAreaBottom = measureSafeAreaInsetBottom()

  const sheet = document.querySelector('[data-trip-bottom-sheet]')
  if (sheet) {
    const rect = sheet.getBoundingClientRect()
    if (rect.height >= MIN_SIZE && rect.width >= MIN_SIZE) {
      pushZone(zones, rect)
    } else {
      const peek = bottomSheetPeekHeight(viewportH, safeAreaBottom)
      zones.push({
        x: 0,
        y: viewportH - peek,
        width: window.innerWidth,
        height: peek + ZONE_PADDING_PX,
      })
    }
  } else {
    const peek = bottomSheetPeekHeight(viewportH, safeAreaBottom)
    zones.push({
      x: 0,
      y: viewportH - peek,
      width: window.innerWidth,
      height: peek + ZONE_PADDING_PX,
    })
  }

  for (const node of document.querySelectorAll(MAP_TOUCH_ZONE_SELECTOR)) {
    if (node === sheet) continue
    pushZone(zones, node.getBoundingClientRect())
  }

  pushFallbackChromeZones(zones, viewportH)

  return zones
}

function pushFallbackChromeZones(zones: MapPassThroughZone[], viewportH: number) {
  zones.push({
    x: 0,
    y: 0,
    width: MAP_CONTROL_EDGE_PX,
    height: viewportH,
  })
  zones.push({
    x: Math.max(0, window.innerWidth - MAP_CONTROL_EDGE_PX),
    y: 0,
    width: MAP_CONTROL_EDGE_PX,
    height: viewportH,
  })
  zones.push({
    x: 0,
    y: Math.round(viewportH * 0.45),
    width: window.innerWidth,
    height: Math.round(viewportH * 0.55),
  })
}
