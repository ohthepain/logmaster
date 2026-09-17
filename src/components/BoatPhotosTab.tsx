import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Boat, BoatPhoto } from '../domain/boat'
import {
  deleteBoatPhoto,
  updateBoatPhoto,
  uploadBoatPhoto,
} from '../lib/boats-api'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { ResourceSectionHeader } from './NotificationBellToggle'

type BoatPhotosTabProps = {
  boat: Boat
  onBoatChange: (boat: Boat) => void
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const photos = boat.photos
  const activePhoto =
    activeIndex != null && activeIndex >= 0 && activeIndex < photos.length
      ? photos[activeIndex]
      : null

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const photo = await uploadBoatPhoto(boat.id, file)
      onBoatChange({
        ...boat,
        photos: [...boat.photos, photo].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
      })
      toast.success('Photo uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openPhotoAt = (index: number) => {
    const photo = photos[index]
    if (!photo) return
    setActiveIndex(index)
    setCaptionDraft(photo.caption ?? '')
  }

  const closeGallery = () => setActiveIndex(null)

  const shiftGallery = (direction: -1 | 1) => {
    if (activeIndex == null || photos.length <= 1) return
    const next = (activeIndex + direction + photos.length) % photos.length
    openPhotoAt(next)
  }

  const handleSetDefault = async () => {
    if (!activePhoto) return
    try {
      const updated = await updateBoatPhoto(activePhoto.id, { isDefault: true })
      onBoatChange({
        ...boat,
        photos: boat.photos.map((photo) =>
          photo.id === updated.id ? updated : { ...photo, isDefault: false },
        ),
      })
      setCaptionDraft(updated.caption ?? '')
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
      onBoatChange({
        ...boat,
        photos: boat.photos.map((photo) =>
          photo.id === updated.id ? updated : photo,
        ),
      })
      setCaptionDraft(updated.caption ?? '')
      toast.success('Caption saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save caption')
    }
  }

  const handleDeletePhoto = async () => {
    if (!activePhoto || activeIndex == null) return
    if (!window.confirm('Delete this photo?')) return
    try {
      await deleteBoatPhoto(activePhoto.id)
      const nextPhotos = boat.photos.filter(
        (photo) => photo.id !== activePhoto.id,
      )
      onBoatChange({
        ...boat,
        photos: nextPhotos,
      })
      if (nextPhotos.length === 0) {
        closeGallery()
      } else {
        openPhotoAt(Math.min(activeIndex, nextPhotos.length - 1))
      }
      toast.success('Photo deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete photo')
    }
  }

  return (
    <>
      <ResourceSectionHeader
        title={t('photos')}
        topic="BOAT_PHOTOS"
        boatId={boat.id}
        onRefresh={onRefresh}
        refreshing={refreshing}
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
      </div>

      {photos.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">
          {t('noPhotosYet')}
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 list-none gap-2 p-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => openPhotoAt(index)}
                className={cn(
                  'relative block w-full overflow-hidden rounded-xl border bg-[var(--panel)] text-left',
                  photo.isDefault
                    ? 'border-[var(--active-border)] ring-2 ring-[var(--sea-ink)]/15'
                    : 'border-[var(--panel-border)]',
                )}
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.caption ?? boat.name}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                {photo.isDefault && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--btn-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--btn-text)] sm:left-2 sm:top-2 sm:px-2 sm:text-[10px]">
                    <Star className="size-2.5 sm:size-3" />
                    {t('defaultPhoto')}
                  </span>
                )}
                {photo.caption ? (
                  <span className="absolute inset-x-0 bottom-0 bg-[var(--overlay)] px-2 py-1.5 text-left text-[10px] text-white sm:text-xs">
                    {photo.caption}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

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
                  onClick={() => void handleSetDefault()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
                >
                  <Star className="size-4" />
                  {t('setAsDefaultPhoto')}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDeletePhoto()}
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
