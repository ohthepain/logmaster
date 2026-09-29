import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { requestIosMapTouchSync } from '../lib/native/ios-map-touch-passthrough'
import {
  APP_HEADER_INNER_HEIGHT_PX,
  BOTTOM_SHEET_DRAG_ZONE_PX,
  BOTTOM_SHEET_MIN_INSET_PX,
  bottomSheetDragChromeHeight,
  bottomSheetFullHeight,
  bottomSheetPeekHeight,
  measureAppHeaderHeight,
  measureSafeAreaInsetBottom,
} from '../lib/safe-area'
import { TRIP_MAP_OVERLAY_SURFACE_CLASS } from '../lib/trip-map-overlay'
import { DevComponentLabel } from './DevComponentLabel'

const SCROLL_DRAG_THRESHOLD_PX = 8

const SNAP_RATIOS = {
  half: 0.48,
} as const

type SnapName = 'peek' | 'half' | 'full'

function nearestSnap(
  heightPx: number,
  snaps: Record<SnapName, number>,
): number {
  const values = Object.values(snaps)
  return values.reduce((best, candidate) =>
    Math.abs(candidate - heightPx) < Math.abs(best - heightPx)
      ? candidate
      : best,
  )
}

type TripDetailBottomSheetProps = {
  children: ReactNode
  className?: string
  leadingAction?: ReactNode
}

