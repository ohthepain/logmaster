import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cropToPixelRect,
  defaultProfilePhotoCrop,
  moveProfilePhotoCrop,
  resizeProfilePhotoCrop,
} from '../lib/profile-photo-crop'
import type { ProfilePhotoCrop } from '../lib/profile-photo-crop'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'

type PhotoRegionEditorProps = {
  imageUrl: string
  busy?: boolean
  onCropChange?: (crop: ProfilePhotoCrop) => void
}

type ImageLayout = {
  naturalWidth: number
  naturalHeight: number
  offsetX: number
  offsetY: number
  scale: number
  displayWidth: number
  displayHeight: number
}

type DragState =
  | {
      kind: 'move'
      pointerId: number
      startX: number
      startY: number
      startCrop: ProfilePhotoCrop
    }
  | {
      kind: 'resize'
      pointerId: number
      startX: number
      startY: number
      startCrop: ProfilePhotoCrop
    }

function computeImageLayout(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageLayout {
  const scale = Math.min(
    containerWidth / naturalWidth,
    containerHeight / naturalHeight,
  )
  const displayWidth = naturalWidth * scale
  const displayHeight = naturalHeight * scale
  return {
    naturalWidth,
    naturalHeight,
    scale,
    displayWidth,
    displayHeight,
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
  }
}

export function PhotoRegionEditor({
  imageUrl,
  busy = false,
  onCropChange,
}: PhotoRegionEditorProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const onCropChangeRef = useRef(onCropChange)
  const [seenUrl, setSeenUrl] = useState(imageUrl)
  const [layout, setLayout] = useState<ImageLayout | null>(null)
  const [crop, setCrop] = useState<ProfilePhotoCrop | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  if (seenUrl !== imageUrl) {
    setSeenUrl(imageUrl)
    setLayout(null)
    setCrop(null)
    setDrag(null)
  }

  useEffect(() => {
    onCropChangeRef.current = onCropChange
  }, [onCropChange])

  useEffect(() => {
    if (crop) onCropChangeRef.current?.(crop)
  }, [crop])

  const measureLayout = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      setLayout(
        computeImageLayout(
          rect.width,
          rect.height,
          naturalWidth,
          naturalHeight,
        ),
      )
      setCrop(
        (current) =>
          current ?? defaultProfilePhotoCrop(naturalWidth, naturalHeight),
      )
    },
    [],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const image = container.querySelector('img')
      if (!(image instanceof HTMLImageElement) || image.naturalWidth < 1) {
        return
      }
      measureLayout(image.naturalWidth, image.naturalHeight)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [measureLayout, imageUrl])

  useEffect(() => {
    const onResize = () => {
      if (!layout) return
      measureLayout(layout.naturalWidth, layout.naturalHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [layout, measureLayout])

  useEffect(() => {
    if (!drag || !layout || !crop) return

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return
      const deltaX = (event.clientX - drag.startX) / layout.scale
      const deltaY = (event.clientY - drag.startY) / layout.scale
      if (drag.kind === 'move') {
        setCrop(
          moveProfilePhotoCrop(
            drag.startCrop,
            layout.naturalWidth,
            layout.naturalHeight,
            deltaX,
            deltaY,
          ),
        )
      } else {
        const deltaSide = Math.max(deltaX, deltaY)
        setCrop(
          resizeProfilePhotoCrop(
            drag.startCrop,
            layout.naturalWidth,
            layout.naturalHeight,
            deltaSide,
          ),
        )
      }
    }

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return
      setDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [crop, drag, layout])

  const cropRect =
    layout && crop
      ? cropToPixelRect(crop, layout.naturalWidth, layout.naturalHeight)
      : null
  const screenRect =
    layout && cropRect
      ? {
          left: layout.offsetX + cropRect.left * layout.scale,
          top: layout.offsetY + cropRect.top * layout.scale,
          size: cropRect.width * layout.scale,
        }
      : null

  return (
    <div
      ref={containerRef}
      data-photo-region-editor
      className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)]"
    >
      <img
        src={imageUrl}
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-contain"
        onLoad={(event) => {
          const img = event.currentTarget
          measureLayout(img.naturalWidth, img.naturalHeight)
        }}
      />

      {layout && screenRect ? (
        <>
          <div
            className="pointer-events-none absolute bg-black/45"
            style={{
              left: layout.offsetX,
              top: layout.offsetY,
              width: layout.displayWidth,
              height: screenRect.top - layout.offsetY,
            }}
          />
          <div
            className="pointer-events-none absolute bg-black/45"
            style={{
              left: layout.offsetX,
              top: screenRect.top + screenRect.size,
              width: layout.displayWidth,
              height:
                layout.offsetY +
                layout.displayHeight -
                (screenRect.top + screenRect.size),
            }}
          />
          <div
            className="pointer-events-none absolute bg-black/45"
            style={{
              left: layout.offsetX,
              top: screenRect.top,
              width: screenRect.left - layout.offsetX,
              height: screenRect.size,
            }}
          />
          <div
            className="pointer-events-none absolute bg-black/45"
            style={{
              left: screenRect.left + screenRect.size,
              top: screenRect.top,
              width:
                layout.offsetX +
                layout.displayWidth -
                (screenRect.left + screenRect.size),
              height: screenRect.size,
            }}
          />

          <div
            className="absolute touch-none border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{
              left: screenRect.left,
              top: screenRect.top,
              width: screenRect.size,
              height: screenRect.size,
              cursor: drag?.kind === 'move' ? 'grabbing' : 'grab',
            }}
            onPointerDown={(event) => {
              if (!crop || busy) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              setDrag({
                kind: 'move',
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startCrop: crop,
              })
            }}
          >
            <button
              type="button"
              aria-label={t('resizeCrop')}
              disabled={busy}
              className={cn(
                'absolute -bottom-2 -right-2 size-5 rounded-full border-2 border-white bg-[var(--brand)] shadow-sm',
                busy && 'opacity-60',
              )}
              onPointerDown={(event) => {
                if (!crop || busy) return
                event.preventDefault()
                event.stopPropagation()
                event.currentTarget.setPointerCapture(event.pointerId)
                setDrag({
                  kind: 'resize',
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  startCrop: crop,
                })
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
