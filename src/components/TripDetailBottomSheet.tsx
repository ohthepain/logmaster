import {
  useEffect,
  useMemo,
  useRef,
  useState
  
} from 'react'
import type {ReactNode} from 'react';
import {
  APP_HEADER_INNER_HEIGHT_PX,
  bottomSheetDragChromeHeight,
  bottomSheetFullHeight,
  bottomSheetPeekHeight,
  BOTTOM_SHEET_DRAG_ZONE_PX,
  BOTTOM_SHEET_MIN_INSET_PX,
  measureAppHeaderHeight,
  measureSafeAreaInsetBottom,
} from '../lib/safe-area'
import { cn } from '../lib/cn'
import { TRIP_MAP_OVERLAY_SURFACE_CLASS } from '../lib/trip-map-overlay'
import { DevComponentLabel } from './DevComponentLabel'

const SNAP_RATIOS = {
  half: 0.48,
} as const

type SnapName = 'peek' | 'half' | 'full'

function nearestSnap(heightPx: number, snaps: Record<SnapName, number>): number {
  const values = Object.values(snaps)
  return values.reduce((best, candidate) =>
    Math.abs(candidate - heightPx) < Math.abs(best - heightPx) ? candidate : best,
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

  const hasScrollableContent = sheetHeight > dragChromeHeight + 4

  useEffect(() => {
    heightRef.current = sheetHeight
  }, [sheetHeight])

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
        if (lastContainerHeight <= 0) return Math.min(max, Math.max(peek, previous))
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
          TRIP_MAP_OVERLAY_SURFACE_CLASS,
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
          className="ios-map-touch-target flex shrink-0 cursor-grab touch-none flex-col active:cursor-grabbing"
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
            style={{ height: `${Math.max(safeAreaBottom, BOTTOM_SHEET_MIN_INSET_PX)}px` }}
            aria-hidden
          />
        </div>

        <div
          data-map-touch-zone
          className={cn(
            'ios-map-touch-target min-h-0 flex-1 overscroll-contain px-3 sm:px-4',
            hasScrollableContent ? 'overflow-y-auto pb-8' : 'overflow-hidden',
          )}
        >
          <div className="mx-auto max-w-3xl space-y-5 pb-[env(safe-area-inset-bottom,0px)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
