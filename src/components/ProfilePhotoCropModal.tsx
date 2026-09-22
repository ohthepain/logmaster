import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cropToPixelRect,
  defaultProfilePhotoCrop,
  moveProfilePhotoCrop,
  normalizeProfilePhotoCrop,
  resizeProfilePhotoCrop,
} from '../lib/profile-photo-crop'
import type { ProfilePhotoCrop } from '../lib/profile-photo-crop'
import { cn } from '../lib/cn'
import { Modal } from './Modal'

type ProfilePhotoCropModalProps = {
  open: boolean
  imageUrl: string
  busy?: boolean
  onAccept: (crop: ProfilePhotoCrop) => void
  onCancel: () => void
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

export function ProfilePhotoCropModal({
  open,
  imageUrl,
  busy = false,
  onAccept,
  onCancel,
}: ProfilePhotoCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ImageLayout | null>(null)
  const [crop, setCrop] = useState<ProfilePhotoCrop | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const measureLayout = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
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
    if (!open) {
      setLayout(null)
      setCrop(null)
      setDrag(null)
    }
  }, [open, imageUrl])

  useEffect(() => {
    if (!open) return
    const onResize = () => {
      if (!layout) return
      measureLayout(layout.naturalWidth, layout.naturalHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [layout, measureLayout, open])

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

  if (!open) return null

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

  const handleAccept = () => {
    if (!layout || !crop || busy) return
    onAccept(
      normalizeProfilePhotoCrop(
        crop,
        layout.naturalWidth,
        layout.naturalHeight,
      ),
    )
  }

  return (
    <Modal
      title="Adjust profile photo"
      onClose={busy ? () => {} : onCancel}
      closeOnOutside={!busy}
      layer="overlay"
      desktopCentered
      devComponentName="ProfilePhotoCropModal"
    >
      <div className="space-y-4">
        <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
          Drag the square to choose the area. Pull the corner handle to zoom in
          or out.
        </p>

        <div
          ref={containerRef}
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
                  aria-label="Resize crop"
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!crop || busy}
            onClick={handleAccept}
            className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Use photo'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
