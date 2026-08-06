import { mapBrandColor } from './logbook-map-geo'

export function createCurrentPositionMarkerElement(options?: { devDraggable?: boolean }) {
  const el = document.createElement('div')
  el.style.position = 'relative'
  el.style.width = '28px'
  el.style.height = '28px'
  el.style.cursor = options?.devDraggable ? 'grab' : 'default'

  const halo = document.createElement('div')
  halo.style.position = 'absolute'
  halo.style.inset = '0'
  halo.style.borderRadius = '9999px'
  halo.style.background = mapBrandColor()
  halo.style.opacity = '0.22'

  const dot = document.createElement('div')
  dot.style.position = 'absolute'
  dot.style.left = '50%'
  dot.style.top = '50%'
  dot.style.width = '12px'
  dot.style.height = '12px'
  dot.style.borderRadius = '9999px'
  dot.style.background = mapBrandColor()
  dot.style.border = '2px solid white'
  dot.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'
  dot.style.transform = 'translate(-50%, -50%)'

  if (options?.devDraggable) {
    el.style.outline = '2px dashed rgba(255,255,255,0.85)'
    el.style.outlineOffset = '2px'
    el.style.borderRadius = '9999px'
  }

  el.append(halo, dot)
  return el
}
