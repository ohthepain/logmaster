import { CameraSource } from '@capacitor/camera'
import { Camera as CameraIcon, ImageIcon, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fileFromBase64Image,
  isPhotoSelectionCancelled,
  pickEquipmentPhoto,
} from '../lib/camera-media-file'
import {
  listRecentPhotoThumbnails,
  loadRecentPhotoFile,
  supportsRecentPhotoPickerSheet,
} from '../lib/native/logmaster-recent-photos'
import type { RecentPhotoThumbnail } from '../lib/native/logmaster-recent-photos'
import { useTranslation } from '../lib/i18n'

type EquipmentPhotoPickerSheetProps = {
  open: boolean
  onClose: () => void
  onPick: (file: File) => void
}

export function EquipmentPhotoPickerSheet({
  open,
  ...props
}: EquipmentPhotoPickerSheetProps) {
  // Remount each time so both sheet height and list scroll start at their defaults.
  return open ? <PhotoPickerSheet {...props} /> : null
}

function PhotoPickerSheet({
  onClose,
  onPick,
}: Omit<EquipmentPhotoPickerSheetProps, 'open'>) {
  const { t } = useTranslation()
  const [photos, setPhotos] = useState<RecentPhotoThumbnail[]>([])
  const [loading, setLoading] = useState(supportsRecentPhotoPickerSheet)
  const [libraryUnavailable, setLibraryUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [height, setHeight] = useState(50)
  const drag = useRef<{ y: number; height: number } | null>(null)
  const active = useRef(true)
  const busyRef = useRef(false)
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    active.current = true
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!busyRef.current) close.current()
      }
      if (event.key !== 'Tab') return
      const elements = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [tabindex="0"]',
      )
      const first = elements?.[0]
      const last = elements?.[elements.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      active.current = false
      document.removeEventListener('keydown', onKey, true)
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    if (!supportsRecentPhotoPickerSheet()) return
    let cancelled = false
    void listRecentPhotoThumbnails(60)
      .then((items) => {
        if (!cancelled) setPhotos(items)
      })
      .catch(() => {
        if (!cancelled) setLibraryUnavailable(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function pick(id: string, load: () => Promise<File>) {
    if (busyRef.current) return
    busyRef.current = true
    setPickingId(id)
    setError('')
    try {
      const file = await load()
      if (!active.current) return
      onPick(file)
      onClose()
    } catch (failure) {
      if (active.current && !isPhotoSelectionCancelled(failure)) {
        setError(
          t(
            id === 'camera'
              ? 'addAssetCameraUnavailable'
              : 'equipmentPhotoLoadFailed',
          ),
        )
      }
    } finally {
      busyRef.current = false
      if (active.current) setPickingId(null)
    }
  }

  const busy = pickingId !== null
  const resize = (value: number) => setHeight(Math.min(95, Math.max(30, value)))

  return createPortal(
    <div
      data-blocking-overlay
      className="ios-map-touch-target fixed inset-0 z-[100] bg-black/30"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        onPointerDown={() => {
          if (!busyRef.current) onClose()
        }}
      />
      <div
        ref={dialog}
        tabIndex={-1}
        className="ios-map-touch-target absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border-t border-[var(--panel-border)] bg-[var(--surface-strong)] pb-[calc(var(--lm-safe-bottom)+0.75rem)] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] outline-none"
        style={{
          height: `${height}dvh`,
          maxHeight: 'calc(100dvh - var(--lm-safe-top, 0px))',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t('equipmentCamera')}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('equipmentResizeGallery')}
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={95}
          aria-valuenow={Math.round(height)}
          className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={(event) => {
            drag.current = { y: event.clientY, height }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!drag.current) return
            const viewportHeight =
              window.visualViewport?.height || window.innerHeight
            resize(
              drag.current.height +
                ((drag.current.y - event.clientY) / viewportHeight) * 100,
            )
          }}
          onPointerUp={(event) => {
            drag.current = null
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onLostPointerCapture={() => {
            drag.current = null
          }}
          onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
              return
            event.preventDefault()
            resize(
              event.key === 'Home'
                ? 30
                : event.key === 'End'
                  ? 95
                  : height + (event.key === 'ArrowUp' ? 10 : -10),
            )
          }}
        >
          <span
            className="h-1.5 w-11 rounded-full bg-[var(--sea-ink-soft)]/40"
            aria-hidden
          />
        </div>
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--line)] px-4 pb-2">
          <button
            type="button"
            className="min-h-11 justify-self-start text-sm font-medium text-[var(--sea-ink-soft)]"
            onClick={onClose}
            disabled={busy}
          >
            {t('cancel')}
          </button>
          <p className="text-center text-sm font-semibold text-[var(--sea-ink)]">
            {t('equipmentRecentPhotos')}
          </p>
          <button
            type="button"
            className="min-h-11 justify-self-end text-sm font-medium text-[var(--sea-ink-soft)]"
            disabled={busy}
            onClick={() =>
              void pick('library', () =>
                pickEquipmentPhoto(CameraSource.Photos),
              )
            }
          >
            {t('addAssetChoosePhoto')}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-1">
          {error && (
            <p role="alert" className="px-3 text-sm text-[var(--sea-ink)]">
              {error}
            </p>
          )}
          {libraryUnavailable && (
            <p
              role="status"
              className="px-3 text-sm text-[var(--sea-ink-soft)]"
            >
              {t('equipmentPhotoLibraryUnavailable')}
            </p>
          )}
          <div className="grid grid-cols-3 gap-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void pick('camera', () =>
                  pickEquipmentPhoto(CameraSource.Camera),
                )
              }
              className="flex aspect-square flex-col items-center justify-center gap-2 bg-[var(--chip-bg)] text-[var(--sea-ink)] transition hover:bg-[var(--chip-line)] disabled:opacity-50"
            >
              {pickingId === 'camera' ? (
                <LoaderCircle className="size-8 animate-spin" aria-hidden />
              ) : (
                <CameraIcon className="size-8 stroke-[1.5]" aria-hidden />
              )}
              <span className="px-1 text-center text-xs font-semibold">
                {t('equipmentTakePhoto')}
              </span>
            </button>
            {photos.map((photo, index) => (
              <button
                key={photo.localIdentifier}
                type="button"
                aria-label={t('equipmentRecentPhoto', { number: index + 1 })}
                disabled={busy}
                onClick={() =>
                  void pick(photo.localIdentifier, async () => {
                    const { base64, format } = await loadRecentPhotoFile(
                      photo.localIdentifier,
                    )
                    return fileFromBase64Image(base64, format)
                  })
                }
                className="relative aspect-square overflow-hidden bg-[var(--chip-bg)] disabled:opacity-50"
              >
                <img
                  src={`data:image/jpeg;base64,${photo.thumbnailBase64}`}
                  alt=""
                  className="size-full object-cover"
                />
                {pickingId === photo.localIdentifier && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <LoaderCircle
                      className="size-7 animate-spin text-white"
                      aria-hidden
                    />
                  </span>
                )}
              </button>
            ))}
            {loading ? (
              <div
                role="status"
                aria-label={t('loading')}
                className="flex aspect-square items-center justify-center text-[var(--sea-ink-soft)]"
              >
                <LoaderCircle className="size-8 animate-spin" aria-hidden />
              </div>
            ) : (
              !photos.length && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void pick('library', () =>
                      pickEquipmentPhoto(CameraSource.Photos),
                    )
                  }
                  className="flex aspect-square flex-col items-center justify-center gap-2 bg-[var(--chip-bg)] text-[var(--sea-ink)] disabled:opacity-50"
                >
                  {pickingId === 'library' ? (
                    <LoaderCircle className="size-8 animate-spin" aria-hidden />
                  ) : (
                    <ImageIcon className="size-8 stroke-[1.5]" aria-hidden />
                  )}
                  <span className="px-1 text-center text-xs font-semibold">
                    {t('addAssetSelectPhoto')}
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