export function TripDetailBottomSheet({
  children,
  className,
  leadingAction,
}: TripDetailBottomSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const heightRef = useRef(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(APP_HEADER_INNER_HEIGHT_PX)
  const [safeAreaBottom, setSafeAreaBottom] = useState(0)
  const [sheetHeight, setSheetHeight] = useState(0)
  const [dragging, setDragging] = useState(false)

  const dragChromeHeight = bottomSheetDragChromeHeight(safeAreaBottom)

  const snapHeights = useMemo(() => {
    if (containerHeight <= 0) return null
    const peek = bottomSheetPeekHeight(containerHeight, safeAreaBottom)
    const full = bottomSheetFullHeight(containerHeight, headerHeight, peek)
    return {
      peek,
      half: Math.min(full, Math.round(containerHeight * SNAP_RATIOS.half)),
      full,
    }
  }, [containerHeight, headerHeight, safeAreaBottom])

  useEffect(() => {
    heightRef.current = sheetHeight
    requestIosMapTouchSync()
  }, [sheetHeight])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    let pointerId: number | null = null
    let startY = 0
    let startX = 0
    let lastY = 0
    let scrolling = false
    let suppressClick = false

    const endDrag = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return
      if (scrolling) suppressClick = true
      pointerId = null
      scrolling = false
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId)
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      suppressClick = false
      pointerId = event.pointerId
      startY = lastY = event.clientY
      startX = event.clientX
      scrolling = false
    }

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return
      const totalY = Math.abs(event.clientY - startY)
      const totalX = Math.abs(event.clientX - startX)
      if (!scrolling) {
        if (totalY < SCROLL_DRAG_THRESHOLD_PX || totalY <= totalX) return
        scrolling = true
        try {
          scroller.setPointerCapture(event.pointerId)
        } catch {
          // Pointer capture is unavailable for this event; keep scrolling anyway.
        }
      }
      const dy = event.clientY - lastY
      lastY = event.clientY
      scroller.scrollTop -= dy
      event.preventDefault()
      event.stopPropagation()
    }

    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!scrolling) return
      event.preventDefault()
    }

    scroller.addEventListener('pointerdown', onPointerDown)
    scroller.addEventListener('pointermove', onPointerMove)
    scroller.addEventListener('pointerup', endDrag)
    scroller.addEventListener('pointercancel', endDrag)
    scroller.addEventListener('click', onClick, true)
    scroller.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      scroller.removeEventListener('pointerdown', onPointerDown)
      scroller.removeEventListener('pointermove', onPointerMove)
      scroller.removeEventListener('pointerup', endDrag)
      scroller.removeEventListener('pointercancel', endDrag)
      scroller.removeEventListener('click', onClick, true)
      scroller.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  useEffect(() => {
    const readSafeArea = () => setSafeAreaBottom(measureSafeAreaInsetBottom())
    readSafeArea()
    window.addEventListener('resize', readSafeArea)
    return () => window.removeEventListener('resize', readSafeArea)
  }, [])

  useEffect(() => {
    const readHeader = () => setHeaderHeight(measureAppHeaderHeight())
    readHeader()
    const header = document.querySelector('[data-app-header]')
    const observer = header ? new ResizeObserver(readHeader) : null
    if (header) observer?.observe(header)
    window.addEventListener('resize', readHeader)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', readHeader)
    }
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    let lastContainerHeight = 0

    const updateSize = () => {
      const nextHeight = node.clientHeight
      const peek = bottomSheetPeekHeight(nextHeight, safeAreaBottom)
      const max = bottomSheetFullHeight(nextHeight, headerHeight, peek)
      setContainerHeight(nextHeight)
      setSheetHeight((previous) => {
        if (previous <= 0) return peek
        if (lastContainerHeight <= 0)
          return Math.min(max, Math.max(peek, previous))
        const ratio = previous / lastContainerHeight
        const scaled = Math.round(ratio * nextHeight)
        return Math.min(max, Math.max(peek, scaled))
      })
      lastContainerHeight = nextHeight
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    window.addEventListener('resize', updateSize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [headerHeight, safeAreaBottom])

  const beginDrag = (clientY: number) => {
    if (!snapHeights) return
    dragRef.current = { startY: clientY, startHeight: heightRef.current }
    setDragging(true)
  }

  const updateDrag = (clientY: number) => {
    if (!dragRef.current || !snapHeights) return
    const delta = dragRef.current.startY - clientY
    const next = Math.min(
      snapHeights.full,
      Math.max(snapHeights.peek, dragRef.current.startHeight + delta),
    )
    heightRef.current = next
    setSheetHeight(next)
  }

  const endDrag = () => {
    if (!dragRef.current || !snapHeights) {
      dragRef.current = null
      setDragging(false)
      return
    }
    setSheetHeight(nearestSnap(heightRef.current, snapHeights))
    dragRef.current = null
    setDragging(false)
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <div
        data-trip-bottom-sheet
        data-map-touch-zone
        className={cn(
          'ios-map-touch-target pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/25',
          !dragging && 'transition-[height] duration-200 ease-out',
          className,
        )}
        style={sheetHeight > 0 ? { height: `${sheetHeight}px` } : undefined}
      >
        <DevComponentLabel
          name="TripDetailBottomSheet"
          className="absolute left-2 top-2 z-40"
        />
        <div
          data-map-touch-zone
          className={cn(
            'ios-map-touch-target flex shrink-0 cursor-grab touch-none flex-col active:cursor-grabbing',
            TRIP_MAP_OVERLAY_SURFACE_CLASS,
          )}
          role="slider"
          aria-orientation="vertical"
          aria-valuemin={snapHeights?.peek ?? 0}
          aria-valuemax={snapHeights?.full ?? 0}
          aria-valuenow={Math.round(sheetHeight)}
          style={{ height: `${dragChromeHeight}px` }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('button')) return
            event.currentTarget.setPointerCapture(event.pointerId)
            beginDrag(event.clientY)
          }}
          onPointerMove={(event) => {
            if (!dragRef.current) return
            updateDrag(event.clientY)
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId)
            endDrag()
          }}
          onPointerCancel={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId)
            endDrag()
          }}
          aria-label="Drag log panel up or down"
        >
          <div
            className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-3"
            style={{ height: `${BOTTOM_SHEET_DRAG_ZONE_PX}px` }}
          >
            <div
              className="flex items-center justify-start gap-2"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {leadingAction}
            </div>
            <div
              className="h-1.5 w-11 rounded-full bg-white/85 shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
              aria-hidden
            />
            <div />
          </div>
          <div
            className="shrink-0"
            style={{
              height: `${Math.max(safeAreaBottom, BOTTOM_SHEET_MIN_INSET_PX)}px`,
            }}
            aria-hidden
          />
        </div>

        <div
          ref={scrollerRef}
          data-map-touch-zone
          className={cn(
            'ios-map-touch-target pointer-events-auto min-h-0 flex-1 touch-none overflow-y-auto overscroll-contain px-3 pb-8 [-webkit-overflow-scrolling:touch] sm:px-4',
            TRIP_MAP_OVERLAY_SURFACE_CLASS,
          )}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="mx-auto max-w-3xl space-y-5 pb-[var(--lm-safe-bottom)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
