const DRAG_THRESHOLD_PX = 8

/** Controls that should keep their own drag (map pan, media scrubbers, fields). */
const NATIVE_DRAG =
  'input, textarea, select, video, audio, .maplibregl-map, [contenteditable="true"]'

/**
 * A drag that starts on a photo, link, or log-entry button often never reaches
 * the thread scroller. Mouse and pen drags scroll it directly. A touch is left
 * to the browser first (`touch-action: pan-y`); if that does not move the
 * thread, the same drag takes over.
 */
export function attachMessageThreadDragScroll(scroller: HTMLElement) {
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let lastY = 0
  let latestY = 0
  let scrolling = false
  let probing = false
  let suppressClick = false

  const end = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return
    if (scrolling) suppressClick = true
    pointerId = null
    scrolling = false
    probing = false
    if (
      typeof scroller.hasPointerCapture === 'function' &&
      scroller.hasPointerCapture(event.pointerId)
    ) {
      scroller.releasePointerCapture(event.pointerId)
    }
  }

  const capture = (id: number) => {
    try {
      scroller.setPointerCapture(id)
    } catch {
      // Capture can fail for untrusted events; scrolling still follows the pointer.
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element) || target.closest(NATIVE_DRAG)) return
    suppressClick = false
    pointerId = event.pointerId
    startX = event.clientX
    startY = lastY = latestY = event.clientY
    scrolling = false
    probing = false
  }

  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return
    latestY = event.clientY
    const totalY = Math.abs(event.clientY - startY)
    const totalX = Math.abs(event.clientX - startX)
    if (!scrolling) {
      if (totalY < DRAG_THRESHOLD_PX || totalY <= totalX) return
      if (event.pointerType === 'touch') {
        if (probing) return
        probing = true
        const before = scroller.scrollTop
        const id = event.pointerId
        requestAnimationFrame(() => {
          probing = false
          if (pointerId !== id) return
          if (scroller.scrollTop !== before) {
            pointerId = null
            return
          }
          scrolling = true
          capture(id)
          scroller.scrollTop -= latestY - lastY
          lastY = latestY
        })
        return
      }
      scrolling = true
      capture(event.pointerId)
    }
    scroller.scrollTop -= event.clientY - lastY
    lastY = event.clientY
    event.preventDefault()
  }

  const onClick = (event: MouseEvent) => {
    if (!suppressClick) return
    suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  const onDragStart = (event: DragEvent) => {
    const target = event.target
    if (target instanceof Element && target.closest(NATIVE_DRAG)) return
    event.preventDefault()
  }

  const onTouchMove = (event: TouchEvent) => {
    if (!scrolling) return
    event.preventDefault()
  }

  scroller.addEventListener('pointerdown', onPointerDown)
  scroller.addEventListener('pointermove', onPointerMove)
  scroller.addEventListener('pointerup', end)
  scroller.addEventListener('pointercancel', end)
  scroller.addEventListener('click', onClick, true)
  scroller.addEventListener('dragstart', onDragStart)
  scroller.addEventListener('touchmove', onTouchMove, { passive: false })
  return () => {
    scroller.removeEventListener('pointerdown', onPointerDown)
    scroller.removeEventListener('pointermove', onPointerMove)
    scroller.removeEventListener('pointerup', end)
    scroller.removeEventListener('pointercancel', end)
    scroller.removeEventListener('click', onClick, true)
    scroller.removeEventListener('dragstart', onDragStart)
    scroller.removeEventListener('touchmove', onTouchMove)
  }
}
