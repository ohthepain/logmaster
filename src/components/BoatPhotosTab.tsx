import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Boat } from '../domain/boat'
import {
  deleteBoatPhoto,
  updateBoatPhoto,
  uploadBoatPhoto,
} from '../lib/boats-api'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { BoatPhotoActionsMenu } from './BoatPhotoActionsMenu'
import { Modal } from './Modal'
import {
  ResourceSectionHeader,
  resourceIconButtonClassName,
} from './NotificationBellToggle'

const DRAG_SELECT_THRESHOLD_PX = 6

type BoatPhotosTabProps = {
  boat: Boat
  onBoatChange: (boat: Boat) => void
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

type DragSession = {
  pointerId: number
  startX: number
  startY: number
  dragging: boolean
  startPhotoId: string
  startIndex: number
}

type DeleteConfirmTarget =
  | { kind: 'bulk' }
  | { kind: 'single'; photoId: string; index: number }

function photoIdFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  const tile = el?.closest('[data-photo-id]')
  return tile?.getAttribute('data-photo-id') ?? null
}

export function BoatPhotosTab({
  boat,
  onBoatChange,
  onRefresh,
  refreshing = false,
}: BoatPhotosTabProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmTarget | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [dragSelecting, setDragSelecting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  const selectModeRef = useRef(selectMode)
  selectModeRef.current = selectMode

  const photos = boat.photos
  const activePhoto =
    activeIndex != null && activeIndex >= 0 && activeIndex < photos.length
      ? photos[activeIndex]
      : null

  const addToSelection = useCallback((photoId: string) => {
    setSelectedIds((prev) => {
      if (prev.has(photoId)) return prev
      const next = new Set(prev)
      next.add(photoId)
      return next
    })
  }, [])

  const toggleSelection = useCallback((photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const openPhotoAt = useCallback(
    (index: number) => {
      const photo = photos[index]
      if (!photo) return
      setActiveIndex(index)
      setCaptionDraft(photo.caption ?? '')
    },
    [photos],
  )

  const finishDragSession = useCallback(
    (session: DragSession, wasDrag: boolean) => {
      if (!wasDrag) {
        if (selectModeRef.current) {
          toggleSelection(session.startPhotoId)
        } else {
          openPhotoAt(session.startIndex)
        }
      }
    },
    [openPhotoAt, toggleSelection],
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      if (!session.dragging) {
        const distance = Math.hypot(
          event.clientX - session.startX,
          event.clientY - session.startY,
        )
        if (distance < DRAG_SELECT_THRESHOLD_PX) return
        session.dragging = true
        setDragSelecting(true)
        addToSelection(session.startPhotoId)
      }

      const photoId = photoIdFromPoint(event.clientX, event.clientY)
      if (photoId) addToSelection(photoId)
    }

    const endPointer = (event: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || event.pointerId !== session.pointerId) return
      const wasDrag = session.dragging
      dragSessionRef.current = null
      setDragSelecting(false)
      finishDragSession(session, wasDrag)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endPointer)
    window.addEventListener('pointercancel', endPointer)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endPointer)
      window.removeEventListener('pointercancel', endPointer)
    }
  }, [addToSelection, finishDragSession])

  const applyPhotosUpdate = useCallback(
    (nextPhotos: Boat['photos']) => {
      onBoatChange({ ...boat, photos: nextPhotos })
    },
    [boat, onBoatChange],
  )

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const photo = await uploadBoatPhoto(boat.id, file)
      applyPhotosUpdate(
        [...boat.photos, photo].sort((a, b) => a.sortOrder - b.sortOrder),
      )
      toast.success('Photo uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const closeGallery = () => setActiveIndex(null)

  const shiftGallery = (direction: -1 | 1) => {
    if (activeIndex == null || photos.length <= 1) return
    const next = (activeIndex + direction + photos.length) % photos.length
    openPhotoAt(next)
  }

  const handleSetDefault = async (photoId: string) => {
    try {
      const updated = await updateBoatPhoto(photoId, { isDefault: true })
      applyPhotosUpdate(
        boat.photos.map((photo) =>
          photo.id === updated.id ? updated : { ...photo, isDefault: false },
        ),
      )
      if (activePhoto?.id === updated.id) {
        setCaptionDraft(updated.caption ?? '')
      }
      toast.success('Default photo updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update photo')
    }
  }

  const handleSaveCaption = async () => {
    if (!activePhoto) return
    try {
      const updated = await updateBoatPhoto(activePhoto.id, {
        caption: captionDraft,
      })
      applyPhotosUpdate(
        boat.photos.map((photo) =>
          photo.id === updated.id ? updated : photo,
        ),
      )
      setCaptionDraft(updated.caption ?? '')
      toast.success('Caption saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save caption')
    }
  }

  const removePhotosLocally = (ids: Set<string>) => {
    const nextPhotos = boat.photos.filter((photo) => !ids.has(photo.id))
    if (
      nextPhotos.length > 0 &&
      !nextPhotos.some((photo) => photo.isDefault)
    ) {
      const sorted = [...nextPhotos].sort((a, b) => a.sortOrder - b.sortOrder)
      applyPhotosUpdate(
        nextPhotos.map((photo) =>
          photo.id === sorted[0]?.id ? { ...photo, isDefault: true } : photo,
        ),
      )
      return
    }
    applyPhotosUpdate(nextPhotos)
  }

  const runDelete = async (ids: Set<string>, singleIndex: number | null) => {
    setDeleting(true)
    const remainingAfterDelete = boat.photos.filter((photo) => !ids.has(photo.id))
    try {
      await Promise.all([...ids].map((id) => deleteBoatPhoto(id)))
      removePhotosLocally(ids)
      clearSelection()
      if (singleIndex != null && activeIndex != null) {
        if (remainingAfterDelete.length === 0) {
          closeGallery()
        } else {
          openPhotoAt(Math.min(singleIndex, remainingAfterDelete.length - 1))
        }
      }
      toast.success(ids.size === 1 ? 'Photo deleted' : 'Photos deleted')
      void onRefresh?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete photo')
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const deleteConfirmCount =
    deleteConfirm?.kind === 'bulk'
      ? selectedIds.size
      : deleteConfirm?.kind === 'single'
        ? 1
        : 0

  return (
    <>
      <ResourceSectionHeader
        title={t('photos')}
        topic="BOAT_PHOTOS"
        boatId={boat.id}
        onRefresh={onRefresh}
        refreshing={refreshing}
        actionsBeforeRefresh={
          selectedIds.size > 0 ? (
            <button
              type="button"
              aria-label={`Delete ${selectedIds.size} selected photo${selectedIds.size === 1 ? '' : 's'}`}
              title="Delete selected photos"
              onClick={() => setDeleteConfirm({ kind: 'bulk' })}
              className={cn(
                resourceIconButtonClassName,
                'text-red-700 dark:text-red-300',
              )}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
        >
          <ImagePlus className="size-4" />
          {uploading ? t('uploading') : t('addPhotos')}
        </button>
        {photos.length > 0 ? (
          <button
            type="button"
            aria-pressed={selectMode}
            onClick={() => setSelectMode((current) => !current)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition',
              selectMode
                ? 'border-[var(--active-border)] bg-[var(--chip-bg)] text-[var(--sea-ink)] ring-2 ring-[var(--sea-ink)]/10'
                : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]',
            )}
          >
            Select
          </button>
        ) : null}
        {selectedIds.size > 0 ? (
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm font-medium text-[var(--sea-ink-soft)] underline-offset-2 hover:underline"
          >
            Clear selection ({selectedIds.size})
          </button>
        ) : null}
      </div>

      {photos.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">
          {t('noPhotosYet')}
        </p>
      ) : (
        <ul
          className={cn(
            'mt-6 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4',
            dragSelecting && 'select-none',
          )}
        >
          {photos.map((photo, index) => {
            const selected = selectedIds.has(photo.id)
            return (
              <li key={photo.id}>
                <div
                  data-photo-id={photo.id}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    if ((event.target as HTMLElement).closest('[data-photo-menu]')) {
                      return
                    }
                    dragSessionRef.current = {
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      dragging: false,
                      startPhotoId: photo.id,
                      startIndex: index,
                    }
                  }}
                  className={cn(
                    'relative block w-full cursor-pointer overflow-hidden rounded-xl border bg-[var(--panel)] text-left',
                    photo.isDefault
                      ? 'border-[var(--active-border)] ring-2 ring-[var(--sea-ink)]/15'
                      : 'border-[var(--panel-border)]',
                    selected &&
                      'ring-2 ring-[var(--sea-ink)] ring-offset-2 ring-offset-[var(--surface-strong)]',
                  )}
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.caption ?? boat.name}
                    className="pointer-events-none aspect-square w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                  <BoatPhotoActionsMenu
                    isDefault={photo.isDefault}
                    onMakeProfile={() => handleSetDefault(photo.id)}
                    onDelete={() =>
                      setDeleteConfirm({
                        kind: 'single',
                        photoId: photo.id,
                        index,
                      })
                    }
                  />
                  {selected ? (
                    <span className="absolute left-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-[var(--btn-bg)] text-[var(--btn-text)] sm:left-2 sm:top-2">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                  ) : null}
                  {photo.isDefault && !selected ? (
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--btn-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--btn-text)] sm:left-2 sm:top-2 sm:px-2 sm:text-[10px]">
                      <Star className="size-2.5 sm:size-3" />
                      {t('defaultPhoto')}
                    </span>
                  ) : null}
                  {photo.caption ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[var(--overlay)] px-2 py-1.5 text-left text-[10px] text-white sm:text-xs">
                      {photo.caption}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {deleteConfirm ? (
        <Modal
          title={
            deleteConfirmCount === 1 ? 'Delete photo?' : 'Delete photos?'
          }
          onClose={() => {
            if (!deleting) setDeleteConfirm(null)
          }}
          layer="overlay"
          devComponentName="BoatPhotosDeleteModal"
        >
          <div className="space-y-4">
            <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
              {deleteConfirmCount === 1
                ? 'Delete this photo? This cannot be undone.'
                : `Delete ${deleteConfirmCount} photos? This cannot be undone.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  if (deleteConfirm.kind === 'bulk') {
                    void runDelete(new Set(selectedIds), null)
                    return
                  }
                  void runDelete(
                    new Set([deleteConfirm.photoId]),
                    deleteConfirm.index,
                  )
                }}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting
                  ? 'Deleting…'
                  : deleteConfirmCount === 1
                    ? 'Delete photo'
                    : `Delete ${deleteConfirmCount} photos`}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {activePhoto && activeIndex != null ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[var(--overlay)] backdrop-blur-sm">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
            <p className="m-0 text-sm font-semibold text-white">
              {activeIndex + 1} / {photos.length}
            </p>
            <button
              type="button"
              onClick={closeGallery}
              className="inline-flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label={t('close')}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
            {photos.length > 1 ? (
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => shiftGallery(-1)}
                className="absolute left-2 z-10 flex size-10 items-center justify-center rounded-full bg-black/40 text-white sm:left-4"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
            ) : null}
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.caption ?? boat.name}
              className="max-h-full max-w-full object-contain"
            />
            {photos.length > 1 ? (
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => shiftGallery(1)}
                className="absolute right-2 z-10 flex size-10 items-center justify-center rounded-full bg-black/40 text-white sm:right-4"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="max-h-[45vh] shrink-0 overflow-y-auto rounded-t-[1.75rem] border-t border-[var(--panel-border)] bg-[var(--surface-strong)] p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:p-6">
            <h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
              {boat.name}
            </h2>

            <label className="mb-4 mt-3 block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Caption
              </span>
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                rows={2}
                placeholder="Optional caption"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveCaption()}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
              >
                Save caption
              </button>
              {!activePhoto.isDefault && (
                <button
                  type="button"
                  onClick={() => void handleSetDefault(activePhoto.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
                >
                  <Star className="size-4" />
                  {t('setAsDefaultPhoto')}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirm({
                    kind: 'single',
                    photoId: activePhoto.id,
                    index: activeIndex,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
              >
                <Trash2 className="size-4" />
                Delete photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
